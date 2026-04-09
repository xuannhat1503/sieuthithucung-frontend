(function () {
    const API_BASE_STORAGE_KEY = "psg-api-base";
    const CATALOG_PAGE_SIZE = 12;
    const DEFAULT_CATALOG_SORT = "default";
    let resolvedApiBase = "";

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
            // Ignore storage failures and fall back to in-memory caching.
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

    async function apiGetJson(path, params = {}) {
        const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
        const defaultBase = resolveApiBase();
        const candidates = defaultBase
            ? [defaultBase, ...collectApiBaseCandidates().filter((candidate) => candidate !== defaultBase)]
            : collectApiBaseCandidates();
        let lastError = null;

        for (const base of candidates) {
            try {
                const url = new URL(`${base}${normalizedPath}`, window.location.origin);

                Object.entries(params).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== "") {
                        url.searchParams.set(key, value);
                    }
                });

                const response = await fetch(url.toString(), {
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (response.status === 404) {
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`API error ${response.status}`);
                }

                persistApiBase(base);
                return response.json();
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error("Không thể kết nối API.");
    }

    async function getCategories() {
        try {
            const payload = await apiGetJson("/categories");

            if (Array.isArray(payload.data)) {
                return payload.data;
            }
        } catch (error) {
            console.error("Không tải được categories từ API.", error);
        }

        return [];
    }

    async function getProducts(params = {}) {
        try {
            const payload = await apiGetJson("/products", params);

            if (Array.isArray(payload.data) && payload.meta) {
                return payload;
            }
        } catch (error) {
            console.error("Không tải được products từ API.", error);
        }

        return {
            data: [],
            meta: {
                current_page: Number(params.page || 1),
                last_page: 1,
                per_page: Number(params.limit || 12),
                total: 0,
            },
        };
    }

    async function getProductDetail(slug) {
        try {
            const payload = await apiGetJson(`/products/${slug}`);

            if (payload.data) {
                return payload;
            }
        } catch (error) {
            console.error("Không tải được chi tiết sản phẩm từ API.", error);
        }

        return { data: null, related: [] };
    }

    function normalizeCatalogSort(sort) {
        const normalized = String(sort || "").trim().toLowerCase();

        if (!normalized || normalized === "default") {
            return DEFAULT_CATALOG_SORT;
        }

        const supported = new Set(["latest", "price_asc", "price_desc", "name_asc", "rating"]);
        return supported.has(normalized) ? normalized : DEFAULT_CATALOG_SORT;
    }

    function buildCatalogRequestParams(params = {}) {
        return {
            keyword: params.keyword || "",
            category: params.category || "",
            min_price: params.min_price || "",
            max_price: params.max_price || "",
            sort: normalizeCatalogSort(params.sort),
            page: Number(params.page || 1) || 1,
            limit: CATALOG_PAGE_SIZE,
        };
    }

    function buildCatalogPageUrl(page) {
        const params = new URLSearchParams(window.location.search);

        if (page <= 1) {
            params.delete("page");
        } else {
            params.set("page", page);
        }

        const query = params.toString();
        return `./products.html${query ? `?${query}` : ""}`;
    }

    function sortProductsLocally(products, sort) {
        const items = Array.isArray(products) ? products.slice() : [];
        const normalizedSort = normalizeCatalogSort(sort);

        switch (normalizedSort) {
            case "price_asc":
                return items.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
            case "price_desc":
                return items.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
            case "name_asc":
                return items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "vi"));
            case "rating":
                return items.sort((a, b) => {
                    const ratingDiff = Number(b.rating_average || 0) - Number(a.rating_average || 0);
                    if (ratingDiff !== 0) {
                        return ratingDiff;
                    }

                    return Number(b.rating_count || 0) - Number(a.rating_count || 0);
                });
            case "latest":
            case "default":
            default:
                return items;
        }
    }

    function clampRating(value) {
        return Math.max(0, Math.min(5, Number(value || 0)));
    }

    function formatRatingValue(value) {
        const normalized = clampRating(value);
        return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(1);
    }

    function renderStarRating(value, options = {}) {
        const rating = clampRating(value);
        const allowHalf = options.allowHalf !== false;
        const label = options.label || `${formatRatingValue(rating)} trên 5 sao`;
        let starsHtml = "";

        for (let index = 1; index <= 5; index += 1) {
            const diff = rating - (index - 1);

            if (diff >= 1) {
                starsHtml += '<i class="fa-solid fa-star"></i>';
                continue;
            }

            if (allowHalf && diff >= 0.25 && diff < 0.75) {
                starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
                continue;
            }

            if (diff >= 0.75) {
                starsHtml += '<i class="fa-solid fa-star"></i>';
                continue;
            }

            starsHtml += '<i class="fa-regular fa-star is-empty"></i>';
        }

        return `<span class="psg-star-rating" aria-label="${escapeHtml(label)}">${starsHtml}</span>`;
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

    function renderProductMedia(product) {
        if (product.primary_image) {
            return `
                <div class="psg-product-media">
                    <img class="psg-product-photo" src="${escapeHtml(product.primary_image)}" alt="${escapeHtml(product.name)}">
                </div>
            `;
        }

        return `
            <div class="psg-product-media">
                <div class="psg-product-art">
                    <i class="fa-solid fa-paw"></i>
                </div>
            </div>
        `;
    }

    function renderProductCard(product) {
        const categoryName = product.category?.name || product.categoryLabel || "Sản phẩm";
        const rating = product.rating_average ? `${product.rating_average}/5` : "Mới";
        const isOutOfStock = Number(product.stock || 0) <= 0;

        return `
            <article class="psg-product-card">
                ${renderProductMedia(product)}
                <div class="psg-product-copy">
                    <span class="psg-pill">${escapeHtml(categoryName)}</span>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.description || "Đang cập nhật mô tả sản phẩm.")}</p>
                    <div class="psg-rating-inline">
                        <span><i class="fa-solid fa-star"></i> ${escapeHtml(rating)}</span>
                        <span>${escapeHtml(product.rating_count || 0)} đánh giá</span>
                    </div>
                    <div class="psg-price-row">
                        <strong class="psg-price-now">${formatPrice(product.price)}</strong>
                    </div>
                    <div class="psg-product-actions">
                        <a class="psg-btn psg-btn-primary" href="./product-detail.html?slug=${encodeURIComponent(product.slug)}">Xem chi tiết</a>
                        <button
                            class="psg-btn psg-btn-icon"
                            type="button"
                            aria-label="Thêm vào giỏ"
                            data-add-to-cart
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-slug="${escapeHtml(product.slug)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-image="${escapeHtml(product.primary_image || "")}"
                            data-product-category="${escapeHtml(product.category?.slug || product.category || "")}"
                            data-product-category-label="${escapeHtml(categoryName)}"
                            data-product-stock="${escapeHtml(product.stock || 0)}"
                            ${isOutOfStock ? "disabled" : ""}
                        >
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function renderEmptyState(node, title, message) {
        node.innerHTML = `
            <div class="psg-empty-state">
                <i class="fa-solid fa-box-open"></i>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }

    function renderPagination(meta) {
        const mount = document.querySelector("[data-pagination]");
        if (!mount || !meta) {
            return;
        }

        if ((meta.last_page || 1) <= 1) {
            mount.innerHTML = "";
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const links = [];

        for (let page = 1; page <= meta.last_page; page += 1) {
            params.set("page", page);
            links.push(`
                <a class="psg-page-pill ${page === meta.current_page ? "active" : ""}" href="./products.html?${params.toString()}">${page}</a>
            `);
        }

        mount.innerHTML = links.join("");
    }

    function syncFilterForm(categories) {
        const form = document.getElementById("catalog-filters");
        if (!form) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const categoryMount = form.querySelector("[data-category-options]");

        if (categoryMount) {
            const currentCategory = params.get("category") || "";
            categoryMount.innerHTML = [
                `<label class="psg-check-row"><input type="radio" name="category" value="" ${currentCategory === "" ? "checked" : ""}> Tất cả danh mục</label>`,
                ...categories.map((category) => `
                    <label class="psg-check-row">
                        <input type="radio" name="category" value="${escapeHtml(category.slug)}" ${currentCategory === category.slug ? "checked" : ""}>
                        ${escapeHtml(category.name)}
                    </label>
                `),
            ].join("");
        }

        ["keyword", "min_price", "max_price", "sort"].forEach((name) => {
            const field = form.elements.namedItem(name);
            if (field && params.has(name)) {
                field.value = params.get(name);
            }
        });

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const nextParams = new URLSearchParams();
            const formData = new FormData(form);

            formData.forEach((value, key) => {
                if (value) {
                    nextParams.set(key, value);
                }
            });

            window.location.search = nextParams.toString();
        });
    }

    function renderResultSummary(meta) {
        const node = document.querySelector("[data-results-summary]");
        if (!node || !meta) {
            return;
        }

        node.innerHTML = `<strong>${meta.total}</strong> sản phẩm đang được hiển thị`;
    }

    function renderReviewCards(reviews) {
        if (!reviews?.length) {
            return `
                <article class="psg-review-card">
                    <h3>Chưa có đánh giá</h3>
                    <p>Sản phẩm này chưa có đánh giá mới. Bạn có thể quay lại sau để xem thêm phản hồi.</p>
                </article>
            `;
        }

        return reviews.slice(0, 2).map((review, index) => {
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= (review.rating || 5)) {
                    starsHtml += '<i class="fa-solid fa-star" style="color: #f39c12; font-size: 0.9em;"></i>';
                } else {
                    starsHtml += '<i class="fa-regular fa-star" style="color: #ccc; font-size: 0.9em;"></i>';
                }
            }
            
            return `
            <article class="psg-review-card">
                <div style="margin-bottom: 8px;">
                    ${starsHtml}
                    <span style="font-size: 0.85em; color: #7f8c8d; margin-left: 8px;">${escapeHtml(review.created_at || '')}</span>
                </div>
                <p>${escapeHtml(review.comment || "Khách hàng đã đánh giá không kèm bình luận.")}</p>
            </article>
            `;
        }).join("");
    }

    function renderDetailGallery(product) {
        const images = product.images?.length ? product.images : (product.primary_image ? [product.primary_image] : []);
        const mainImage = images[0];

        if (!mainImage) {
            return `
                <div class="psg-detail-gallery">
                    <div class="psg-detail-gallery-main">
                        <div class="psg-product-art">
                            <i class="fa-solid fa-paw"></i>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="psg-detail-gallery">
                <div class="psg-detail-gallery-main">
                    <img class="psg-detail-photo" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.name)}">
                </div>
                <div class="psg-thumb-row">
                    ${images.slice(0, 3).map((image) => `
                        <div class="psg-thumb">
                            <img class="psg-thumb-photo" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function renderProductDetail(product) {
        const categoryName = product.category?.name || product.categoryLabel || "Sản phẩm";
        const isOutOfStock = Number(product.stock || 0) <= 0;

        return `
            <article class="psg-detail-card">
                ${renderDetailGallery(product)}
                <div class="psg-detail-copy">
                    <span class="psg-pill">${escapeHtml(categoryName)}</span>
                    <h1>${escapeHtml(product.name)}</h1>
                    <div class="psg-detail-meta">
                        <span>Tồn kho: <strong>${escapeHtml(product.stock ?? 0)}</strong></span>
                        <span>Trạng thái: <strong>${escapeHtml(product.status || "Đang bán")}</strong></span>
                        <span>Mã SP: <strong>PSG-${escapeHtml(product.id || product.slug)}</strong></span>
                    </div>
                    <div class="psg-rating-row">
                        <span><i class="fa-solid fa-star"></i> ${escapeHtml(product.rating_average || 0)}/5</span>
                        <span>${escapeHtml(product.rating_count || 0)} đánh giá</span>
                    </div>
                    <div class="psg-price-row">
                        <strong class="psg-price-now">${formatPrice(product.price)}</strong>
                    </div>
                    <p class="psg-detail-summary">${escapeHtml(product.short_description || product.description || "Đang cập nhật mô tả sản phẩm.")}</p>
                    <ul class="psg-detail-specs">
                        <li>Danh mục: ${escapeHtml(categoryName)}</li>
                        <li>Đơn vị: ${escapeHtml(product.unit || "Sản phẩm")}</li>
                        <li>Dữ liệu được ưu tiên lấy từ API Laravel hiện tại.</li>
                    </ul>
                    <div class="psg-detail-actions">
                        <span class="psg-qty-box">Số lượng: 1</span>
                        <button
                            class="psg-btn psg-btn-primary"
                            type="button"
                            data-add-to-cart
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-slug="${escapeHtml(product.slug)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-image="${escapeHtml(product.primary_image || "")}"
                            data-product-category="${escapeHtml(product.category?.slug || product.category || "")}"
                            data-product-category-label="${escapeHtml(categoryName)}"
                            data-product-stock="${escapeHtml(product.stock || 0)}"
                            ${isOutOfStock ? "disabled" : ""}
                        >
                            ${isOutOfStock ? "Tạm hết hàng" : "Thêm vào giỏ"}
                        </button>
                        <button
                            class="psg-btn psg-btn-icon"
                            type="button"
                            aria-label="Thêm vào wishlist"
                            data-add-to-wishlist
                            data-product-id="${escapeHtml(product.id)}"
                            title="Thêm vào wishlist"
                        >
                            <i class="fa-solid fa-heart" style="color: #bbb; transition: color 0.3s;"></i>
                        </button>
                        <a class="psg-btn psg-btn-secondary" href="./products.html?category=${encodeURIComponent(product.category?.slug || "")}">Xem cùng danh mục</a>
                    </div>
                    <div class="psg-detail-badges">
                        <span class="psg-pill">Giao nhanh nội thành</span>
                        <span class="psg-pill">Hỗ trợ đổi trả</span>
                        <span class="psg-pill">Tư vấn chọn sản phẩm</span>
                    </div>
                </div>
            </article>

            <section class="psg-detail-tabs">
                <h2>Mô tả sản phẩm</h2>
                <p>${escapeHtml(product.description || "Mô tả đang được cập nhật.")}</p>
                <div class="psg-review-grid">
                    ${renderReviewCards(product.reviews)}
                </div>
            </section>
        `;
    }

    function renderEnhancedProductCard(product) {
        const categoryName = product.category?.name || product.categoryLabel || "Sản phẩm";
        const ratingAverage = clampRating(product.rating_average || 0);
        const ratingCount = Number(product.rating_count || 0);
        const ratingText = ratingCount > 0 ? formatRatingValue(ratingAverage) : "Chưa có đánh giá";
        const isOutOfStock = Number(product.stock || 0) <= 0;

        return `
            <article class="psg-product-card">
                ${renderProductMedia(product)}
                <div class="psg-product-copy">
                    <span class="psg-pill">${escapeHtml(categoryName)}</span>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.description || "Đang cập nhật mô tả sản phẩm.")}</p>
                    <div class="psg-rating-inline">
                        <span class="psg-rating-value">
                            ${renderStarRating(ratingAverage, {
                                allowHalf: true,
                                label: ratingCount > 0 ? `${ratingText} với ${ratingCount} đánh giá` : "Chưa có đánh giá",
                            })}
                            <span>${escapeHtml(ratingText)}</span>
                        </span>
                        <span>${escapeHtml(ratingCount)} đánh giá</span>
                    </div>
                    <div class="psg-price-row">
                        <strong class="psg-price-now">${formatPrice(product.price)}</strong>
                    </div>
                    <div class="psg-product-actions">
                        <a class="psg-btn psg-btn-primary" href="./product-detail.html?slug=${encodeURIComponent(product.slug)}">Xem chi tiết</a>
                        <button
                            class="psg-btn psg-btn-icon"
                            type="button"
                            aria-label="Thêm vào giỏ"
                            data-add-to-cart
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-slug="${escapeHtml(product.slug)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-image="${escapeHtml(product.primary_image || "")}"
                            data-product-category="${escapeHtml(product.category?.slug || product.category || "")}"
                            data-product-category-label="${escapeHtml(categoryName)}"
                            data-product-stock="${escapeHtml(product.stock || 0)}"
                            data-product-quantity="1"
                            ${isOutOfStock ? "disabled" : ""}
                        >
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function renderCatalogPagination(meta) {
        const mount = document.querySelector("[data-pagination]");
        if (!mount || !meta) {
            return;
        }

        if ((meta.last_page || 1) <= 1) {
            mount.innerHTML = "";
            return;
        }

        const links = [];

        for (let page = 1; page <= meta.last_page; page += 1) {
            links.push(`
                <a class="psg-page-pill ${page === meta.current_page ? "active" : ""}" href="${buildCatalogPageUrl(page)}">${page}</a>
            `);
        }

        mount.innerHTML = links.join("");
    }

    function formatCatalogPriceLabel(value) {
        return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
    }

    function syncCatalogPriceRange(form, params) {
        const rangeRoot = form.querySelector("[data-price-range]");
        if (!rangeRoot) {
            return;
        }

        const minInput = rangeRoot.querySelector("[data-price-min]");
        const maxInput = rangeRoot.querySelector("[data-price-max]");
        const minLabel = rangeRoot.querySelector("[data-price-min-label]");
        const maxLabel = rangeRoot.querySelector("[data-price-max-label]");
        const progress = rangeRoot.querySelector("[data-price-range-progress]");

        if (!minInput || !maxInput || !minLabel || !maxLabel || !progress) {
            return;
        }

        const minBound = Number(minInput.min || 0);
        const maxBound = Number(maxInput.max || 1000000);
        const initialMin = params.get("min_price");
        const initialMax = params.get("max_price");
        let activeHandle = "min";

        minInput.value = initialMin === null || initialMin === "" ? String(minBound) : String(Math.max(minBound, Math.min(Number(initialMin || minBound), maxBound)));
        maxInput.value = initialMax === null || initialMax === "" ? String(maxBound) : String(Math.max(minBound, Math.min(Number(initialMax || maxBound), maxBound)));

        function render() {
            let minValue = Number(minInput.value || minBound);
            let maxValue = Number(maxInput.value || maxBound);

            if (minValue > maxValue) {
                if (activeHandle === "min") {
                    maxValue = minValue;
                    maxInput.value = String(maxValue);
                } else {
                    minValue = maxValue;
                    minInput.value = String(minValue);
                }
            }

            minLabel.textContent = formatCatalogPriceLabel(minValue);
            maxLabel.textContent = formatCatalogPriceLabel(maxValue);

            const startPercent = ((minValue - minBound) / (maxBound - minBound)) * 100;
            const endPercent = ((maxValue - minBound) / (maxBound - minBound)) * 100;

            progress.style.left = `${startPercent}%`;
            progress.style.width = `${Math.max(0, endPercent - startPercent)}%`;
        }

        if (rangeRoot.dataset.psgPriceRangeReady !== "true") {
            rangeRoot.dataset.psgPriceRangeReady = "true";

            minInput.addEventListener("input", () => {
                activeHandle = "min";
                render();
            });

            maxInput.addEventListener("input", () => {
                activeHandle = "max";
                render();
            });
        }

        render();
    }

    function syncCatalogFilterForm(categories) {
        const form = document.getElementById("catalog-filters");
        if (!form) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const categoryMount = form.querySelector("[data-category-options]");

        if (categoryMount) {
            const currentCategory = params.get("category") || "";
            categoryMount.innerHTML = [
                `<label class="psg-check-row"><input type="radio" name="category" value="" ${currentCategory === "" ? "checked" : ""}> Tất cả danh mục</label>`,
                ...categories.map((category) => `
                    <label class="psg-check-row">
                        <input type="radio" name="category" value="${escapeHtml(category.slug)}" ${currentCategory === category.slug ? "checked" : ""}>
                        ${escapeHtml(category.name)}
                    </label>
                `),
            ].join("");
        }

        ["keyword"].forEach((name) => {
            const field = form.elements.namedItem(name);
            if (field) {
                field.value = params.get(name) || "";
            }
        });

        syncCatalogPriceRange(form, params);

        const sortField = form.elements.namedItem("sort");
        if (sortField) {
            sortField.value = normalizeCatalogSort(params.get("sort"));
        }

        if (form.dataset.psgCatalogFilterReady === "true") {
            return;
        }

        form.dataset.psgCatalogFilterReady = "true";
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const nextParams = new URLSearchParams();
            const formData = new FormData(form);

            formData.forEach((value, key) => {
                const stringValue = String(value || "").trim();
                if (!stringValue) {
                    return;
                }

                if (key === "sort" && normalizeCatalogSort(stringValue) === DEFAULT_CATALOG_SORT) {
                    return;
                }

                if (key === "min_price" && Number(stringValue) <= 0) {
                    return;
                }

                if (key === "max_price" && Number(stringValue) >= 1000000) {
                    return;
                }

                nextParams.set(key, stringValue);
            });

            nextParams.delete("page");
            window.location.search = nextParams.toString();
        });

        sortField?.addEventListener("change", () => {
            form.requestSubmit();
        });
    }

    function renderEnhancedReviewCards(reviews) {
        if (!reviews?.length) {
            return `
                <article class="psg-review-card">
                    <h3>Chưa có đánh giá</h3>
                    <p>Sản phẩm này chưa có đánh giá mới. Bạn có thể quay lại sau để xem thêm phản hồi.</p>
                </article>
            `;
        }

        return reviews.map((review) => {
            const reviewRating = clampRating(review.rating || 0);
            const reviewDate = review.created_at ? escapeHtml(review.created_at) : "";

            return `
                <article class="psg-review-card">
                    <div class="psg-review-head">
                        <div class="psg-review-stars">
                            ${renderStarRating(reviewRating, {
                                allowHalf: false,
                                label: `${formatRatingValue(reviewRating)} trên 5 sao`,
                            })}
                        </div>
                        ${reviewDate ? `<span>${reviewDate}</span>` : ""}
                    </div>
                    <p>${escapeHtml(review.comment || "Khách hàng đã đánh giá không kèm bình luận.")}</p>
                </article>
            `;
        }).join("");
    }

    function renderInteractiveDetailGallery(product) {
        const images = (product.images?.length ? product.images : (product.primary_image ? [product.primary_image] : []))
            .filter(Boolean);
        const mainImage = images[0];

        if (!mainImage) {
            return `
                <div class="psg-detail-gallery">
                    <div class="psg-detail-gallery-main">
                        <div class="psg-product-art">
                            <i class="fa-solid fa-paw"></i>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="psg-detail-gallery" data-detail-gallery>
                <div
                    class="psg-detail-gallery-main ${images.length > 1 ? "is-interactive" : ""}"
                    ${images.length > 1 ? 'data-gallery-stage tabindex="0" role="button" aria-label="Nhấn để xem ảnh tiếp theo"' : ""}
                >
                    <img
                        class="psg-detail-photo"
                        data-gallery-main
                        src="${escapeHtml(mainImage)}"
                        alt="${escapeHtml(product.name)}"
                    >
                    ${images.length > 1 ? `
                        <button class="psg-gallery-nav is-prev" type="button" data-gallery-prev aria-label="Ảnh trước">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <button class="psg-gallery-nav is-next" type="button" data-gallery-next aria-label="Ảnh tiếp theo">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                        <span class="psg-gallery-hint">Nhấn vào ảnh để chuyển</span>
                    ` : ""}
                </div>
                <div class="psg-thumb-row">
                    ${images.map((image, index) => `
                        <button
                            class="psg-thumb ${index === 0 ? "is-active" : ""}"
                            type="button"
                            data-gallery-thumb
                            data-gallery-index="${index}"
                            data-gallery-image="${escapeHtml(image)}"
                            aria-label="Chuyển đến ảnh ${index + 1}"
                            aria-pressed="${index === 0 ? "true" : "false"}"
                        >
                            <img class="psg-thumb-photo" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">
                        </button>
                    `).join("")}
                </div>
            </div>
        `;
    }

    function initDetailGallery(scope) {
        const root = scope || document;

        root.querySelectorAll("[data-detail-gallery]").forEach((gallery) => {
            if (gallery.dataset.psgGalleryReady === "true") {
                return;
            }

            const stage = gallery.querySelector("[data-gallery-stage]");
            const mainPhoto = gallery.querySelector("[data-gallery-main]");
            const thumbButtons = Array.from(gallery.querySelectorAll("[data-gallery-thumb]"));

            if (!mainPhoto || thumbButtons.length <= 1) {
                gallery.dataset.psgGalleryReady = "true";
                return;
            }

            gallery.dataset.psgGalleryReady = "true";

            const images = thumbButtons.map((thumb) => ({
                src: thumb.dataset.galleryImage || "",
                alt: thumb.querySelector("img")?.alt || mainPhoto.alt || "",
            })).filter((item) => item.src);

            if (images.length <= 1) {
                return;
            }

            let currentIndex = 0;
            let direction = 1;
            let intervalId = null;

            function render(index) {
                currentIndex = Math.max(0, Math.min(index, images.length - 1));
                const currentImage = images[currentIndex];

                mainPhoto.src = currentImage.src;
                mainPhoto.alt = currentImage.alt;

                thumbButtons.forEach((thumb, thumbIndex) => {
                    const isActive = thumbIndex === currentIndex;
                    thumb.classList.toggle("is-active", isActive);
                    thumb.setAttribute("aria-pressed", isActive ? "true" : "false");
                });
            }

            function updateDirectionForIndex(index) {
                if (index <= 0) {
                    direction = 1;
                    return;
                }

                if (index >= images.length - 1) {
                    direction = -1;
                }
            }

            function moveBy(step) {
                let nextIndex = currentIndex + step;

                if (nextIndex < 0) {
                    nextIndex = images.length - 1;
                } else if (nextIndex >= images.length) {
                    nextIndex = 0;
                }

                updateDirectionForIndex(nextIndex);
                render(nextIndex);
            }

            function moveAuto() {
                let nextIndex = currentIndex + direction;

                if (nextIndex >= images.length) {
                    direction = -1;
                    nextIndex = currentIndex + direction;
                } else if (nextIndex < 0) {
                    direction = 1;
                    nextIndex = currentIndex + direction;
                }

                render(nextIndex);
            }

            function stopAutoPlay() {
                if (intervalId) {
                    window.clearInterval(intervalId);
                    intervalId = null;
                }
            }

            function startAutoPlay() {
                stopAutoPlay();
                intervalId = window.setInterval(moveAuto, 3200);
            }

            thumbButtons.forEach((thumb, index) => {
                thumb.addEventListener("click", () => {
                    updateDirectionForIndex(index);
                    render(index);
                    startAutoPlay();
                });
            });

            gallery.querySelector("[data-gallery-prev]")?.addEventListener("click", (event) => {
                event.stopPropagation();
                direction = -1;
                moveBy(-1);
                startAutoPlay();
            });

            gallery.querySelector("[data-gallery-next]")?.addEventListener("click", (event) => {
                event.stopPropagation();
                direction = 1;
                moveBy(1);
                startAutoPlay();
            });

            stage?.addEventListener("click", (event) => {
                if (event.target.closest("[data-gallery-prev], [data-gallery-next]")) {
                    return;
                }

                direction = 1;
                moveBy(1);
                startAutoPlay();
            });

            stage?.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    direction = 1;
                    moveBy(1);
                    startAutoPlay();
                }

                if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    direction = -1;
                    moveBy(-1);
                    startAutoPlay();
                }

                if (event.key === "ArrowRight") {
                    event.preventDefault();
                    direction = 1;
                    moveBy(1);
                    startAutoPlay();
                }
            });

            gallery.addEventListener("mouseenter", stopAutoPlay);
            gallery.addEventListener("mouseleave", startAutoPlay);
            gallery.addEventListener("focusin", stopAutoPlay);
            gallery.addEventListener("focusout", () => {
                if (!gallery.contains(document.activeElement)) {
                    startAutoPlay();
                }
            });

            render(0);
            startAutoPlay();
        });
    }

    function initDetailQuantity(scope) {
        const root = scope || document;

        root.querySelectorAll("[data-detail-quantity]").forEach((control) => {
            if (control.dataset.psgQuantityReady === "true") {
                return;
            }

            const decreaseButton = control.querySelector("[data-qty-decrease]");
            const increaseButton = control.querySelector("[data-qty-increase]");
            const valueNode = control.querySelector("[data-qty-value]");
            const detailCard = control.closest(".psg-detail-card");
            const addButton = detailCard?.querySelector("[data-add-to-cart]");
            const availableStock = Math.max(0, Math.floor(Number(control.dataset.availableStock || 0)));
            const maxQuantity = Math.max(1, Math.floor(Number(control.dataset.maxQuantity || availableStock || 1)));
            let currentQuantity = Math.max(1, Math.min(Math.floor(Number(control.dataset.initialQuantity || 1)), maxQuantity));

            function render() {
                if (valueNode) {
                    valueNode.textContent = String(currentQuantity);
                }

                control.dataset.currentQuantity = String(currentQuantity);

                if (addButton) {
                    addButton.dataset.productQuantity = String(currentQuantity);
                }

                if (decreaseButton) {
                    decreaseButton.disabled = currentQuantity <= 1;
                }

                if (increaseButton) {
                    increaseButton.disabled = availableStock <= 0 || currentQuantity >= maxQuantity;
                }
            }

            decreaseButton?.addEventListener("click", () => {
                currentQuantity = Math.max(1, currentQuantity - 1);
                render();
            });

            increaseButton?.addEventListener("click", () => {
                if (availableStock <= 0) {
                    return;
                }

                currentQuantity = Math.min(maxQuantity, currentQuantity + 1);
                render();
            });

            control.dataset.psgQuantityReady = "true";
            render();
        });
    }

    function renderEnhancedProductDetail(product) {
        const categoryName = product.category?.name || product.categoryLabel || "Sản phẩm";
        const ratingAverage = clampRating(product.rating_average || 0);
        const ratingCount = Number(product.rating_count || 0);
        const ratingText = ratingCount > 0 ? formatRatingValue(ratingAverage) : "Chưa có đánh giá";
        const isOutOfStock = Number(product.stock || 0) <= 0;
        const stockQuantity = Math.max(0, Math.floor(Number(product.stock || 0)));
        const maxQuantity = Math.max(1, stockQuantity);

        return `
            <article class="psg-detail-card">
                ${renderInteractiveDetailGallery(product)}
                <div class="psg-detail-copy">
                    <span class="psg-pill">${escapeHtml(categoryName)}</span>
                    <h1>${escapeHtml(product.name)}</h1>
                    <div class="psg-rating-row">
                        <span class="psg-rating-value">
                            ${renderStarRating(ratingAverage, {
                                allowHalf: true,
                                label: ratingCount > 0 ? `${ratingText} với ${ratingCount} đánh giá` : "Chưa có đánh giá",
                            })}
                            <span>${escapeHtml(ratingText)}</span>
                        </span>
                        <span>${escapeHtml(ratingCount)} đánh giá</span>
                    </div>
                    <div class="psg-price-row">
                        <strong class="psg-price-now">${formatPrice(product.price)}</strong>
                    </div>
                    <p class="psg-detail-summary">${escapeHtml(product.short_description || product.description || "Đang cập nhật mô tả sản phẩm.")}</p>
                    <div class="psg-detail-actions">
                        <div
                            class="psg-qty-box psg-qty-selector"
                            data-detail-quantity
                            data-available-stock="${escapeHtml(stockQuantity)}"
                            data-max-quantity="${escapeHtml(maxQuantity)}"
                            data-initial-quantity="1"
                        >
                            <span class="psg-qty-label">Số lượng</span>
                            <button class="psg-qty-btn" type="button" data-qty-decrease aria-label="Giảm số lượng">-</button>
                            <output class="psg-qty-value" data-qty-value aria-live="polite">1</output>
                            <button class="psg-qty-btn" type="button" data-qty-increase aria-label="Tăng số lượng">+</button>
                        </div>
                        <button
                            class="psg-btn psg-btn-primary"
                            type="button"
                            data-add-to-cart
                            data-product-id="${escapeHtml(product.id)}"
                            data-product-slug="${escapeHtml(product.slug)}"
                            data-product-name="${escapeHtml(product.name)}"
                            data-product-price="${escapeHtml(product.price)}"
                            data-product-image="${escapeHtml(product.primary_image || "")}"
                            data-product-category="${escapeHtml(product.category?.slug || product.category || "")}"
                            data-product-category-label="${escapeHtml(categoryName)}"
                            data-product-stock="${escapeHtml(product.stock || 0)}"
                            data-product-quantity="1"
                            ${isOutOfStock ? "disabled" : ""}
                        >
                            ${isOutOfStock ? "Tạm hết hàng" : "Thêm vào giỏ"}
                        </button>
                    </div>
                </div>
            </article>

            <section class="psg-detail-tabs">
                <h2>Mô tả sản phẩm</h2>
                <p>${escapeHtml(product.description || "Mô tả đang được cập nhật.")}</p>
                <div class="psg-review-grid">
                    ${renderEnhancedReviewCards(product.reviews)}
                </div>
            </section>
        `;
    }

    function initHeroSlider() {
        const root = document.querySelector("[data-hero-slider]");
        if (!root || root.dataset.psgSliderReady === "true") {
            return;
        }

        const slides = Array.from(root.querySelectorAll(".psg-hero-slide"));
        const track = root.querySelector(".psg-hero-slides");
        const dotsMount = root.querySelector("[data-hero-slider-dots]");

        if (slides.length <= 1 || !track || !dotsMount) {
            return;
        }

        root.dataset.psgSliderReady = "true";

        let currentIndex = 0;
        let intervalId = null;

        function render(index) {
            currentIndex = index;
            track.style.transform = `translateX(-${currentIndex * 100}%)`;

            dotsMount.querySelectorAll("button").forEach((dot, dotIndex) => {
                dot.classList.toggle("is-active", dotIndex === currentIndex);
            });
        }

        function startAutoPlay() {
            intervalId = window.setInterval(() => {
                render((currentIndex + 1) % slides.length);
            }, 3500);
        }

        dotsMount.innerHTML = slides.map((_, index) => `
            <button type="button" aria-label="Chuyển đến banner ${index + 1}" class="${index === 0 ? "is-active" : ""}"></button>
        `).join("");

        dotsMount.querySelectorAll("button").forEach((dot, index) => {
            dot.addEventListener("click", () => {
                window.clearInterval(intervalId);
                render(index);
                startAutoPlay();
            });
        });

        root.addEventListener("mouseenter", () => window.clearInterval(intervalId));
        root.addEventListener("mouseleave", () => {
            window.clearInterval(intervalId);
            startAutoPlay();
        });

        render(0);
        startAutoPlay();
    }

    function syncHeaderSearchValue() {
        const keyword = new URLSearchParams(window.location.search).get("keyword") || "";
        document.querySelectorAll(".psg-search-form input[name='keyword']").forEach((input) => {
            if (!input.value) {
                input.value = keyword;
            }
        });
    }

    async function renderHomePage() {
        const featuredNode = document.querySelector('[data-product-list="featured"]');
        const newestNode = document.querySelector('[data-product-list="new"]');

        if (!featuredNode && !newestNode) {
            return;
        }

        initHeroSlider();

        if (featuredNode) {
            const payload = await getProducts({ limit: 4, sort: "latest" });
            featuredNode.innerHTML = payload.data.length
                ? payload.data.slice(0, 4).map(renderEnhancedProductCard).join("")
                : "";
        }

        if (newestNode) {
            const payload = await getProducts({ limit: 3, sort: "latest" });
            newestNode.innerHTML = payload.data.length
                ? payload.data.slice(0, 3).map(renderEnhancedProductCard).join("")
                : "";
        }
    }

    async function renderCatalogPage() {
        const catalogNode = document.querySelector('[data-product-list="catalog"]');
        if (!catalogNode) {
            return;
        }

        const params = Object.fromEntries(new URLSearchParams(window.location.search).entries());
        const currentSort = normalizeCatalogSort(params.sort);
        const requestParams = buildCatalogRequestParams(params);
        const [categories, payload] = await Promise.all([
            getCategories(),
            getProducts(requestParams),
        ]);

        const products = sortProductsLocally(payload.data, currentSort);

        syncCatalogFilterForm(categories);
        renderResultSummary(payload.meta);
        renderCatalogPagination(payload.meta);

        if (!products.length) {
            renderEmptyState(catalogNode, "Chưa có sản phẩm phù hợp", "Hãy thử đổi từ khóa hoặc bộ lọc để xem thêm sản phẩm.");
            return;
        }

        catalogNode.innerHTML = products.map(renderEnhancedProductCard).join("");
    }

    async function renderDetailPage() {
        const mount = document.querySelector("[data-product-detail]");
        if (!mount) {
            return;
        }

        const slug = new URLSearchParams(window.location.search).get("slug");
        if (!slug) {
            renderEmptyState(mount, "Thiếu thông tin sản phẩm", "Trang chi tiết cần có slug sản phẩm để hiển thị đúng dữ liệu.");
            return;
        }

        const payload = await getProductDetail(slug);

        if (!payload.data) {
            renderEmptyState(mount, "Không tìm thấy sản phẩm", "Hãy quay lại danh mục và chọn lại sản phẩm cần xem.");
            return;
        }

        mount.innerHTML = renderEnhancedProductDetail(payload.data);
        initDetailGallery(mount);
        initDetailQuantity(mount);

        const relatedNode = document.querySelector('[data-product-list="related"]');
        if (relatedNode) {
            const relatedItems = Array.isArray(payload.related) ? payload.related : [];
            relatedNode.innerHTML = relatedItems.length
                ? relatedItems.map(renderEnhancedProductCard).join("")
                : "";
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        syncHeaderSearchValue();
        renderHomePage().catch(console.error);
        renderCatalogPage().catch(console.error);
        renderDetailPage().catch(console.error);
    });

    document.addEventListener("psg:layout-ready", () => {
        syncHeaderSearchValue();
    });

    document.addEventListener("click", async (event) => {
        const wishlistBtn = event.target.closest("[data-add-to-wishlist]");
        if (wishlistBtn) {
            event.preventDefault();
            const productId = wishlistBtn.dataset.productId;
            
            if (window.CustomerEngagementShared) {
                 if (!window.CustomerEngagementShared.getAuthUser()) {
                     window.CustomerEngagementShared.openLoginModal('Vui lòng đăng nhập để thêm vào wishlist.');
                     return;
                 }
                 try {
                     wishlistBtn.disabled = true;
                     const response = await window.CustomerEngagementShared.apiFetch('/engagement/wishlist', {
                         method: 'POST',
                         body: { product_id: productId },
                         requiresAuth: true
                     });
                     
                     if (response.wishlist_count !== undefined) {
                         window.CustomerEngagementShared.setWishlistCount(response.wishlist_count);
                     }
                     if (response.action === 'added') {
                         wishlistBtn.classList.add('is-active');
                         wishlistBtn.querySelector('i').style.color = '#e74c3c';
                     } else if (response.action === 'removed') {
                         wishlistBtn.classList.remove('is-active');
                         wishlistBtn.querySelector('i').style.color = '#bbb';
                     }
                     if (window.toastr) {
                         window.toastr.success(response.message || 'Đã cập nhật wishlist.');
                     } else {
                         alert(response.message || 'Đã cập nhật wishlist.');
                     }
                 } catch (error) {
                     if (window.toastr) {
                         window.toastr.error(error.message || 'Lỗi thêm wishlist');
                     } else {
                         alert(error.message || 'Lỗi thêm wishlist');
                     }
                 } finally {
                     wishlistBtn.disabled = false;
                 }
            } else if (window.PSGCart) {
                 const authUser = window.PSGCart.getAuthUser();
                 if (!authUser) {
                     window.location.href = './login.html?auth=required';
                     return;
                 }
                 try {
                     wishlistBtn.disabled = true;
                     const payload = await window.PSGCart.requestJson('/engagement/wishlist', {
                         method: 'POST',
                         body: { product_id: productId, email: authUser.email }
                     });
                     if (payload.action === 'added') {
                         wishlistBtn.classList.add('is-active');
                         wishlistBtn.querySelector('i').style.color = '#e74c3c';
                     } else if (payload.action === 'removed') {
                         wishlistBtn.classList.remove('is-active');
                         wishlistBtn.querySelector('i').style.color = '#bbb';
                     }
                     if (window.toastr) {
                         window.toastr.success(payload.message || 'Đã cập nhật wishlist.');
                     } else {
                         alert(payload.message || 'Đã cập nhật wishlist.');
                     }
                 } catch (error) {
                     if (window.toastr) {
                         window.toastr.error(error.message || 'Lỗi thêm wishlist');
                     } else {
                         alert(error.message || 'Lỗi thêm wishlist');
                     }
                 } finally {
                     wishlistBtn.disabled = false;
                 }
            }
        }
    });

})();
