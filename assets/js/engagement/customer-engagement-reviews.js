const shared = window.CustomerEngagementShared;

document.addEventListener('DOMContentLoaded', () => {
    shared.bindLoginModal({
        onSuccess: () => loadReviews('Dang nhap thanh cong.'),
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
        wrap.innerHTML = shared.renderLoginRequired('Vui long dang nhap de xem san pham trong don hang da hoan thanh va gui danh gia.');
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
            wrap.innerHTML = shared.renderLoginRequired('Vui long dang nhap de xem san pham trong don hang da hoan thanh va gui danh gia.');
            shared.attachLoginPrompts();
            shared.setStatus('status', error.message || 'Ban can dang nhap.', 'error');
            return;
        }

        shared.setStatus('status', error.message || 'Khong tai duoc danh sach san pham da mua.', 'error');
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
                <strong>Chua co san pham du dieu kien danh gia</strong>
                <p>Chi cac san pham nam trong don hang da hoan thanh moi hien o day de danh gia.</p>
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
                        <strong>${shared.escapeHtml(item.user_name || 'Khach hang')}</strong>
                        <small class="ec-meta">${shared.formatDate(item.created_at)}</small>
                    </div>
                    <div class="ec-feed-stars">
                        ${[1, 2, 3, 4, 5].map((star) => `<i class="fa-solid fa-star ${star <= Number(item.rating) ? 'filled' : ''}"></i>`).join('')}
                    </div>
                    <p>${shared.escapeHtml(item.comment || 'Khach hang da de lai danh gia.')}</p>
                </article>
            `).join('')
            : '<div class="ec-empty-note">Chua co binh luan nao cho san pham nay.</div>';

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
                            <span><strong>So luong da mua:</strong> ${shared.escapeHtml(product.purchased_quantity || 0)}</span>
                            <span><strong>Lan mua gan nhat:</strong> ${shared.formatDate(product.last_purchased_at)}</span>
                            <span><strong>Gia:</strong> ${shared.formatPrice(product.price)}</span>
                        </div>
                    </div>
                </div>
                <div class="ec-purchased-body">
                    <section>
                        <h4 class="ec-subtitle">Danh gia cua ban</h4>
                        <form class="ec-form-stack js-review-form">
                            <input type="hidden" name="product_id" value="${product.id}">
                            <label>So sao
                                <div class="ec-rating-row">
                                    ${[5, 4, 3, 2, 1].map((star) => `
                                        <label class="ec-rating-chip">
                                            <input type="radio" name="rating" value="${star}" ${star === myRating ? 'checked' : ''}>
                                            <span>${star} <i class="fa-solid fa-star"></i></span>
                                        </label>
                                    `).join('')}
                                </div>
                            </label>
                            <label>Binh luan
                                <textarea name="comment" rows="5" placeholder="Chia se trai nghiem cua ban ve san pham nay.">${shared.escapeHtml(product.my_review?.comment || '')}</textarea>
                            </label>
                            <button type="submit" class="ec-btn ec-btn-primary">${product.my_review ? 'Cap nhat danh gia' : 'Gui danh gia'}</button>
                        </form>
                    </section>
                    <section>
                        <h4 class="ec-subtitle">Binh luan gan day</h4>
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

        await loadReviews(response.message || 'Gui danh gia thanh cong.');
    } catch (error) {
        if (error.status === 401) {
            shared.openLoginModal('Vui long dang nhap truoc khi gui danh gia.');
            return;
        }

        shared.setStatus('status', error.message || 'Gui danh gia that bai.', 'error');
    }
}
