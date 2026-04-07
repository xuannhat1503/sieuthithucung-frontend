const shared = window.CustomerEngagementShared;

document.addEventListener('DOMContentLoaded', () => {
    shared.bindLoginModal({
        onSuccess: () => loadPost(),
    });

    shared.bindWishlistLinks();
    loadPost();
});

async function loadPost() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        window.location.href = './customer-engagement.html';
        return;
    }

    try {
        const payload = await shared.apiFetch(`/engagement/blog-posts/${encodeURIComponent(id)}`, {
            requiresAuth: Boolean(shared.getAuthUser()),
        });

        if (!payload.authenticated && shared.getAuthUser()) {
            shared.clearAuthUser();
        }

        if (payload.current_user) {
            shared.saveAuthUser(payload.current_user);
        }

        shared.setWishlistCount(payload.wishlist_count || 0);
        renderPost(payload.post || null);
        renderRecentPosts(payload.recent_posts || []);
        shared.setStatus('status', '', 'info');
    } catch (error) {
        if (error.status === 404) {
            window.location.href = './customer-engagement.html';
            return;
        }

        shared.setStatus('status', error.message || 'Khong tai duoc bai viet.', 'error');
        renderNotFound();
    }
}

function renderPost(post) {
    const wrap = document.getElementById('blog-detail-card');
    if (!wrap) {
        return;
    }

    if (!post) {
        renderNotFound();
        return;
    }

    const image = shared.resolveImage(post.image);
    const paragraphs = String(post.content || '')
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => `<p>${shared.escapeHtml(item)}</p>`)
        .join('');

    wrap.innerHTML = `
        <div class="ec-blog-detail-head">
            <span class="ec-blog-tag">${shared.escapeHtml(post.category || 'Blog PETSAIGON')}</span>
            <h1>${shared.escapeHtml(post.title || 'Chi tiet bai viet')}</h1>
            <div class="ec-blog-meta">
                <span>${shared.escapeHtml(post.read_time || 'Bai viet')}</span>
                <span>${shared.formatDate(post.published_at)}</span>
            </div>
            <p class="ec-blog-summary">${shared.escapeHtml(post.summary || '')}</p>
        </div>
        ${image ? `<div class="ec-blog-hero"><img src="${image}" alt="${shared.escapeHtml(post.title || 'Blog post')}"></div>` : ''}
        <div class="ec-blog-body">
            ${paragraphs || `<p>${shared.escapeHtml(post.summary || '')}</p>`}
        </div>
    `;
}

function renderRecentPosts(posts) {
    const wrap = document.getElementById('recent-posts');
    if (!wrap) {
        return;
    }

    if (!Array.isArray(posts) || posts.length === 0) {
        wrap.innerHTML = '';
        return;
    }

    wrap.innerHTML = posts.map((post) => {
        const image = shared.resolveImage(post.image);
        const accent = shared.escapeHtml(post.accent || 'sky');

        return `
            <article class="ec-blog-card accent-${accent}">
                <a class="ec-blog-link" href="./customer-engagement-blog-post.html?id=${encodeURIComponent(post.id)}">
                    ${image ? `<img src="${image}" alt="${shared.escapeHtml(post.title)}">` : ''}
                    <span class="ec-blog-tag">${shared.escapeHtml(post.category || 'Blog PETSAIGON')}</span>
                    <h3>${shared.escapeHtml(post.title)}</h3>
                    <p>${shared.escapeHtml(post.summary || '')}</p>
                    <div class="ec-blog-footer">
                        <span>${shared.escapeHtml(post.read_time || 'Bai viet')}</span>
                        <span class="ec-blog-cta">Doc tiep</span>
                    </div>
                </a>
            </article>
        `;
    }).join('');
}

function renderNotFound() {
    const wrap = document.getElementById('blog-detail-card');
    if (!wrap) {
        return;
    }

    wrap.innerHTML = `
        <div class="ec-login-card">
            <span class="ec-kicker">Blog</span>
            <h3>Khong tim thay bai viet</h3>
            <p>Bai viet co the da bi xoa hoac duong dan khong dung.</p>
            <div>
                <a class="ec-btn ec-btn-primary" href="./customer-engagement.html">Ve danh sach blog</a>
            </div>
        </div>
    `;
}
