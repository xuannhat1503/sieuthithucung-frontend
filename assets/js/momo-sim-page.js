(function () {
    let redirectTimer = null;

    function isMomoPage() {
        return Boolean(document.querySelector("[data-momo-page]"));
    }

    function scheduleHomeRedirect() {
        if (redirectTimer) {
            window.clearTimeout(redirectTimer);
        }

        redirectTimer = window.setTimeout(() => {
            window.location.replace("./home.html");
        }, 1200);
    }

    function setStatus(type, message) {
        const mount = document.querySelector("[data-momo-status]");
        if (!mount || !window.PSGCart) {
            return;
        }

        mount.innerHTML = `
            <div class="psg-cart-message ${type}">
                <p>${window.PSGCart.escapeHtml(message)}</p>
            </div>
        `;
    }

    function paymentStatusLabel(status) {
        if (status === "completed") {
            return "Da thanh toan";
        }

        if (status === "failed") {
            return "Thanh toan that bai";
        }

        return "Dang cho thanh toan";
    }

    function renderPayment(payment) {
        const transactionNode = document.querySelector("[data-momo-transaction]");
        const summaryNode = document.querySelector("[data-momo-summary]");
        if (!payment || !transactionNode || !summaryNode || !window.PSGCart) {
            return;
        }

        transactionNode.textContent = payment.transaction_id || `PAY-${payment.id}`;
        summaryNode.innerHTML = `
            <div class="psg-order-summary">
                <div><span>Ma giao dich</span><strong>${window.PSGCart.escapeHtml(payment.transaction_id || payment.id)}</strong></div>
                <div><span>Trang thai</span><strong>${window.PSGCart.escapeHtml(paymentStatusLabel(payment.status))}</strong></div>
                <div><span>So tien</span><strong>${window.PSGCart.formatPrice(payment.amount)}</strong></div>
                <div><span>Ma don hang</span><strong>PSG-${window.PSGCart.escapeHtml(payment.order_id)}</strong></div>
            </div>
            <div class="psg-mini-list">
                ${(payment.order?.items || []).map((item) => `
                    <div class="psg-mini-item">
                        <span>${window.PSGCart.escapeHtml(item.product?.name || "San pham")} x ${Number(item.quantity || 1)}</span>
                        <strong>${window.PSGCart.formatPrice(Number(item.price || 0) * Number(item.quantity || 1))}</strong>
                    </div>
                `).join("")}
            </div>
        `;
    }

    async function loadPayment() {
        if (!isMomoPage() || !window.PSGCart) {
            return null;
        }

        const paymentId = new URLSearchParams(window.location.search).get("payment_id");
        const authUser = window.PSGCart.getAuthUser();
        if (!paymentId) {
            setStatus("is-error", "Thieu payment_id, khong the tai giao dich MoMo demo.");
            return null;
        }

        try {
            const payload = await window.PSGCart.requestJson(`/payments/momo-sim/${paymentId}?email=${encodeURIComponent(authUser?.email || "")}`);
            renderPayment(payload.data);

            if (payload.data?.status === "completed") {
                setStatus("is-success", "Thanh toan MoMo gia lap da hoan tat. Dang quay ve trang chu...");
                scheduleHomeRedirect();
                return payload.data;
            }

            setStatus("is-warning", "Giao dich dang cho ban xac nhan tren trang MoMo gia lap.");
            return payload.data;
        } catch (error) {
            setStatus("is-error", error.message || "Khong the tai giao dich thanh toan.");
            return null;
        }
    }

    async function updatePayment(action) {
        if (!window.PSGCart) {
            return;
        }

        const paymentId = new URLSearchParams(window.location.search).get("payment_id");
        const authUser = window.PSGCart.getAuthUser();
        if (!paymentId) {
            return;
        }

        try {
            const payload = await window.PSGCart.requestJson(`/payments/momo-sim/${paymentId}/${action}`, {
                method: "POST",
                body: {
                    email: authUser?.email || "",
                },
            });

            renderPayment(payload.data);

            if (action === "complete") {
                await window.PSGCart.init(true);
                setStatus("is-success", "Thanh toan MoMo gia lap thanh cong. Dang quay ve trang chu...");
                scheduleHomeRedirect();
                return;
            }

            setStatus("is-error", "Giao dich da duoc danh dau that bai. Ban co the quay lai trang checkout de thu lai.");
        } catch (error) {
            setStatus("is-error", error.message || "Khong the cap nhat giao dich.");
        }
    }

    document.addEventListener("click", (event) => {
        if (!isMomoPage()) {
            return;
        }

        if (event.target.closest("[data-momo-complete]")) {
            updatePayment("complete");
            return;
        }

        if (event.target.closest("[data-momo-fail]")) {
            updatePayment("fail");
        }
    });

    document.addEventListener("DOMContentLoaded", async () => {
        if (!isMomoPage() || !window.PSGCart) {
            return;
        }

        await window.PSGCart.ready;
        loadPayment();
    });
})();
