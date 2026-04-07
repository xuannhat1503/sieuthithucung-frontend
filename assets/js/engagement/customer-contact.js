const shared = window.CustomerEngagementShared;

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

        shared.setWishlistCount(payload.wishlist_count || 0);
        renderContactArea(payload);
        shared.attachLoginPrompts();
    } catch (error) {
        shared.setStatus('status', error.message || 'Khong tai duoc khu vuc lien he.', 'error');
    }
}

function renderContactArea(payload) {
    const formWrap = document.getElementById('contact-form-wrap');
    const historyWrap = document.getElementById('contact-history');
    if (!formWrap || !historyWrap) {
        return;
    }

    if (!payload.authenticated || !payload.current_user) {
        formWrap.innerHTML = shared.renderLoginRequired('Vui long dang nhap truoc khi gui lien he.');
        historyWrap.innerHTML = '';
        return;
    }

    formWrap.innerHTML = `
        <form id="contact-form" class="ec-form-stack">
            <div class="ec-form-grid">
                <label>Ho ten
                    <input type="text" value="${shared.escapeHtml(payload.current_user.name || '')}" readonly>
                </label>
                <label>So dien thoai
                    <input type="text" value="${shared.escapeHtml(payload.current_user.phone_number || 'Chua cap nhat')}" readonly>
                </label>
            </div>
            <label>Email
                <input type="text" value="${shared.escapeHtml(payload.current_user.email || '')}" readonly>
            </label>
            <label>Noi dung can ho tro
                <textarea name="message" rows="5" placeholder="Nhap noi dung can PETSAIGON ho tro." required></textarea>
            </label>
            <button type="submit" class="ec-btn ec-btn-primary">Gui lien he</button>
        </form>
    `;

    formWrap.querySelector('#contact-form').addEventListener('submit', submitContactForm);

    if (!Array.isArray(payload.contact_history) || payload.contact_history.length === 0) {
        historyWrap.innerHTML = `
            <div class="ec-empty-note">
                <strong>Chua co lich su lien he</strong>
                <p>Khi gui lien he, yeu cau cua ban se hien o day.</p>
            </div>
        `;
        return;
    }

    historyWrap.innerHTML = payload.contact_history.map((item) => `
        <article class="ec-support-item">
            <div class="ec-support-top">
                <strong>${shared.escapeHtml(item.full_name || 'Khach hang')}</strong>
                <span class="${item.is_replied ? 'ec-badge-done' : 'ec-badge-pending'}">${item.is_replied ? 'Da phan hoi' : 'Cho phan hoi'}</span>
            </div>
            <p>${shared.escapeHtml(item.message || '')}</p>
            <small>${shared.formatDate(item.created_at)}</small>
        </article>
    `).join('');
}

async function submitContactForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
        const response = await shared.apiFetch('/engagement/contact', {
            method: 'POST',
            requiresAuth: true,
            body: payload,
        });

        form.reset();
        await loadPage(response.message || 'Gui lien he thanh cong.');
    } catch (error) {
        if (error.status === 401) {
            shared.openLoginModal('Vui long dang nhap truoc khi gui lien he.');
            return;
        }

        shared.setStatus('status', error.message || 'Gui lien he that bai.', 'error');
    }
}
