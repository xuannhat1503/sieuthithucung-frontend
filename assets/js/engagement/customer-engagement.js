const shared = window.CustomerEngagementShared;

const CATEGORY_CONFIG = {
    all: {
        chip: 'Blog PETSAIGON',
        title: 'Blog chia se cho nguoi nuoi thu cung',
        copy: 'Tong hop bai viet huu ich ve cham soc, dinh duong va kinh nghiem mua sam cho boss.',
        section: 'Bai viet huu ich',
    },
    dog: {
        chip: 'Blog cho',
        title: 'Blog danh cho nguoi nuoi cho',
        copy: 'Tong hop bai viet ve cham soc, huan luyen va kinh nghiem chon san pham cho cac be cho.',
        section: 'Bai viet ve cho',
    },
    cat: {
        chip: 'Blog meo',
        title: 'Blog danh cho nguoi nuoi meo',
        copy: 'Cap nhat meo hay ve dinh duong, suc khoe va thoi quen sinh hoat cua cac be meo.',
        section: 'Bai viet ve meo',
    },
    tips: {
        chip: 'Tips cham soc',
        title: 'Tips cham soc thu cung',
        copy: 'Meo nhanh ve cham soc, mua sam va theo doi suc khoe de nuoi boss nhe nhang hon.',
        section: 'Muc tips noi bat',
    },
};

document.addEventListener('DOMContentLoaded', () => {
    shared.bindLoginModal({
        onSuccess: () => loadPage('Dang nhap thanh cong.'),
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
        shared.setStatus('status', error.message || 'Khong tai duoc danh sach bai viet.', 'error');
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
            : `${config.copy} Hien tai chua co bai viet phu hop trong muc nay.`;
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
            ? (message || 'Chua co bai viet nao de hien thi.')
            : 'Chua co bai viet nao trong chuyen muc nay.';

        wrap.innerHTML = `
            <article class="ec-blog-card accent-sky">
                <span class="ec-blog-tag">Blog</span>
                <h3>Chua co bai viet</h3>
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
                        <span>${shared.escapeHtml(post.read_time || 'Bai viet')}</span>
                        <span class="ec-blog-cta">Doc tiep</span>
                    </div>
                </a>
            </article>
        `;
    }).join('');
}
