(function () {
    const AUTH_USER_KEY = "psg-auth-user";
    const API_BASE_STORAGE_KEY = "psg-api-base";
    const CART_KEY = "psg-cart";
    const COUPON_KEY = "psg-coupon";

    let resolvedApiBase = "";
    let cartCache = [];
    let initPromise = null;

    function normalizeApiBase(base) {
        const normalized = String(base || "").trim().replace(/\/$/, "");

        if (normalized.startsWith("file://")) {
            return "";
        }

        return normalized;
    }

    function readStoredApiBase() {
        try {
            return normalizeApiBase(window.sessionStorage.getItem(API_BASE_STORAGE_KEY));
        } catch (error) {
            return "";
        }
    }

    function persistApiBase(base) {
        const normalized = normalizeApiBase(base);
        resolvedApiBase = normalized;

        try {
            if (normalized) {
                window.sessionStorage.setItem(API_BASE_STORAGE_KEY, normalized);
            } else {
                window.sessionStorage.removeItem(API_BASE_STORAGE_KEY);
            }
        } catch (error) {
            // Ignore storage issues and continue with in-memory cache.
        }
    }

    function collectApiBaseCandidates() {
        const candidates = [];
        const seen = new Set();

        function addCandidate(base) {
            const normalized = normalizeApiBase(base);
            if (!normalized || seen.has(normalized)) {
                return;
            }

            seen.add(normalized);
            candidates.push(normalized);
        }

        addCandidate(window.PSG_API_BASE);
        addCandidate(readStoredApiBase());

        if (Array.isArray(window.PSG_API_BASES)) {
            window.PSG_API_BASES.forEach(addCandidate);
        } else {
            addCandidate(window.PSG_API_BASES);
        }

        return candidates;
    }

    function resolveApiBase() {
        if (resolvedApiBase) {
            return resolvedApiBase;
        }

        resolvedApiBase = readStoredApiBase() || collectApiBaseCandidates()[0] || "";
        return resolvedApiBase;
    }

    async function apiFetch(path, options = {}) {
        const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
        const candidates = resolvedApiBase
            ? [resolvedApiBase, ...collectApiBaseCandidates().filter((candidate) => candidate !== resolvedApiBase)]
            : collectApiBaseCandidates();
        let lastError = null;

        for (const base of candidates) {
            try {
                const response = await fetch(`${base}${normalizedPath}`, options);

                if (response.status === 404) {
                    continue;
                }

                persistApiBase(base);
                return response;
            } catch (error) {
                lastError = error;
            }
        }

        persistApiBase("");
        throw lastError || new Error("Khong the ket noi API.");
    }

    function normalizeUserRole(role) {
        return String(role || "").trim().toLowerCase();
    }

    function getAuthUser() {
        try {
            const raw = window.localStorage.getItem(AUTH_USER_KEY);
            if (!raw) {
                return null;
            }

            const user = JSON.parse(raw);
            const normalizedUser = {
                id: user?.id ?? null,
                name: String(user?.name || "").trim(),
                email: String(user?.email || "").trim(),
                role: normalizeUserRole(user?.role),
                status: String(user?.status || "").trim().toLowerCase(),
            };

            if (!normalizedUser.email || normalizedUser.role !== "customer") {
                return null;
            }

            return normalizedUser;
        } catch (error) {
            return null;
        }
    }

    function escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function formatPrice(value) {
        return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
    }

    function showToast(type, message) {
        if (window.toastr && typeof window.toastr[type] === "function") {
            window.toastr[type](message);
            return;
        }

        window.alert(message);
    }

    function normalizeQuantityValue(quantity) {
        return Math.max(1, Math.floor(Number(quantity || 1) || 1));
    }

    function resolveStockLimit(...values) {
        for (const value of values) {
            const normalized = Math.floor(Number(value));
            if (Number.isFinite(normalized) && normalized > 0) {
                return normalized;
            }
        }

        return Number.POSITIVE_INFINITY;
    }

    function assertAvailableQuantity(quantity, stockLimit) {
        const normalizedQuantity = normalizeQuantityValue(quantity);

        if (Number.isFinite(stockLimit) && normalizedQuantity > stockLimit) {
            throw new Error(`Chi con ${stockLimit} san pham trong kho.`);
        }

        return normalizedQuantity;
    }

    function normalizeProduct(product) {
        if (!product) {
            return null;
        }

        const normalized = {
            id: Number(product.product_id || product.id || product.product?.id || 0) || null,
            slug: String(product.slug || product.product?.slug || "").trim(),
            name: String(product.name || product.product?.name || "").trim(),
            price: Number(product.price ?? product.product?.price ?? 0),
            quantity: normalizeQuantityValue(product.quantity),
            primary_image: String(product.primary_image || product.product?.primary_image || "").trim(),
            category: String(product.category || product.product?.category?.slug || "").trim(),
            categoryLabel: String(product.categoryLabel || product.product?.category?.name || "").trim(),
            stock: Number(product.stock ?? product.product?.stock ?? 0),
        };

        if (!normalized.id && !normalized.slug) {
            return null;
        }

        if (!normalized.slug) {
            normalized.slug = `product-${normalized.id}`;
        }

        return normalized;
    }

    function normalizeServerCart(items) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items
            .map((item) => normalizeProduct({
                product_id: item.product_id,
                quantity: item.quantity,
                product: item.product,
            }))
            .filter(Boolean);
    }

    function readLocalCart() {
        try {
            let raw = window.localStorage.getItem(CART_KEY);
            if (!raw && getAuthUser()) {
                raw = window.localStorage.getItem("psg-cart-server-cache");
            }
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed)
                ? parsed.map(normalizeProduct).filter(Boolean)
                : [];
        } catch (error) {
            return [];
        }
    }

    function writeLocalCart(cart) {
        if (getAuthUser()) {
            window.localStorage.setItem("psg-cart-server-cache", JSON.stringify(cart));
        } else {
            window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
        }
    }

    function readCart() {
        if (!Array.isArray(cartCache)) {
            cartCache = [];
        }

        return cartCache.slice();
    }

    function getItemKinds(cart = readCart()) {
        return cart.length;
    }

    function getItemQuantity(cart = readCart()) {
        return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    }

    function updateCartBadge() {
        const count = getItemQuantity();
        const badge = document.getElementById("cart-count");
        if (!badge) {
            return;
        }

        badge.textContent = String(count);
        badge.classList.toggle("is-empty", count <= 0);
    }

    function setCartState(cart) {
        cartCache = Array.isArray(cart) ? cart.map(normalizeProduct).filter(Boolean) : [];
        writeLocalCart(cartCache);
        updateCartBadge();
        document.dispatchEvent(new CustomEvent("psg:cart-updated", {
            detail: {
                cart: readCart(),
            },
        }));
    }

    async function parseResponse(response) {
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(payload.message || "Khong the xu ly gio hang.");
        }

        return payload;
    }

    async function requestJson(path, options = {}) {
        const response = await apiFetch(path, {
            method: options.method || "GET",
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(options.headers || {}),
            },
            ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        });

        return parseResponse(response);
    }

    function buildEmailQuery(email) {
        return `email=${encodeURIComponent(email)}`;
    }

    async function syncFromServer() {
        const authUser = getAuthUser();
        if (!authUser) {
            setCartState(readLocalCart());
            return readCart();
        }

        const response = await apiFetch(`/cart?${buildEmailQuery(authUser.email)}`, {
            headers: {
                Accept: "application/json",
            },
        });
        const payload = await parseResponse(response);
        const cart = normalizeServerCart(payload.cart);
        setCartState(cart);
        return cart;
    }

    async function mergeLocalCartToServer() {
        const authUser = getAuthUser();
        let localCart = [];
        try {
            const raw = window.localStorage.getItem(CART_KEY);
            if (raw) localCart = JSON.parse(raw);
        } catch(e) {}

        if (!authUser || !localCart.length) {
            return;
        }

        for (const item of localCart) {
            if (!item?.id) {
                continue;
            }

            const response = await apiFetch("/cart/items", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: authUser.email,
                    product_id: item.id,
                    quantity: item.quantity,
                }),
            });

            await parseResponse(response);
        }

        window.localStorage.removeItem(CART_KEY);
    }

    async function init(force = false) {
        if (!force && initPromise) {
            return initPromise;
        }

        initPromise = (async () => {
            const authUser = getAuthUser();

            if (!authUser) {
                setCartState(readLocalCart());
                return readCart();
            }

            try {
                await mergeLocalCartToServer();
            } catch (error) {
                console.warn("Khong the dong bo gio hang local len server.", error);
            }

            return syncFromServer().catch((error) => {
                console.warn("Khong the tai gio hang tu server, tam dung cache local.", error);
                setCartState(readLocalCart());
                return readCart();
            });
        })();

        return initPromise;
    }

    function updateLocalQuantity(identifier, quantity) {
        const cart = readLocalCart().map((item) => {
            if (String(item.slug) !== String(identifier) && String(item.id) !== String(identifier)) {
                return item;
            }

            return {
                ...item,
                quantity: Math.max(1, Number(quantity || 1)),
            };
        });

        setCartState(cart);
        return Promise.resolve(readCart());
    }

    async function mutateServerCart(path, options) {
        const response = await apiFetch(path, options);
        const payload = await parseResponse(response);
        const cart = normalizeServerCart(payload.cart);
        setCartState(cart);
        return cart;
    }

    async function addItem(product) {
        const normalized = normalizeProduct(product);
        if (!normalized) {
            return readCart();
        }

        const currentCart = readCart();
        const existingItem = currentCart.find((item) => String(item.id) === String(normalized.id) || String(item.slug) === String(normalized.slug));
        const stockLimit = resolveStockLimit(normalized.stock, existingItem?.stock);
        const nextQuantity = assertAvailableQuantity(
            Number(existingItem?.quantity || 0) + Number(normalized.quantity || 1),
            stockLimit
        );

        const authUser = getAuthUser();
        if (authUser && normalized.id) {
            return mutateServerCart("/cart/items", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: authUser.email,
                    product_id: normalized.id,
                    quantity: normalized.quantity,
                }),
            });
        }

        const localCart = readLocalCart();
        const localExistingItem = localCart.find((item) => String(item.id) === String(normalized.id) || String(item.slug) === String(normalized.slug));

        if (localExistingItem) {
            localExistingItem.quantity = nextQuantity;
        } else {
            localCart.push(normalized);
        }

        if (authUser) {
            window.localStorage.setItem("psg-cart-server-cache", JSON.stringify(localCart));
        } else {
            window.localStorage.setItem(CART_KEY, JSON.stringify(localCart));
        }

        setCartState(localCart);
        return readCart();
    }

    let quantityUpdateTimeout = null;
    const pendingUpdates = {};

    async function updateQuantity(identifier, quantity) {
        const authUser = getAuthUser();
        const cart = readCart();
        const itemIndex = cart.findIndex((entry) => String(entry.slug) === String(identifier) || String(entry.id) === String(identifier));

        if (itemIndex < 0) return cart;

        const targetQuantity = assertAvailableQuantity(quantity, resolveStockLimit(cart[itemIndex]?.stock));
        cart[itemIndex].quantity = targetQuantity;
        setCartState(cart);

        if (authUser && cart[itemIndex]?.id) {
            if (pendingUpdates[cart[itemIndex].id]) {
                clearTimeout(pendingUpdates[cart[itemIndex].id]);
            }
            
            return new Promise((resolve, reject) => {
                pendingUpdates[cart[itemIndex].id] = setTimeout(async () => {
                    try {
                        const response = await apiFetch(`/cart/items/${cart[itemIndex].id}`, {
                            method: "PATCH",
                            headers: {
                                Accept: "application/json",
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                email: authUser.email,
                                quantity: targetQuantity,
                            }),
                        });
                        const payload = await parseResponse(response);
                        setCartState(normalizeServerCart(payload.cart));
                        resolve(payload.cart);
                    } catch (error) {
                        if (window.toastr) window.toastr.error(error.message || "Khong the cap nhat");
                        syncFromServer().catch(console.error);
                        reject(error);
                    }
                }, 300);
            });
        }

        return updateLocalQuantity(identifier, targetQuantity);
    }

    async function removeItem(identifier) {
        const authUser = getAuthUser();
        const cart = readCart();
        const itemIndex = cart.findIndex((entry) => String(entry.slug) === String(identifier) || String(entry.id) === String(identifier));

        if (itemIndex < 0) return cart;
        
        const itemId = cart[itemIndex].id;
        cart.splice(itemIndex, 1);
        setCartState(cart);

        if (authUser && itemId) {
            try {
                const response = await apiFetch(`/cart/items/${itemId}`, {
                    method: "DELETE",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: authUser.email,
                    }),
                });
                const payload = await parseResponse(response);
                setCartState(normalizeServerCart(payload.cart));
                return payload.cart;
            } catch (error) {
                if (window.toastr) window.toastr.error(error.message || "Khong the xoa");
                syncFromServer().catch(console.error);
                return [];
            }
        }

        return readCart();
    }

    async function clearCart() {
        const authUser = getAuthUser();

        if (authUser) {
            return mutateServerCart("/cart", {
                method: "DELETE",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: authUser.email,
                }),
            });
        }

        setCartState([]);
        return readCart();
    }

    function readCouponCode() {
        return String(window.localStorage.getItem(COUPON_KEY) || "").trim().toUpperCase();
    }

    function saveCouponCode(code) {
        const normalized = String(code || "").trim().toUpperCase();
        if (!normalized) {
            window.localStorage.removeItem(COUPON_KEY);
            document.dispatchEvent(new CustomEvent("psg:coupon-updated", {
                detail: {
                    code: "",
                },
            }));
            return "";
        }

        window.localStorage.setItem(COUPON_KEY, normalized);
        document.dispatchEvent(new CustomEvent("psg:coupon-updated", {
            detail: {
                code: normalized,
            },
        }));
        return normalized;
    }

    function getShippingFee(subtotal) {
        if (subtotal <= 0) {
            return 0;
        }

        return subtotal >= 500000 ? 0 : 30000;
    }

    function getTaxAmount(subtotalAfterDiscount, taxRate = 0.08) {
        return Math.round(subtotalAfterDiscount * Number(taxRate || 0));
    }

    function getCouponDefinitions() {
        return {
            PET10: { code: "PET10", type: "percent", value: 10, minSubtotal: 200000, maxDiscount: 50000, label: "Giam 10% toi da 50.000d cho don tu 200.000d" },
            SAVE30K: { code: "SAVE30K", type: "fixed", value: 30000, minSubtotal: 300000, label: "Giam truc tiep 30.000d cho don tu 300.000d" },
            FREESHIP: { code: "FREESHIP", type: "shipping", value: 30000, minSubtotal: 150000, label: "Mien phi van chuyen toi da 30.000d" },
            THUANNGU: { code: "THUANNGU", type: "percent", value: 100, minSubtotal: 0, label: "Noi hay lam giam cho 100% nhe" },
        };
    }

    function getCouponState(code, cart = readCart(), shippingFeeOverride = null) {
        const normalized = String(code || "").trim().toUpperCase();
        const coupon = getCouponDefinitions()[normalized] || null;
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const shippingFee = shippingFeeOverride === null || shippingFeeOverride === undefined
            ? getShippingFee(subtotal)
            : Number(shippingFeeOverride || 0);

        if (!normalized) {
            return { valid: false, message: "Chua ap dung ma giam gia.", discount: 0, coupon: null };
        }

        if (!coupon) {
            return { valid: false, message: "Ma giam gia khong hop le.", discount: 0, coupon: null };
        }

        if (subtotal < coupon.minSubtotal) {
            return {
                valid: false,
                message: `Don hang can toi thieu ${formatPrice(coupon.minSubtotal)} de dung ma ${coupon.code}.`,
                discount: 0,
                coupon,
            };
        }

        let discount = 0;

        if (coupon.type === "percent") {
            discount = Math.round((subtotal * coupon.value) / 100);
            if (coupon.maxDiscount) {
                discount = Math.min(discount, coupon.maxDiscount);
            }
        } else if (coupon.type === "fixed") {
            discount = coupon.value;
        } else if (coupon.type === "shipping") {
            discount = Math.min(coupon.value, shippingFee);
        }

        return {
            valid: true,
            message: coupon.label,
            discount,
            coupon,
        };
    }

    function calculateSummary(cart = readCart(), couponCode = readCouponCode(), options = {}) {
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
        const shippingFee = options.shippingFee === undefined || options.shippingFee === null
            ? getShippingFee(subtotal)
            : Number(options.shippingFee || 0);
        const couponState = getCouponState(couponCode, cart, shippingFee);
        const discount = couponState.valid ? couponState.discount : 0;
        const taxableSubtotal = Math.max(0, subtotal - discount);
        const tax = getTaxAmount(taxableSubtotal, options.taxRate === undefined ? 0.08 : options.taxRate);
        const total = Math.max(0, taxableSubtotal + shippingFee + tax);

        return {
            subtotal,
            shippingFee,
            discount,
            tax,
            total,
            couponCode: String(couponCode || "").trim().toUpperCase(),
            couponState,
            itemKinds: getItemKinds(cart),
            itemQuantity: getItemQuantity(cart),
        };
    }

    function attachAddToCartHandler() {
        document.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-add-to-cart]");
            if (!button) {
                return;
            }

            event.preventDefault();

            try {
                button.disabled = true;
                await addItem({
                    id: button.dataset.productId,
                    slug: button.dataset.productSlug,
                    name: button.dataset.productName,
                    price: button.dataset.productPrice,
                    primary_image: button.dataset.productImage,
                    category: button.dataset.productCategory,
                    categoryLabel: button.dataset.productCategoryLabel,
                    quantity: button.dataset.productQuantity || 1,
                    stock: button.dataset.productStock,
                });

                const originalLabel = button.dataset.originalLabel || button.textContent.trim();
                button.dataset.originalLabel = originalLabel;
                button.textContent = "Da them";
                button.classList.add("is-added");

                window.setTimeout(() => {
                    button.textContent = originalLabel;
                    button.classList.remove("is-added");
                }, 1200);
            } catch (error) {
                showToast("error", error.message || "Khong the them vao gio hang luc nay.");
            } finally {
                button.disabled = false;
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        updateCartBadge();
        init().catch(console.error);
    });

    document.addEventListener("psg:layout-ready", () => {
        updateCartBadge();
    });

    document.addEventListener("psg:auth-updated", () => {
        init(true).catch(console.error);
    });

    attachAddToCartHandler();

    window.PSGCart = {
        ready: init(),
        init,
        readCart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        syncFromServer,
        getAuthUser,
        getItemKinds,
        getItemQuantity,
        updateCartBadge,
        formatPrice,
        escapeHtml,
        readCouponCode,
        saveCouponCode,
        getCouponState,
        calculateSummary,
        requestJson,
    };
})();
