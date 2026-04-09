const shared = window.CustomerEngagementShared;

const CATEGORY_CONFIG = {
    all: {
        chip: 'Blog PETSAIGON',
        title: 'Blog chia sẻ cho người nuôi thú cưng',
        copy: 'Tổng hợp bài viết hữu ích về chăm sóc, dinh dưỡng và kinh nghiệm mua sắm cho boss.',
        section: 'Bài viết hữu ích',
    },
    dog: {
        chip: 'Blog chó',
        title: 'Blog dành cho người nuôi chó',
        copy: 'Tổng hợp bài viết về chăm sóc, huấn luyện và kinh nghiệm chọn sản phẩm cho các bé chó.',
        section: 'Bài viết về chó',
    },
    cat: {
        chip: 'Blog mèo',
        title: 'Blog dành cho người nuôi mèo',
        copy: 'Cập nhật mẹo hay về dinh dưỡng, sức khỏe và thói quen sinh hoạt của các bé mèo.',
        section: 'Bài viết về mèo',
    },
    tips: {
        chip: 'Tips chăm sóc',
        title: 'Tips chăm sóc thú cưng',
        copy: 'Mẹo nhanh về chăm sóc, mua sắm và theo dõi sức khỏe để nuôi boss nhẹ nhàng hơn.',
        section: 'Mục tips nổi bật',
    },
};

document.addEventListener('DOMContentLoaded', () => {
    shared.bindLoginModal({
        onSuccess: () => loadPage('Đăng nhập thành công.'),
    });

    shared.bindWishlistLinks();
    loadPage();
});

async function loadPage(statusMessage = '') {
    if (statusMessage) {
        shared.setStatus('status', statusMessage, 'success');
    } else {
        shared.setStatus('status', '', 'info');
    }

    try {
        const payload = await shared.apiFetch('/engagement/summary', {
            requiresAuth: Boolean(shared.getAuthUser()),
        });

        if (!payload.authenticated && shared.getAuthUser()) {
            shared.clearAuthUser();
        }

        if (payload.current_user) {
            shared.saveAuthUser(payload.current_user);
        }

        const categoryKey = getCategoryKey();
        const posts = filterPosts(payload.blog_posts || [], categoryKey);

        shared.setWishlistCount(payload.wishlist_count || 0);
        updateHeading(categoryKey, posts.length);
        renderBlogPosts(posts, categoryKey, payload.blog_message || '');
        shared.attachLoginPrompts();
    } catch (error) {
        shared.setStatus('status', error.message || 'Không tải được danh sách bài viết.', 'error');
    }
}

function getCategoryKey() {
    const value = new URLSearchParams(window.location.search).get('category');
    return CATEGORY_CONFIG[value] ? value : 'all';
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function filterPosts(posts, categoryKey) {
    if (!Array.isArray(posts)) {
        return [];
    }

    if (categoryKey === 'all') {
        return posts;
    }

    const tokens = {
        dog: ['cho'],
        cat: ['meo'],
        tips: ['tips', 'cham soc', 'huong dan', 'suc khoe', 'dinh duong', 'mua sam'],
    };

    return posts.filter((post) => {
        const haystack = normalizeText([
            post.category,
            post.title,
            post.summary,
            post.content,
        ].join(' '));

        return (tokens[categoryKey] || []).some((token) => haystack.includes(token));
    });
}

function updateHeading(categoryKey, count) {
    const config = CATEGORY_CONFIG[categoryKey] || CATEGORY_CONFIG.all;

    const chip = document.getElementById('blog-chip');
    const title = document.getElementById('blog-title');
    const copy = document.getElementById('blog-copy');
    const sectionTitle = document.getElementById('blog-section-title');

    if (chip) {
        chip.textContent = config.chip;
    }

    if (title) {
        title.textContent = config.title;
    }

    if (copy) {
        copy.textContent = count > 0
            ? config.copy
            : `${config.copy} Hiện tại chưa có bài viết phù hợp trong mục này.`;
    }

    if (sectionTitle) {
        sectionTitle.textContent = config.section;
    }
}

function renderBlogPosts(posts, categoryKey, message) {
    const wrap = document.getElementById('blog-grid');
    if (!wrap) {
        return;
    }

    if (!Array.isArray(posts) || posts.length === 0) {
        const emptyText = categoryKey === 'all'
            ? (message || 'Chưa có bài viết nào để hiển thị.')
            : 'Chưa có bài viết nào trong chuyên mục này.';

        wrap.innerHTML = `
            <article class="ec-blog-card accent-sky">
                <span class="ec-blog-tag">Blog</span>
                <h3>Chưa có bài viết</h3>
                <p>${shared.escapeHtml(emptyText)}</p>
            </article>
        `;
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
                        <span>${shared.escapeHtml(post.read_time || 'Bài viết')}</span>
                        <span class="ec-blog-cta">Đọc tiếp</span>
                    </div>
                </a>
            </article>
        `;
    }).join('');
}
