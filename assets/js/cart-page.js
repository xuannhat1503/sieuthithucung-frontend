(function () {
    function renderCouponMessage(summary) {
        const mount = document.querySelector("[data-coupon-message]");
        if (!mount || !window.PSGCart) {
            return;
        }

        if (!summary.couponCode) {
            mount.innerHTML = "<p class='psg-cart-help'>Chua ap dung ma giam gia.</p>";
            return;
        }

        mount.innerHTML = `
            <div class="psg-cart-message ${summary.couponState.valid ? "is-success" : "is-error"}">
                <strong>${window.PSGCart.escapeHtml(summary.couponCode)}</strong>
                <p>${window.PSGCart.escapeHtml(summary.couponState.message)}</p>
            </div>
        `;
    }

    function renderSummary(summary) {
        const mount = document.querySelector("[data-cart-summary]");
        const loginNote = document.querySelector("[data-cart-login-note]");
        if (!mount || !window.PSGCart) {
            return;
        }

        mount.innerHTML = `
            <div class="psg-order-summary">
                <div><span>Tam tinh</span><strong>${window.PSGCart.formatPrice(summary.subtotal)}</strong></div>
                <div><span>Giam gia</span><strong>-${window.PSGCart.formatPrice(summary.discount)}</strong></div>
                <div><span>Phi van chuyen</span><strong>${window.PSGCart.formatPrice(summary.shippingFee)}</strong></div>
                <div><span>Thue VAT (8%)</span><strong>${window.PSGCart.formatPrice(summary.tax)}</strong></div>
                <div class="is-total"><span>Tong thanh toan</span><strong>${window.PSGCart.formatPrice(summary.total)}</strong></div>
            </div>
        `;

        if (loginNote) {
            const authUser = window.PSGCart.getAuthUser();
            loginNote.innerHTML = authUser
                ? "<p class='psg-cart-help'>Ban da dang nhap va co the tiep tuc thanh toan.</p>"
                : "<p class='psg-cart-message is-warning'>Ban can dang nhap tai khoan khach hang truoc khi thanh toan.</p>";
        }
    }

    function renderCartItems(cart) {
        const mount = document.querySelector("[data-cart-content]");
        if (!mount || !window.PSGCart) {
            return;
        }

        if (!cart.length) {
            mount.innerHTML = `
                <div class="psg-empty-state psg-cart-empty">
                    <i class="fa-solid fa-cart-shopping"></i>
                    <h3>Gio hang dang trong</h3>
                    <p>Hay them san pham tu trang chu, danh sach san pham hoac trang chi tiet san pham.</p>
                </div>
            `;
            return;
        }

        mount.innerHTML = `
            <div class="psg-cart-list">
                ${cart.map((item) => `
                    <article class="psg-cart-item">
                        <div class="psg-cart-item-top">
                            <div class="psg-cart-product">
                                <div class="psg-cart-product-media">
                                    ${item.primary_image
                                        ? `<img src="${window.PSGCart.escapeHtml(item.primary_image)}" alt="${window.PSGCart.escapeHtml(item.name)}">`
                                        : `<div class="psg-product-art"><i class="fa-solid fa-paw"></i></div>`}
                                </div>
                                <div class="psg-cart-product-copy">
                                    <strong>${window.PSGCart.escapeHtml(item.name)}</strong>
                                    <span>${window.PSGCart.escapeHtml(item.categoryLabel || "San pham")}</span>
                                </div>
                            </div>
                        </div>
                        <div class="psg-cart-item-bottom">
                            <div class="psg-cart-metrics">
                                <div class="psg-cart-metric">
                                    <label>Don gia</label>
                                    <strong>${window.PSGCart.formatPrice(item.price)}</strong>
                                </div>
                                <div class="psg-cart-metric">
                                    <label>So luong</label>
                                    <div class="psg-cart-qty">
                                        <button type="button" data-cart-decrease="${window.PSGCart.escapeHtml(item.slug)}">-</button>
                                        <span>${Number(item.quantity || 1)}</span>
                                        <button type="button" data-cart-increase="${window.PSGCart.escapeHtml(item.slug)}">+</button>
                                    </div>
                                </div>
                                <div class="psg-cart-metric">
                                    <label>Thanh tien</label>
                                    <strong>${window.PSGCart.formatPrice(Number(item.price || 0) * Number(item.quantity || 1))}</strong>
                                </div>
                                <div class="psg-cart-metric psg-cart-metric-action">
                                    <label>Tac vu</label>
                                    <button class="psg-cart-remove" type="button" data-cart-remove="${window.PSGCart.escapeHtml(item.slug)}">Xoa</button>
                                </div>
                            </div>
                        </div>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function renderPage() {
        if (!window.PSGCart || !document.querySelector("[data-cart-page]")) {
            return;
        }

        const cart = window.PSGCart.readCart();
        const summary = window.PSGCart.calculateSummary(cart, window.PSGCart.readCouponCode());
        renderCartItems(cart);
        renderSummary(summary);
        renderCouponMessage(summary);

        const couponInput = document.querySelector("[name='coupon_code']");
        if (couponInput) {
            couponInput.value = summary.couponCode || "";
        }
    }

    document.addEventListener("submit", (event) => {
        const couponForm = event.target.closest("[data-coupon-form]");
        if (!couponForm || !window.PSGCart) {
            return;
        }

        event.preventDefault();
        const formData = new FormData(couponForm);
        window.PSGCart.saveCouponCode(formData.get("coupon_code"));
    });

    document.addEventListener("click", async (event) => {
        if (!window.PSGCart || !document.querySelector("[data-cart-page]")) {
            return;
        }

        const increaseButton = event.target.closest("[data-cart-increase]");
        const decreaseButton = event.target.closest("[data-cart-decrease]");
        const removeButton = event.target.closest("[data-cart-remove]");
        const clearButton = event.target.closest("[data-clear-cart]");

        try {
            if (increaseButton) {
                const slug = increaseButton.getAttribute("data-cart-increase");
                const item = window.PSGCart.readCart().find((entry) => entry.slug === slug);
                if (item) {
                    await window.PSGCart.updateQuantity(slug, Number(item.quantity || 1) + 1);
                }
                return;
            }

            if (decreaseButton) {
                const slug = decreaseButton.getAttribute("data-cart-decrease");
                const item = window.PSGCart.readCart().find((entry) => entry.slug === slug);
                if (!item) {
                    return;
                }

                if (Number(item.quantity || 1) <= 1) {
                    await window.PSGCart.removeItem(slug);
                } else {
                    await window.PSGCart.updateQuantity(slug, Number(item.quantity || 1) - 1);
                }
                return;
            }

            if (removeButton) {
                await window.PSGCart.removeItem(removeButton.getAttribute("data-cart-remove"));
                return;
            }

            if (clearButton) {
                await window.PSGCart.clearCart();
            }
        } catch (error) {
            if (window.toastr) {
                window.toastr.error(error.message || "Khong the cap nhat gio hang luc nay.");
            }
        }
    });

    document.addEventListener("DOMContentLoaded", async () => {
        if (!document.querySelector("[data-cart-page]") || !window.PSGCart) {
            return;
        }

        await window.PSGCart.ready;
        renderPage();
    });

    document.addEventListener("psg:cart-updated", renderPage);
    document.addEventListener("psg:coupon-updated", renderPage);
    document.addEventListener("psg:auth-updated", renderPage);
})();
