(function () {
    let checkoutInitialized = false;
    let checkoutInitPromise = null;
    let shippingRequestId = 0;
    const checkoutState = {
        user: null,
        addresses: [],
        selectedAddressId: "",
        shippingFee: 0,
        shippingProvider: "",
        shippingLoading: false,
        shippingError: "",
    };

    function isCheckoutPage() {
        return Boolean(document.querySelector("[data-checkout-page]"));
    }

    function getForm() {
        return document.querySelector("[data-checkout-form]");
    }

    function getSubmitButton() {
        return getForm()?.querySelector("button[type='submit']") || null;
    }

    function clearMessage() {
        const mount = document.querySelector("[data-checkout-message]");
        if (mount) {
            mount.innerHTML = "";
        }
    }

    function setMessage(type, message) {
        const mount = document.querySelector("[data-checkout-message]");
        if (!mount || !window.PSGCart) {
            return;
        }

        mount.innerHTML = `
            <div class="psg-cart-message ${type}">
                <p>${window.PSGCart.escapeHtml(message)}</p>
            </div>
        `;
    }

    async function ensureCheckoutAssets() {
        if (window.PSGCart) {
            return true;
        }

        if (window.PSGSite?.ensureSharedAssets) {
            await window.PSGSite.ensureSharedAssets();
        }

        return Boolean(window.PSGCart);
    }

    function sortAddresses(addresses) {
        return [...(addresses || [])].sort((left, right) => {
            const leftDefault = Number(Boolean(left?.default));
            const rightDefault = Number(Boolean(right?.default));

            if (leftDefault !== rightDefault) {
                return rightDefault - leftDefault;
            }

            return Number(left?.id || 0) - Number(right?.id || 0);
        });
    }

    function getSelectedAddress() {
        return checkoutState.addresses.find((address) => String(address.id) === String(checkoutState.selectedAddressId)) || null;
    }

    function renderAuthState() {
        const mount = document.querySelector("[data-checkout-auth]");
        if (!mount || !window.PSGCart) {
            return;
        }

        const authUser = window.PSGCart.getAuthUser();
        if (!authUser) {
            mount.innerHTML = `
                <div class="psg-cart-message is-warning">
                    <strong>Can dang nhap truoc khi thanh toan</strong>
                    <p>Vui long dang nhap bang tai khoan khach hang roi quay lai trang nay.</p>
                </div>
            `;
            return;
        }

        mount.innerHTML = `
            <div class="psg-cart-message is-success">
                <strong>Dang thanh toan voi tai khoan ${window.PSGCart.escapeHtml(authUser.name || authUser.email)}</strong>
                <p>Email dat hang: ${window.PSGCart.escapeHtml(authUser.email)}</p>
            </div>
        `;
    }

    function renderCheckoutItems() {
        const mount = document.querySelector("[data-checkout-items]");
        if (!mount || !window.PSGCart) {
            return;
        }

        const cart = window.PSGCart.readCart();
        if (!cart.length) {
            mount.innerHTML = "<p class='psg-cart-help'>Chua co san pham nao trong gio hang.</p>";
            return;
        }

        mount.innerHTML = `
            <div class="psg-checkout-summary-table">
                ${cart.map((item) => `
                    <div class="psg-checkout-summary-row">
                        <span>${window.PSGCart.escapeHtml(item.name)} x ${Number(item.quantity || 1)}</span>
                        <strong>${window.PSGCart.formatPrice(Number(item.price || 0) * Number(item.quantity || 1))}</strong>
                    </div>
                `).join("")}
            </div>
        `;
    }

    function renderCheckoutSummary() {
        const mount = document.querySelector("[data-checkout-summary]");
        if (!mount || !window.PSGCart) {
            return;
        }

        const cart = window.PSGCart.readCart();
        const hasSelectedAddress = Boolean(getSelectedAddress());
        const shippingFee = hasSelectedAddress && !checkoutState.shippingLoading
            ? Number(checkoutState.shippingFee || 0)
            : 0;
        const summary = window.PSGCart.calculateSummary(cart, window.PSGCart.readCouponCode(), {
            shippingFee,
            taxRate: 0,
        });

        let shippingContent = window.PSGCart.formatPrice(summary.shippingFee);
        if (!hasSelectedAddress) {
            shippingContent = "Chon dia chi";
        } else if (checkoutState.shippingLoading) {
            shippingContent = "Dang tinh...";
        }

        mount.innerHTML = `
            <div class="psg-checkout-summary-table">
                <div class="psg-checkout-summary-row">
                    <span>Tam tinh</span>
                    <strong>${window.PSGCart.formatPrice(summary.subtotal)}</strong>
                </div>
                <div class="psg-checkout-summary-row">
                    <span>Giam gia</span>
                    <strong>-${window.PSGCart.formatPrice(summary.discount)}</strong>
                </div>
                <div class="psg-checkout-summary-row">
                    <span>Van chuyen va xu ly</span>
                    <strong>${shippingContent}</strong>
                </div>
                <div class="psg-checkout-summary-row is-total">
                    <span>Tong tien</span>
                    <strong>${window.PSGCart.formatPrice(summary.total)}</strong>
                </div>
            </div>
        `;
    }

    function renderPaymentNote() {
        const mount = document.querySelector("[data-payment-note]");
        const selected = document.querySelector("input[name='payment_method']:checked")?.value || "cod";
        if (!mount) {
            return;
        }

        mount.innerHTML = selected === "momo"
            ? "<div class='psg-cart-help'>MoMo demo: he thong se tao giao dich gia lap va chuyen sang trang xac nhan thanh toan.</div>"
            : "<div class='psg-cart-help'>Du lieu don hang se duoc tao theo dia chi ban da luu trong tai khoan.</div>";
    }

    function renderAddressOptions() {
        const select = document.querySelector("[data-checkout-address-select]");
        if (!select || !window.PSGCart) {
            return;
        }

        const options = [`<option value="">${checkoutState.addresses.length ? "Chon dia chi giao hang" : "Chua co dia chi nao"}</option>`]
            .concat(checkoutState.addresses.map((address) => {
                const label = `${address.default ? "Mac dinh - " : ""}${address.display_label || address.full_address || `Dia chi #${address.id}`}`;
                return `<option value="${window.PSGCart.escapeHtml(String(address.id))}">${window.PSGCart.escapeHtml(label)}</option>`;
            }))
            .join("");

        select.innerHTML = options;
        select.disabled = checkoutState.addresses.length === 0;

        if (checkoutState.selectedAddressId) {
            select.value = String(checkoutState.selectedAddressId);
        }
    }

    function renderAddressEmptyState() {
        const mount = document.querySelector("[data-checkout-address-empty]");
        if (!mount) {
            return;
        }

        if (checkoutState.addresses.length) {
            mount.hidden = true;
            mount.innerHTML = "";
            return;
        }

        mount.hidden = false;
        mount.innerHTML = `
            <div class="psg-cart-message is-warning">
                <strong>Ban chua co dia chi giao hang nao</strong>
                <p>Hay them dia chi trong trang tai khoan de tiep tuc thanh toan.</p>
            </div>
        `;
    }

    function fillContactFields() {
        const authUser = window.PSGCart?.getAuthUser();
        const selectedAddress = getSelectedAddress();
        const nameInput = document.querySelector("[data-checkout-recipient-name]");
        const phoneInput = document.querySelector("[data-checkout-recipient-phone]");
        const emailInput = document.querySelector("[data-checkout-recipient-email]");
        const addressInput = document.querySelector("[data-checkout-recipient-address]");
        const badge = document.querySelector("[data-checkout-default-badge]");

        if (nameInput) {
            nameInput.value = selectedAddress?.full_name || checkoutState.user?.name || authUser?.name || "";
        }

        if (phoneInput) {
            phoneInput.value = selectedAddress?.phone || checkoutState.user?.phone_number || "";
        }

        if (emailInput) {
            emailInput.value = authUser?.email || "";
        }

        if (addressInput) {
            addressInput.value = selectedAddress?.full_address || "";
        }

        if (badge) {
            badge.hidden = !selectedAddress?.default;
        }
    }

    function renderShippingStatus() {
        const mount = document.querySelector("[data-checkout-shipping-status]");
        if (!mount || !window.PSGCart) {
            return;
        }

        const selectedAddress = getSelectedAddress();
        if (!selectedAddress) {
            mount.textContent = "Chon dia chi de tinh phi van chuyen.";
            return;
        }

        if (checkoutState.shippingLoading) {
            mount.textContent = "Dang tinh phi van chuyen cho dia chi da chon...";
            return;
        }

        if (checkoutState.shippingError) {
            mount.textContent = checkoutState.shippingError;
            return;
        }

        const provider = checkoutState.shippingProvider || "PetSaigon Delivery";
        mount.textContent = `Phi ship tam tinh qua ${provider}: ${window.PSGCart.formatPrice(checkoutState.shippingFee)}.`;
    }

    function updateSubmitState() {
        const submitButton = getSubmitButton();
        if (!submitButton || !window.PSGCart) {
            return;
        }

        const hasAuth = Boolean(window.PSGCart.getAuthUser());
        const hasAddress = Boolean(getSelectedAddress());
        const hasCart = window.PSGCart.readCart().length > 0;
        submitButton.disabled = !hasAuth || !hasAddress || !hasCart || checkoutState.shippingLoading;
    }

    async function loadAccountSummary() {
        if (!window.PSGCart) {
            return;
        }

        const authUser = window.PSGCart.getAuthUser();
        checkoutState.user = null;
        checkoutState.addresses = [];
        checkoutState.selectedAddressId = "";
        checkoutState.shippingFee = 0;
        checkoutState.shippingProvider = "";
        checkoutState.shippingLoading = false;
        checkoutState.shippingError = "";

        if (!authUser) {
            renderAddressOptions();
            renderAddressEmptyState();
            fillContactFields();
            renderShippingStatus();
            renderCheckoutSummary();
            updateSubmitState();
            return;
        }

        try {
            const payload = await window.PSGCart.requestJson(`/account/summary?email=${encodeURIComponent(authUser.email)}`);
            checkoutState.user = payload?.user || null;
            checkoutState.addresses = sortAddresses(payload?.addresses || []);
            checkoutState.selectedAddressId = checkoutState.addresses[0] ? String(checkoutState.addresses[0].id) : "";
        } catch (error) {
            checkoutState.shippingError = error.message || "Khong the tai danh sach dia chi.";
            setMessage("is-error", checkoutState.shippingError);
        }

        renderAddressOptions();
        renderAddressEmptyState();
        fillContactFields();
        renderShippingStatus();
        renderCheckoutSummary();
        updateSubmitState();

        if (checkoutState.selectedAddressId) {
            await refreshShippingQuote();
        }
    }

    async function refreshShippingQuote() {
        if (!window.PSGCart) {
            return;
        }

        const authUser = window.PSGCart.getAuthUser();
        const selectedAddress = getSelectedAddress();
        const requestId = ++shippingRequestId;

        checkoutState.shippingError = "";

        if (!authUser || !selectedAddress) {
            checkoutState.shippingFee = 0;
            checkoutState.shippingProvider = "";
            renderShippingStatus();
            renderCheckoutSummary();
            updateSubmitState();
            return;
        }

        checkoutState.shippingLoading = true;
        checkoutState.shippingFee = 0;
        renderShippingStatus();
        renderCheckoutSummary();
        updateSubmitState();

        try {
            const payload = await window.PSGCart.requestJson("/calculate-shipping", {
                method: "POST",
                body: {
                    email: authUser.email,
                    shipping_address_id: Number(selectedAddress.id),
                },
            });

            if (requestId !== shippingRequestId) {
                return;
            }

            checkoutState.shippingFee = Number(payload?.shipping_fee || 0);
            checkoutState.shippingProvider = String(payload?.provider || "PetSaigon Delivery");
        } catch (error) {
            if (requestId !== shippingRequestId) {
                return;
            }

            checkoutState.shippingFee = 0;
            checkoutState.shippingProvider = "";
            checkoutState.shippingError = error.message || "Khong the tinh phi van chuyen luc nay.";
            setMessage("is-error", checkoutState.shippingError);
        } finally {
            if (requestId === shippingRequestId) {
                checkoutState.shippingLoading = false;
                renderShippingStatus();
                renderCheckoutSummary();
                updateSubmitState();
            }
        }
    }

    async function applySelectedAddress(addressId) {
        checkoutState.selectedAddressId = String(addressId || "");
        clearMessage();
        fillContactFields();
        renderShippingStatus();
        renderCheckoutSummary();
        updateSubmitState();

        if (checkoutState.selectedAddressId) {
            await refreshShippingQuote();
        }
    }

    async function bootstrapCheckoutPage() {
        if (!isCheckoutPage() || checkoutInitialized) {
            return;
        }

        if (checkoutInitPromise) {
            return checkoutInitPromise;
        }

        checkoutInitPromise = (async () => {
            const hasAssets = await ensureCheckoutAssets();
            if (!hasAssets || !window.PSGCart) {
                return;
            }

            await window.PSGCart.ready;
            renderAuthState();
            renderCheckoutItems();
            renderPaymentNote();
            await loadAccountSummary();
            checkoutInitialized = true;
        })()
            .catch((error) => {
                console.error("Khong the khoi tao checkout page.", error);
            })
            .finally(() => {
                checkoutInitPromise = null;
            });

        return checkoutInitPromise;
    }

    document.addEventListener("change", async (event) => {
        if (!isCheckoutPage()) {
            return;
        }

        if (event.target.matches("[data-checkout-address-select]")) {
            await applySelectedAddress(event.target.value);
            return;
        }

        if (event.target.name === "payment_method") {
            renderPaymentNote();
        }
    });

    document.addEventListener("submit", async (event) => {
        const form = event.target.closest("[data-checkout-form]");
        if (!form || !window.PSGCart) {
            return;
        }

        event.preventDefault();
        clearMessage();

        const authUser = window.PSGCart.getAuthUser();
        const cart = window.PSGCart.readCart();
        const selectedAddress = getSelectedAddress();

        if (!authUser) {
            setMessage("is-error", "Ban can dang nhap bang tai khoan khach hang truoc khi thanh toan.");
            return;
        }

        if (!cart.length) {
            setMessage("is-error", "Gio hang dang trong, khong the tao don hang.");
            return;
        }

        if (!selectedAddress) {
            setMessage("is-error", "Vui long chon dia chi giao hang da luu trong tai khoan.");
            return;
        }

        const paymentMethod = String(form.elements.payment_method?.value || "cod");
        const submitButton = getSubmitButton();
        if (submitButton) {
            submitButton.disabled = true;
        }

        const body = {
            email: authUser.email,
            shipping_address_id: Number(selectedAddress.id),
            note: String(form.elements.note?.value || "").trim(),
            payment_method: paymentMethod,
            coupon_code: window.PSGCart.readCouponCode(),
        };

        try {
            if (paymentMethod === "momo") {
                const momoPayload = await window.PSGCart.requestJson("/payments/momo-sim/create", {
                    method: "POST",
                    body,
                });

                window.location.href = momoPayload.redirect_url;
                return;
            }

            const payload = await window.PSGCart.requestJson("/checkout", {
                method: "POST",
                body,
            });

            window.PSGCart.saveCouponCode("");
            await window.PSGCart.init(true);
            setMessage("is-success", `Dat hang thanh cong. Ma don cua ban la PSG-${payload.order_id}.`);
            form.reset();

            const codRadio = form.querySelector("input[value='cod']");
            if (codRadio) {
                codRadio.checked = true;
            }

            renderCheckoutItems();
            renderPaymentNote();
            await loadAccountSummary();
        } catch (error) {
            setMessage("is-error", error.message || "Khong the tao don hang luc nay.");
        } finally {
            updateSubmitState();
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        bootstrapCheckoutPage();
    });

    document.addEventListener("psg:layout-ready", () => {
        bootstrapCheckoutPage();
    });

    document.addEventListener("psg:cart-updated", () => {
        if (!isCheckoutPage() || !window.PSGCart) {
            return;
        }

        renderCheckoutItems();
        renderCheckoutSummary();
        updateSubmitState();
    });

    document.addEventListener("psg:coupon-updated", () => {
        if (!isCheckoutPage()) {
            return;
        }

        renderCheckoutSummary();
    });

    document.addEventListener("psg:auth-updated", async () => {
        if (!isCheckoutPage()) {
            return;
        }

        renderAuthState();
        clearMessage();
        await loadAccountSummary();
    });
})();
