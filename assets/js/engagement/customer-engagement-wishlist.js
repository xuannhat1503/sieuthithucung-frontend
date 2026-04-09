const shared = window.CustomerEngagementShared;

document.addEventListener('DOMContentLoaded', () => {
    shared.bindLoginModal({
        onSuccess: () => loadWishlist('Đăng nhập thành công.'),
    });

    shared.bindWishlistLinks();
    loadWishlist();
});

async function loadWishlist(statusMessage = '') {
    if (statusMessage) {
        shared.setStatus('status', statusMessage, 'success');
    } else {
        shared.setStatus('status', '', 'info');
    }

    const wrap = document.getElementById('wishlist-grid');
    if (!wrap) {
        return;
    }

    if (!shared.getAuthUser()) {
        shared.setWishlistCount(0);
        wrap.innerHTML = shared.renderLoginRequired('Vui lòng đăng nhập trước khi xem wishlist.');
        shared.attachLoginPrompts();
        return;
    }

    try {
        const payload = await shared.apiFetch('/engagement/wishlist', {
            requiresAuth: true,
        });

        if (payload.current_user) {
            shared.saveAuthUser(payload.current_user);
        }

        shared.setWishlistCount(payload.wishlist_count || 0);
        renderWishlist(payload.wishlist_items || []);
    } catch (error) {
        if (error.status === 401) {
            wrap.innerHTML = shared.renderLoginRequired('Vui lòng đăng nhập trước khi xem wishlist.');
            shared.attachLoginPrompts();
            shared.setStatus('status', error.message || 'Bạn cần đăng nhập.', 'error');
            return;
        }

        shared.setStatus('status', error.message || 'Không tải được wishlist.', 'error');
    }
}

function renderWishlist(items) {
    const wrap = document.getElementById('wishlist-grid');
    if (!wrap) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        wrap.innerHTML = `
            <article class="ec-empty-note">
                <strong>Wishlist đang trống</strong>
                <p>Tài khoản này chưa có sản phẩm nào trong wishlist.</p>
            </article>
        `;
        return;
    }

    wrap.innerHTML = items.map((item) => {
        const image = shared.resolveImage(item.image);
        const detailHref = item.slug ? `./product-detail.html?slug=${encodeURIComponent(item.slug)}` : './products.html';

        return `
            <article class="ec-product-card">
                <div class="ec-product-visual">
                    ${image
                        ? `<img src="${image}" alt="${shared.escapeHtml(item.name)}">`
                        : `<div class="ec-product-placeholder"><span>${shared.escapeHtml((item.name || 'P').slice(0, 1).toUpperCase())}</span></div>`}
                </div>
                <div class="ec-product-body">
                    <div class="ec-product-meta">
                        <span class="ec-product-badge">${shared.escapeHtml(item.category_name || 'PETSAIGON')}</span>
                        <span>${shared.escapeHtml(item.review_count || 0)} review</span>
                    </div>
                    <h4>${shared.escapeHtml(item.name)}</h4>
                    <p>${shared.escapeHtml(item.description || '')}</p>
                    <div class="ec-row-between" style="margin-top: 14px;">
                        <span class="ec-price">${shared.formatPrice(item.price)}</span>
                        <span class="ec-meta">${shared.formatDate(item.wishlisted_at)}</span>
                    </div>
                    <div style="margin-top: 18px;">
                        <a class="ec-btn ec-btn-secondary" href="${detailHref}">Xem sản phẩm</a>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}