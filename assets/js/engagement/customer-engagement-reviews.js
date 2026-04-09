const shared = window.CustomerEngagementShared;

document.addEventListener('DOMContentLoaded', () => {
    shared.bindLoginModal({
        onSuccess: () => loadReviews('Đăng nhập thành công.'),
    });

    shared.bindWishlistLinks();
    loadReviews();
});

async function loadReviews(statusMessage = '') {
    if (statusMessage) {
        shared.setStatus('status', statusMessage, 'success');
    } else {
        shared.setStatus('status', '', 'info');
    }

    const wrap = document.getElementById('review-products');
    if (!wrap) {
        return;
    }

    if (!shared.getAuthUser()) {
        shared.setWishlistCount(0);
        wrap.innerHTML = shared.renderLoginRequired('Vui lòng đăng nhập để xem sản phẩm trong đơn hàng đã hoàn thành và gửi đánh giá.');
        shared.attachLoginPrompts();
        return;
    }

    try {
        const payload = await shared.apiFetch('/engagement/reviews', {
            requiresAuth: true,
        });

        if (payload.current_user) {
            shared.saveAuthUser(payload.current_user);
        }

        shared.setWishlistCount(payload.wishlist_count || 0);
        renderPurchasedProducts(payload.purchased_products || []);
    } catch (error) {
        if (error.status === 401) {
            wrap.innerHTML = shared.renderLoginRequired('Vui lòng đăng nhập để xem sản phẩm trong đơn hàng đã hoàn thành và gửi đánh giá.');
            shared.attachLoginPrompts();
            shared.setStatus('status', error.message || 'Bạn cần đăng nhập.', 'error');
            return;
        }

        shared.setStatus('status', error.message || 'Không tải được danh sách sản phẩm đã mua.', 'error');
    }
}

function renderPurchasedProducts(products) {
    const wrap = document.getElementById('review-products');
    if (!wrap) {
        return;
    }

    if (!Array.isArray(products) || products.length === 0) {
        wrap.innerHTML = `
            <article class="ec-empty-note">
                <strong>Chưa có sản phẩm đủ điều kiện đánh giá</strong>
                <p>Chỉ các sản phẩm nằm trong đơn hàng đã hoàn thành mới hiện ở đây để đánh giá.</p>
            </article>
        `;
        return;
    }

    wrap.innerHTML = products.map((product) => {
        const image = shared.resolveImage(product.image);
        const myRating = Number(product.my_review?.rating || 5);
        const comments = Array.isArray(product.comments) && product.comments.length > 0
            ? product.comments.map((item) => `
                <article class="ec-feed-item">
                    <div class="ec-feed-top">
                        <strong>${shared.escapeHtml(item.user_name || 'Khách hàng')}</strong>
                        <small class="ec-meta">${shared.formatDate(item.created_at)}</small>
                    </div>
                    <div class="ec-feed-stars">
                        ${[1, 2, 3, 4, 5].map((star) => `<i class="fa-solid fa-star ${star <= Number(item.rating) ? 'filled' : ''}"></i>`).join('')}
                    </div>
                    <p>${shared.escapeHtml(item.comment || 'Khách hàng đã để lại đánh giá.')}</p>
                </article>
            `).join('')
            : '<div class="ec-empty-note">Chưa có bình luận nào cho sản phẩm này.</div>';

        return `
            <article class="ec-card ec-purchased-card" data-product-id="${product.id}">
                <div class="ec-purchased-head">
                    <div class="ec-purchased-visual">
                        ${image
                            ? `<img src="${image}" alt="${shared.escapeHtml(product.name)}">`
                            : `<div class="ec-product-placeholder"><span>${shared.escapeHtml((product.name || 'P').slice(0, 1).toUpperCase())}</span></div>`}
                    </div>
                    <div class="ec-purchased-info">
                        <div class="ec-row-between ec-meta">
                            <span class="ec-product-badge">${shared.escapeHtml(product.category_name || 'PETSAIGON')}</span>
                            <span>${shared.escapeHtml(product.avg_rating || 0)}/5 - ${shared.escapeHtml(product.review_count || 0)} review</span>
                        </div>
                        <h3>${shared.escapeHtml(product.name)}</h3>
                        <p>${shared.escapeHtml(product.description || '')}</p>
                        <div class="ec-purchased-meta">
                            <span><strong>Số lượng đã mua:</strong> ${shared.escapeHtml(product.purchased_quantity || 0)}</span>
                            <span><strong>Lần mua gần nhất:</strong> ${shared.formatDate(product.last_purchased_at)}</span>
                            <span><strong>Giá:</strong> ${shared.formatPrice(product.price)}</span>
                        </div>
                    </div>
                </div>
                <div class="ec-purchased-body">
                    <section>
                        <h4 class="ec-subtitle">Đánh giá của bạn</h4>
                        <form class="ec-form-stack js-review-form">
                            <input type="hidden" name="product_id" value="${product.id}">
                            <label>Số sao
                                <div class="ec-rating-row">
                                    ${[5, 4, 3, 2, 1].map((star) => `
                                        <label class="ec-rating-chip">
                                            <input type="radio" name="rating" value="${star}" ${star === myRating ? 'checked' : ''}>
                                            <span>${star} <i class="fa-solid fa-star"></i></span>
                                        </label>
                                    `).join('')}
                                </div>
                            </label>
                            <label>Bình luận
                                <textarea name="comment" rows="5" placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này.">${shared.escapeHtml(product.my_review?.comment || '')}</textarea>
                            </label>
                            <button type="submit" class="ec-btn ec-btn-primary">${product.my_review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button>
                        </form>
                    </section>
                    <section>
                        <h4 class="ec-subtitle">Bình luận gần đây</h4>
                        <div class="ec-feed">${comments}</div>
                    </section>
                </div>
            </article>
        `;
    }).join('');

    wrap.querySelectorAll('.js-review-form').forEach((form) => {
        form.addEventListener('submit', submitReviewForm);
    });

    focusRequestedProduct();
}

function focusRequestedProduct() {
    const productId = new URLSearchParams(window.location.search).get('product_id');
    if (!productId) {
        return;
    }

    const card = document.querySelector(`[data-product-id="${productId}"]`);
    if (!card) {
        return;
    }

    card.classList.add('ec-card-focus');
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitReviewForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
        const response = await shared.apiFetch('/engagement/reviews', {
            method: 'POST',
            requiresAuth: true,
            body: payload,
        });

        await loadReviews(response.message || 'Gửi đánh giá thành công.');
    } catch (error) {
        if (error.status === 401) {
            shared.openLoginModal('Vui lòng đăng nhập trước khi gửi đánh giá.');
            return;
        }

        shared.setStatus('status', error.message || 'Gửi đánh giá thất bại.', 'error');
    }
}
