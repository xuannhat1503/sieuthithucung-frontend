(function () {
    const API_BASE_STORAGE_KEY = "psg-api-base";
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

        return reviews.slice(0, 2).map((review, index) => `
            <article class="psg-review-card">
                <h3>Đánh giá ${index + 1}</h3>
                <p>${escapeHtml(review.comment || "Khách hàng đã đánh giá không kèm bình luận.")}</p>
            </article>
        `).join("");
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
                ? payload.data.slice(0, 4).map(renderProductCard).join("")
                : "";
        }

        if (newestNode) {
            const payload = await getProducts({ limit: 3, sort: "latest" });
            newestNode.innerHTML = payload.data.length
                ? payload.data.slice(0, 3).map(renderProductCard).join("")
                : "";
        }
    }

    async function renderCatalogPage() {
        const catalogNode = document.querySelector('[data-product-list="catalog"]');
        if (!catalogNode) {
            return;
        }

        const params = Object.fromEntries(new URLSearchParams(window.location.search).entries());
        const [categories, payload] = await Promise.all([
            getCategories(),
            getProducts(params),
        ]);

        syncFilterForm(categories);
        renderResultSummary(payload.meta);
        renderPagination(payload.meta);

        if (!payload.data.length) {
            renderEmptyState(catalogNode, "Chưa có sản phẩm phù hợp", "Hãy thử đổi từ khóa hoặc bộ lọc để xem thêm sản phẩm.");
            return;
        }

        catalogNode.innerHTML = payload.data.map(renderProductCard).join("");
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

        mount.innerHTML = renderProductDetail(payload.data);

        const relatedNode = document.querySelector('[data-product-list="related"]');
        if (relatedNode) {
            const relatedItems = Array.isArray(payload.related) ? payload.related : [];
            relatedNode.innerHTML = relatedItems.length
                ? relatedItems.map(renderProductCard).join("")
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
})();
