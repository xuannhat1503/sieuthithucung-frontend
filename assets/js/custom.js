$(document).ready(function () {
    const AUTH_STORAGE_KEY = 'psg-authenticated';
    const AUTH_USER_KEY = 'psg-auth-user';
    const API_BASE_STORAGE_KEY = 'psg-api-base';
    const REDIRECT_GUARD_KEY = 'psg-redirect-guard';
    const AUTH_PAGE_NAMES = new Set(['login.html', 'register.html', 'forgot-password.html', 'reset-password.html']);
    const PROTECTED_PAGE_NAMES = new Set(['account.html', 'checkout.html', 'momo-sim.html']);
    let resolvedApiBase = '';

    function normalizeApiBase(base) {
        const normalized = String(base || '').trim().replace(/\/$/, '');

        if (normalized.startsWith('file://')) {
            return '';
        }

        return normalized;
    }

    function readStoredApiBase() {
        try {
            return normalizeApiBase(window.sessionStorage.getItem(API_BASE_STORAGE_KEY));
        } catch (error) {
            return '';
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
//sds
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

        resolvedApiBase = readStoredApiBase() || collectApiBaseCandidates()[0] || '';
        return resolvedApiBase;
    }

    async function apiFetch(path, options) {
        const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
        const isClientAuthPath = normalizedPath.startsWith('/client-auth/');
        const authApiBase = normalizeApiBase(window.PSG_AUTH_API_BASE || '');
        const defaultCandidates = resolvedApiBase ? [resolvedApiBase, ...collectApiBaseCandidates().filter((candidate) => candidate !== resolvedApiBase)] : collectApiBaseCandidates();
        const candidates = isClientAuthPath && authApiBase
            ? [authApiBase, ...defaultCandidates.filter((candidate) => candidate !== authApiBase)]
            : defaultCandidates;
        let lastError = null;

        for (const base of candidates) {
            try {
                const requestPath = isClientAuthPath && /\/api\/auth$/i.test(base)
                    ? `/${normalizedPath.replace(/^\/client-auth\//, '')}`
                    : normalizedPath;
                const response = await fetch(`${base}${requestPath}`, options);

                if (response.status === 404) {
                    continue;
                }

                persistApiBase(base);
                return response;
            } catch (error) {
                lastError = error;
            }
        }

        persistApiBase('');

        if (lastError) {
            throw lastError;
        }

        throw new Error('Khong the xac dinh dia chi API.');
    }

    function showToast(type, message, title) {
        if (window.toastr && typeof window.toastr[type] === 'function') {
            window.toastr[type](message, title);
            return;
        }

        window.alert(message);
    }

    function flattenErrors(errors) {
        if (!errors) {
            return [];
        }

        return Object.values(errors).flat().filter(Boolean);
    }

    function normalizeVietnamPhone(phone) {
        return String(phone || '').replace(/\D+/g, '');
    }

    function isValidVietnamPhone(phone) {
        return /^0\d{9}$/.test(normalizeVietnamPhone(phone));
    }

    function normalizeUserRole(role) {
        return String(role || '').trim().toLowerCase();
    }

    function normalizeAuthUser(user) {
        const normalized = user && typeof user === 'object' ? user : {};

        return {
            id: normalized.id ?? null,
            name: String(normalized.name || '').trim(),
            email: String(normalized.email || '').trim(),
            role: normalizeUserRole(normalized.role),
            status: String(normalized.status || '').trim().toLowerCase()
        };
    }

    function isCustomerAuthUser(user) {
        return Boolean(user && user.email && user.role === 'customer');
    }

    function getCurrentPageName() {
        const segments = window.location.pathname.replace(/\\/g, '/').split('/');
        return String(segments.pop() || '').trim().toLowerCase();
    }

    function buildPageUrl(pageName, query) {
        const searchParams = new URLSearchParams();

        Object.entries(query || {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }

            searchParams.set(key, value);
        });

        const search = searchParams.toString();
        return `./${pageName}${search ? `?${search}` : ''}`;
    }

    function shouldSkipRedirect(targetUrl) {
        let target;

        try {
            target = new URL(targetUrl, window.location.href);
        } catch (error) {
            return false;
        }

        const currentKey = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const targetKey = `${target.pathname}${target.search}${target.hash}`;

        if (currentKey === targetKey) {
            return true;
        }

        try {
            const now = Date.now();
            const payload = window.sessionStorage.getItem(REDIRECT_GUARD_KEY);
            if (!payload) {
                window.sessionStorage.setItem(REDIRECT_GUARD_KEY, JSON.stringify({ key: `${currentKey}->${targetKey}`, ts: now }));
                return false;
            }

            const parsed = JSON.parse(payload);
            const nextKey = `${currentKey}->${targetKey}`;
            const sequence = Array.isArray(parsed?.sequence) ? parsed.sequence : [];
            const filtered = sequence.filter((item) => Number(now - Number(item.ts || 0)) < 5000);
            filtered.push({ key: nextKey, ts: now });

            if (filtered.length >= 4) {
                return true;
            }

            if (parsed?.key === nextKey && Number(now - Number(parsed.ts || 0)) < 1500) {
                return true;
            }

            window.sessionStorage.setItem(REDIRECT_GUARD_KEY, JSON.stringify({ key: nextKey, ts: now, sequence: filtered }));
        } catch (error) {
            // Ignore guard cache failures and allow redirect.
        }

        return false;
    }

    function redirectToPage(pageName, query) {
        const targetUrl = buildPageUrl(pageName, query);
        if (shouldSkipRedirect(targetUrl)) {
            return;
        }

        window.location.replace(targetUrl);
    }

    function redirectToLogin(query) {
        redirectToPage('login.html', query);
    }

    function redirectToHome(query) {
        redirectToPage('home.html', query);
    }

    function requireAuthenticatedCustomer() {
        const authUser = getAuthUser();

        if (!authUser) {
            redirectToLogin({ auth: 'required' });
            return null;
        }

        return authUser;
    }

    function saveAuthUser(user) {
        const normalizedUser = normalizeAuthUser(user);

        if (!isCustomerAuthUser(normalizedUser)) {
            clearAuthUser();
            return false;
        }

        window.localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));

        if (window.PSGSite && typeof window.PSGSite.syncAccountMenus === 'function') {
            window.PSGSite.syncAccountMenus(document);
        }

        document.dispatchEvent(new CustomEvent('psg:auth-updated', {
            detail: {
                user: normalizedUser
            }
        }));

        return true;
    }

    function clearAuthUser() {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(AUTH_USER_KEY);

        if (window.PSGSite && typeof window.PSGSite.syncAccountMenus === 'function') {
            window.PSGSite.syncAccountMenus(document);
        }

        document.dispatchEvent(new CustomEvent('psg:auth-updated', {
            detail: {
                user: null
            }
        }));
    }

    function getAuthUser() {
        const raw = window.localStorage.getItem(AUTH_USER_KEY);
        if (!raw) {
            return null;
        }

        try {
            const normalizedUser = normalizeAuthUser(JSON.parse(raw));

            if (!isCustomerAuthUser(normalizedUser)) {
                clearAuthUser();
                return null;
            }

            return normalizedUser;
        } catch (error) {
            clearAuthUser();
            return null;
        }
    }

    function updateStoredAuthUser(patch) {
        const currentUser = getAuthUser();
        if (!currentUser) {
            return;
        }

        saveAuthUser({ ...currentUser, ...patch });
    }

    function handleAuthQueryToasts() {
        const params = new URLSearchParams(window.location.search);
        const activation = params.get('activation');
        const registration = params.get('registration');
        const login = params.get('login');
        const reset = params.get('reset');
        const auth = params.get('auth');
        const logout = params.get('logout');
        let changed = false;

        if (activation === 'success') {
            showToast('success', 'Kich hoat tai khoan thanh cong. Moi ban dang nhap.');
            params.delete('activation');
            changed = true;
        } else if (activation === 'invalid') {
            showToast('error', 'Lien ket kich hoat khong hop le hoac da het han.');
            params.delete('activation');
            changed = true;
        }

        if (registration === 'sent') {
            showToast('success', 'Da gui kich hoat ve email cua ban. Vui long kiem tra email.');
            params.delete('registration');
            params.delete('email');
            changed = true;
        } else if (registration === 'resent') {
            showToast('success', 'Tai khoan nay chua kich hoat. Chung toi da gui lai email kich hoat cho ban.');
            params.delete('registration');
            params.delete('email');
            changed = true;
        }

        if (login === 'success') {
            showToast('success', 'Dang nhap thanh cong.');
            params.delete('login');
            changed = true;
        }

        if (reset === 'success') {
            showToast('success', 'Dat lai mat khau thanh cong. Moi ban dang nhap bang mat khau moi.');
            params.delete('reset');
            changed = true;
        } else if (reset === 'invalid') {
            showToast('error', 'Lien ket dat lai mat khau khong hop le hoac da het han.');
            params.delete('reset');
            changed = true;
        }

        if (auth === 'required') {
            showToast('warning', 'Vui long dang nhap bang tai khoan khach hang de truy cap trang nay.');
            params.delete('auth');
            changed = true;
        }

        if (logout === 'success') {
            showToast('success', 'Da dang xuat thanh cong.');
            params.delete('logout');
            changed = true;
        }

        if (changed) {
            const nextQuery = params.toString();
            const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
            window.history.replaceState({}, document.title, nextUrl);
        }
    }

    function guardPageAccess() {
        const pageName = getCurrentPageName();
        if (!pageName) {
            return false;
        }

        const authUser = getAuthUser();

        if (PROTECTED_PAGE_NAMES.has(pageName) && !authUser) {
            redirectToLogin({ auth: 'required' });
            return true;
        }

        if (AUTH_PAGE_NAMES.has(pageName) && authUser) {
            redirectToHome();
            return true;
        }

        return false;
    }


    function initializeAccountPage() {
        const accountRoot = document.getElementById('account-page');
        if (!accountRoot) {
            return;
        }

        const tabLinks = Array.from(document.querySelectorAll('[data-account-tab]'));
        const panels = Array.from(document.querySelectorAll('[data-account-panel]'));
        const ordersBody = document.getElementById('account-orders-body');
        const addressesBody = document.getElementById('account-addresses-body');
        const addressForm = document.getElementById('account-address-form');
        const addressFormWrap = document.getElementById('account-address-form-wrap');
        const toggleAddressFormButton = document.getElementById('toggle-address-form');
        const closeAddressFormButton = document.getElementById('close-address-form');
        const changePasswordForm = document.getElementById('account-change-password-form');
        const accountAvatarImage = document.getElementById('account-avatar');
        const accountAvatarFileInput = document.getElementById('account-avatar-file');
        const accountProfileSubmit = document.getElementById('account-profile-submit');
        const accountAvatarHint = document.getElementById('account-avatar-hint');
        const orderModal = document.getElementById('account-order-modal');
        const orderDetailContent = document.getElementById('account-order-detail-content');
        const closeOrderModalButton = document.getElementById('close-order-modal');
        const addressProvinceSelect = document.getElementById('address-province');
        const addressDistrictSelect = document.getElementById('address-district');
        const addressWardSelect = document.getElementById('address-ward');
        const addressPhoneInput = document.getElementById('address-phone');
        const accountPhoneInput = document.getElementById('account-phone');
        const accountNameInput = document.getElementById('account-name');
        const accountAddressInput = document.getElementById('account-address');
        const defaultAvatarHint = 'Nhan vao avatar de chon anh moi. Email khong duoc thay doi.';
        let avatarPreviewUrl = '';
        const accountLocationCache = {
            provinces: null,
            provinceDetails: new Map(),
            districtDetails: new Map()
        };

        function activateTab(tabName) {
            tabLinks.forEach((button) => {
                button.classList.toggle('is-active', button.dataset.accountTab === tabName);
            });

            panels.forEach((panel) => {
                panel.classList.toggle('is-active', panel.dataset.accountPanel === tabName);
            });
        }

        function formatCurrency(value) {
            const amount = Number(value || 0);
            return `${amount.toLocaleString('vi-VN')} đ`;
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');
        }

        function formatOrderDate(value) {
            if (!value) {
                return '-';
            }

            const normalizedValue = String(value);
            if (/^\d{2}\/\d{2}\/\d{4}(?: \d{2}:\d{2})?$/.test(normalizedValue)) {
                return normalizedValue;
            }

            const parsed = new Date(normalizedValue);
            if (Number.isNaN(parsed.getTime())) {
                return normalizedValue;
            }

            return parsed.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        async function fetchLocationJson(url, options = {}) {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Token': '50b713f0-302d-11f1-a5fa-7ec58214c74b',
                    ...(options.headers || {})
                }
            });
            if (!response.ok) {
                throw new Error(`Khong the tai du lieu dia gioi (${response.status}).`);
            }

            return response.json();
        }

        async function getAllProvinces() {
            if (accountLocationCache.provinces) {
                return accountLocationCache.provinces;
            }

           const payload = await fetchLocationJson('https://online-gateway.ghn.vn/shiip/public-api/master-data/province', { method: 'POST' });
            const data = payload && payload.data ? payload.data : [];
            accountLocationCache.provinces = data.map(p => ({
                code: p.ProvinceID,
                name: p.ProvinceName
            }));
            return accountLocationCache.provinces;
        }

        async function getProvinceDetails(provinceCode) {
            if (!provinceCode) {
                return null;
            }

            if (accountLocationCache.provinceDetails.has(provinceCode)) {
                return accountLocationCache.provinceDetails.get(provinceCode);
            }

            const payload = await fetchLocationJson(`https://online-gateway.ghn.vn/shiip/public-api/master-data/district`, {
                method: 'POST',
                body: JSON.stringify({ province_id: Number(provinceCode) })
            });
            const data = payload && payload.data ? payload.data : [];
            const formattedData = {
                 districts: data.map(d => ({
                     code: d.DistrictID,
                     name: d.DistrictName
                 }))
            };
            accountLocationCache.provinceDetails.set(provinceCode, formattedData);
            return formattedData;
        }

        async function getDistrictDetails(districtCode) {
            if (!districtCode) {
                return null;
            }

            if (accountLocationCache.districtDetails.has(districtCode)) {
                return accountLocationCache.districtDetails.get(districtCode);
            }

            const payload = await fetchLocationJson(`https://online-gateway.ghn.vn/shiip/public-api/master-data/ward`, {
                method: 'POST',
                body: JSON.stringify({ district_id: Number(districtCode) })
            });
            const data = payload && payload.data ? payload.data : [];
            const formattedData = {
                 wards: data.map(w => ({
                     code: w.WardCode,
                     name: w.WardName
                 }))
            };
            accountLocationCache.districtDetails.set(districtCode, formattedData);
            return formattedData;
        }

        function sortLocationItems(items) {
            return [...(items || [])].sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''), 'vi', {
                numeric: true,
                sensitivity: 'base'
            }));
        }

        function fillLocationSelect(select, placeholder, items, valueKey = 'code', labelKey = 'name') {
            if (!select) {
                return;
            }

            const sorted = sortLocationItems(items);
            select.innerHTML = [`<option value="">${placeholder}</option>`]
                .concat(sorted.map((item) => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}</option>`))
                .join('');
            select.disabled = sorted.length === 0;
        }

        function getSelectedLabel(select) {
            return select?.selectedOptions?.[0]?.textContent?.trim() || '';
        }

        function buildAddressText(address) {
            const fullAddress = String(address?.full_address || '').trim();
            if (fullAddress) {
                return fullAddress;
            }

            return [
                address?.address_line || address?.address,
                address?.ward_name,
                address?.district_name,
                address?.province_name || address?.city
            ].filter(Boolean).join(', ');
        }

        function buildOrderShippingAddress(address) {
            const rawAddress = String(address?.full_address || address?.address || '').trim();
            const city = String(address?.province_name || address?.city || '').trim();

            if (!rawAddress) {
                return city;
            }

            if (!city) {
                return rawAddress;
            }

            return rawAddress.toLowerCase().includes(city.toLowerCase())
                ? rawAddress
                : [rawAddress, city].join(', ');
        }

        function mapStatus(status) {
            const normalized = String(status || 'pending').toLowerCase();
            const statusMap = {
                pending: { className: 'pending', label: 'Cho xac nhan' },
                processing: { className: 'processing', label: 'Dang xu ly' },
                shipped: { className: 'shipped', label: 'Dang giao hang' },
                completed: { className: 'completed', label: 'Hoan thanh' },
                canceled: { className: 'canceled', label: 'Da huy' },
                cancelled: { className: 'cancelled', label: 'Da huy' },
                failed: { className: 'canceled', label: 'That bai' }
            };

            return statusMap[normalized] || { className: 'pending', label: normalized };
        }

        function isCompletedOrderStatus(status) {
            return ['completed', 'hoan thanh'].includes(String(status || '').toLowerCase());
        }

        function formatAccountStatus(status) {
            const normalized = String(status || 'active').toLowerCase();
            const statusMap = {
                active: {
                    label: 'Da kich hoat',
                    copy: 'Tai khoan cua ban da san sang de dat hang va nhan cap nhat moi.'
                },
                pending: {
                    label: 'Cho kich hoat',
                    copy: 'Vui long kiem tra email de kich hoat day du tai khoan.'
                },
                banned: {
                    label: 'Tam khoa',
                    copy: 'Tai khoan dang bi gioi han va can duoc kiem tra them.'
                },
                delete: {
                    label: 'Da an',
                    copy: 'Tai khoan dang o trang thai an tren he thong.'
                }
            };

            return statusMap[normalized] || {
                label: normalized,
                copy: 'Thong tin trang thai tai khoan da duoc cap nhat tren he thong.'
            };
        }

        function updateDashboardOverview(user, orders, addresses) {
            const customerName = user.name || 'ban';
            const email = user.email || '-';
            const status = formatAccountStatus(user.status);
            const latestOrder = Array.isArray(orders) && orders.length ? orders[0] : null;
            const defaultAddress = Array.isArray(addresses)
                ? addresses.find((address) => Boolean(address.default)) || addresses[0]
                : null;

            $('#account-dashboard-name').text(customerName);
            $('#account-dashboard-email').text(email);
            $('#account-dashboard-orders-count').text(Array.isArray(orders) ? orders.length : 0);
            $('#account-dashboard-orders-copy').text(
                latestOrder
                    ? `Don gan nhat duoc tao ngay ${formatOrderDate(latestOrder.created_at)}.`
                    : 'Chua co don hang nao. Ban co the bat dau mua sam ngay.'
            );
            $('#account-dashboard-addresses-count').text(Array.isArray(addresses) ? addresses.length : 0);
            $('#account-dashboard-addresses-copy').text(
                defaultAddress
                    ? `Dia chi mac dinh dang giao tai ${defaultAddress.province_name || defaultAddress.city || 'Dang cap nhat'}.`
                    : 'Chua co dia chi giao hang. Them dia chi de thanh toan nhanh hon.'
            );
            $('#account-dashboard-status').text(status.label);
            $('#account-dashboard-status-copy').text(status.copy);
        }

        function renderOrders(orders) {
            if (!ordersBody) {
                return;
            }

            if (!orders || !orders.length) {
                ordersBody.innerHTML = '<tr><td colspan="5" class="account-empty">Ban chua co don hang nao.</td></tr>';
                return;
            }

            ordersBody.innerHTML = orders.map((order) => {
                const status = mapStatus(order.status);
                const isCompleted = isCompletedOrderStatus(order.status);
                const reviewLink = './customer-engagement-reviews.html';

                return `
                    <tr>
                        <td>#${order.id}</td>
                        <td>${escapeHtml(formatOrderDate(order.created_at))}</td>
                        <td><span class="account-status-badge ${status.className}">${status.label}</span></td>
                        <td>${formatCurrency(order.total_price)}</td>
                        <td>
                            <div class="account-action-group">
                                <button type="button" class="account-btn-info account-view-order" data-order-id="${order.id}">Xem chi tiet</button>
                                ${isCompleted ? `<a class="account-btn-info" href="${reviewLink}">Danh gia</a>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function renderAddresses(addresses) {
            if (!addressesBody) {
                return;
            }

            if (!addresses || !addresses.length) {
                addressesBody.innerHTML = '<tr><td colspan="6" class="account-empty">Ban chua co dia chi nao.</td></tr>';
                return;
            }

            addressesBody.innerHTML = addresses.map((address) => `
                <tr>
                    <td>${address.full_name || '-'}</td>
                    <td>${escapeHtml(buildAddressText(address) || '-')}</td>
                    <td>${escapeHtml(address.province_name || address.city || '-')}</td>
                    <td>${address.phone || '-'}</td>
                    <td>${address.default ? '<span class="account-status-badge default">Mac dinh</span>' : '<button type="button" class="account-btn-info account-set-default" data-address-id="' + address.id + '">Chon</button>'}</td>
                    <td>
                        <div class="account-action-group">
                            <button type="button" class="account-btn-danger account-delete-address" data-address-id="${address.id}">Xoa</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        function openOrderModal() {
            if (!orderModal) {
                return;
            }

            orderModal.hidden = false;
            document.body.classList.add('account-modal-open');
        }

        function closeOrderModal() {
            if (!orderModal) {
                return;
            }

            orderModal.hidden = true;
            document.body.classList.remove('account-modal-open');
        }

        function setOrderModalContent(html) {
            if (orderDetailContent) {
                orderDetailContent.innerHTML = html;
            }
        }

        function renderOrderDetail(order) {
            if (!orderDetailContent) {
                return;
            }

            const status = mapStatus(order.status);
            const shippingAddress = order.shipping_address || {};
            const fullAddress = buildOrderShippingAddress(shippingAddress);
            const mapMarkup = fullAddress
                ? `<iframe class="account-order-map" title="Ban do giao hang" src="https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
                : '<p class="account-order-empty">Chua co dia chi giao hang de hien thi tren ban do.</p>';
            const items = Array.isArray(order.items) ? order.items : [];
            const isCompletedOrder = isCompletedOrderStatus(order.status);

            setOrderModalContent(`
                <div class="account-order-summary-grid">
                    <div class="account-order-summary-card">
                        <span class="account-order-summary-label">Ma don hang</span>
                        <strong class="account-order-summary-value">#${escapeHtml(order.id)}</strong>
                    </div>
                    <div class="account-order-summary-card">
                        <span class="account-order-summary-label">Trang thai</span>
                        <span class="account-status-badge ${status.className}">${escapeHtml(status.label)}</span>
                    </div>
                    <div class="account-order-summary-card">
                        <span class="account-order-summary-label">Tong thanh toan</span>
                        <strong class="account-order-summary-value">${escapeHtml(formatCurrency(order.total_price))}</strong>
                    </div>
                </div>
                <div class="account-order-block">
                    <h4>Thong tin giao hang</h4>
                    <dl class="account-order-address-list">
                        <div>
                            <dt>Ngay dat</dt>
                            <dd>${escapeHtml(order.created_at_label || formatOrderDate(order.created_at))}</dd>
                        </div>
                        <div>
                            <dt>Nguoi nhan</dt>
                            <dd>${escapeHtml(shippingAddress.full_name || '-')}</dd>
                        </div>
                        <div>
                            <dt>So dien thoai</dt>
                            <dd>${escapeHtml(shippingAddress.phone || '-')}</dd>
                        </div>
                        <div>
                            <dt>Dia chi</dt>
                            <dd>${escapeHtml(fullAddress || 'Chua cap nhat')}</dd>
                        </div>
                    </dl>
                </div>
                <div class="account-order-block">
                    <h4>San pham trong don</h4>
                    <div class="account-order-items">
                        ${items.length
                            ? items.map((item) => {
                                const quantity = Number(item.quantity || 0);
                                const itemPrice = Number(item.item_price || 0);
                                const lineTotal = itemPrice * quantity;
                                const reviewLink = item.product_id
                                    ? `./customer-engagement-reviews.html?product_id=${encodeURIComponent(item.product_id)}`
                                    : './customer-engagement-reviews.html';

                                return `
                                    <div class="account-order-item">
                                        <strong>${escapeHtml(item.product_name || 'San pham')}</strong>
                                        <span>So luong: ${escapeHtml(quantity)}</span>
                                        <span>Don gia: ${escapeHtml(formatCurrency(itemPrice))}</span>
                                        <span>Thanh tien: ${escapeHtml(formatCurrency(lineTotal))}</span>
                                        ${isCompletedOrder ? `<a class="account-btn-info" href="${reviewLink}">Danh gia san pham</a>` : ''}
                                    </div>
                                `;
                            }).join('')
                            : '<p class="account-order-empty">Khong co du lieu chi tiet san pham cho don hang nay.</p>'}
                    </div>
                </div>
                <div class="account-order-block">
                    <h4>Ban do giao hang</h4>
                    ${mapMarkup}
                </div>
            `);
        }

        async function viewOrderDetail(orderId) {
            const authUser = requireAuthenticatedCustomer();
            if (!authUser) {
                return;
            }

            openOrderModal();
            setOrderModalContent('<div class="account-loading">Dang tai chi tiet don hang...</div>');

            try {
                const response = await apiFetch(`/orders/${orderId}?email=${encodeURIComponent(authUser.email)}`, {
                    headers: { Accept: 'application/json' }
                });
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.order) {
                    throw new Error(data.message || 'Khong the tai chi tiet don hang.');
                }

                renderOrderDetail(data.order);
            } catch (error) {
                console.error(error);
                setOrderModalContent(`<div class="account-empty">${escapeHtml(error.message || 'Khong the tai chi tiet don hang.')}</div>`);
                showToast('error', error.message || 'Khong the tai chi tiet don hang.');
            }
        }

        function fillUser(user) {
            const name = user.name || 'ban';
            const email = user.email || '-';
            const avatar = user.avatar || '../assets/images/uploads/users/default.png';

            $("#account-dashboard-name").text(name);
            $("#account-dashboard-email").text(email);
            $("#account-name").val(user.name || "");
            $("#account-phone").val(user.phone_number || "");
            $("#account-email").val(email);
            $("#account-address").val(user.address || "");
            $("#account-avatar").attr("src", avatar).attr("data-current-src", avatar);

            if (accountAvatarFileInput) {
                accountAvatarFileInput.value = '';
            }

            if (accountAvatarHint) {
                accountAvatarHint.textContent = defaultAvatarHint;
            }
        }

        async function loadAccountSummary() {
            const authUser = requireAuthenticatedCustomer();
            if (!authUser) {
                return null;
            }

            try {
                const response = await apiFetch(`/account/summary?email=${encodeURIComponent(authUser.email)}`, {
                    headers: { Accept: 'application/json' }
                });
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Khong the tai du lieu tai khoan.');
                }

                fillUser(data.user || {});
                updateDashboardOverview(data.user || {}, data.orders || [], data.addresses || []);
                renderOrders(data.orders || []);
                renderAddresses(data.addresses || []);
                return data;
            } catch (error) {
                console.error(error);
                if (ordersBody) {
                    ordersBody.innerHTML = '<tr><td colspan="5" class="account-empty">Khong the tai don hang tu he thong.</td></tr>';
                }
                if (addressesBody) {
                    addressesBody.innerHTML = '<tr><td colspan="6" class="account-empty">Khong the tai dia chi tu he thong.</td></tr>';
                }
                showToast('error', 'Khong the tai du lieu tai khoan. Vui long thu lai.');
                return null;
            }
        }

        async function refreshAccountAddresses() {
            await loadAccountSummary();
        }

        tabLinks.forEach((button) => {
            button.addEventListener('click', function () {
                activateTab(button.dataset.accountTab);
            });
        });

        document.querySelectorAll('.account-dashboard-logout').forEach((link) => {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                clearAuthUser();
                window.setTimeout(() => {
                    redirectToLogin({ logout: 'success' });
                }, 500);
            });
        });

        function openAddressForm() {
            if (!addressFormWrap) {
                return;
            }

            addressFormWrap.hidden = false;
            document.body.classList.add('account-modal-open');
        }

        function closeAddressForm() {
            if (!addressFormWrap) {
                return;
            }

            addressFormWrap.hidden = true;
            document.body.classList.remove('account-modal-open');
        }

        async function ensureAddressLocationOptions() {
            if (!addressProvinceSelect) {
                return;
            }

            const provinces = await getAllProvinces();
            fillLocationSelect(addressProvinceSelect, 'Chon tinh / thanh pho', provinces, 'code', 'name');
            fillLocationSelect(addressDistrictSelect, 'Chon quan / huyen', []);
            fillLocationSelect(addressWardSelect, 'Chon phuong / xa', []);
        }

        function prefillAddressForm() {
            if (!addressForm) {
                return;
            }

            if (!addressForm.full_name.value.trim() && accountNameInput?.value) {
                addressForm.full_name.value = accountNameInput.value.trim();
            }

            if (!addressForm.phone.value.trim() && accountPhoneInput?.value) {
                addressForm.phone.value = normalizeVietnamPhone(accountPhoneInput.value);
            }
        }

        [addressPhoneInput, accountPhoneInput].filter(Boolean).forEach((input) => {
            input.addEventListener('input', function () {
                input.value = normalizeVietnamPhone(input.value).slice(0, 10);
            });
        });


        if (accountAvatarImage && accountAvatarFileInput) {
            accountAvatarImage.addEventListener('click', function () {
                accountAvatarFileInput.click();
            });
        }

        if (accountAvatarFileInput) {
            accountAvatarFileInput.addEventListener('change', function () {
                const file = accountAvatarFileInput.files && accountAvatarFileInput.files[0];
                const currentAvatar = accountAvatarImage ? (accountAvatarImage.dataset.currentSrc || accountAvatarImage.src) : '';

                if (!file) {
                    if (accountAvatarHint) {
                        accountAvatarHint.textContent = defaultAvatarHint;
                    }

                    if (accountAvatarImage && currentAvatar) {
                        accountAvatarImage.src = currentAvatar;
                    }

                    return;
                }

                if (!file.type.startsWith('image/')) {
                    showToast('error', 'Vui long chon mot tep hinh anh hop le.', 'Loi');
                    accountAvatarFileInput.value = '';

                    if (accountAvatarHint) {
                        accountAvatarHint.textContent = defaultAvatarHint;
                    }

                    if (accountAvatarImage && currentAvatar) {
                        accountAvatarImage.src = currentAvatar;
                    }

                    return;
                }

                if (file.size > 5 * 1024 * 1024) {
                    showToast('error', 'Anh dai dien khong duoc vuot qua 5MB.', 'Loi');
                    accountAvatarFileInput.value = '';

                    if (accountAvatarHint) {
                        accountAvatarHint.textContent = defaultAvatarHint;
                    }

                    if (accountAvatarImage && currentAvatar) {
                        accountAvatarImage.src = currentAvatar;
                    }

                    return;
                }

                if (avatarPreviewUrl) {
                    URL.revokeObjectURL(avatarPreviewUrl);
                }

                avatarPreviewUrl = URL.createObjectURL(file);

                if (accountAvatarImage) {
                    accountAvatarImage.src = avatarPreviewUrl;
                }

                if (accountAvatarHint) {
                    accountAvatarHint.textContent = `Da chon anh: ${file.name}`;
                }
            });
        }
        if (toggleAddressFormButton && addressFormWrap) {
            toggleAddressFormButton.addEventListener('click', async function () {
                try {
                    await ensureAddressLocationOptions();
                    prefillAddressForm();
                    openAddressForm();
                } catch (error) {
                    console.error(error);
                    showToast('error', 'Khong the tai du lieu tinh/thanh pho luc nay.');
                }
            });
        }

        if (closeAddressFormButton) {
            closeAddressFormButton.addEventListener('click', function () {
                closeAddressForm();
            });
        }

        if (closeOrderModalButton) {
            closeOrderModalButton.addEventListener('click', function () {
                closeOrderModal();
            });
        }

        if (addressFormWrap) {
            addressFormWrap.addEventListener('click', function (event) {
                if (event.target === addressFormWrap || event.target.closest('[data-close-address-modal="true"]')) {
                    closeAddressForm();
                }
            });
        }

        if (addressProvinceSelect) {
            addressProvinceSelect.addEventListener('change', async function () {
                try {
                    const province = await getProvinceDetails(addressProvinceSelect.value);
                    fillLocationSelect(addressDistrictSelect, 'Chon quan / huyen', province?.districts || [], 'code', 'name');
                    fillLocationSelect(addressWardSelect, 'Chon phuong / xa', []);
                } catch (error) {
                    console.error(error);
                    fillLocationSelect(addressDistrictSelect, 'Chon quan / huyen', []);
                    fillLocationSelect(addressWardSelect, 'Chon phuong / xa', []);
                    showToast('error', 'Khong the tai danh sach quan/huyen.');
                }
            });
        }

        if (addressDistrictSelect) {
            addressDistrictSelect.addEventListener('change', async function () {
                try {
                    const district = await getDistrictDetails(addressDistrictSelect.value);
                    fillLocationSelect(addressWardSelect, 'Chon phuong / xa', district?.wards || [], 'code', 'name');
                } catch (error) {
                    console.error(error);
                    fillLocationSelect(addressWardSelect, 'Chon phuong / xa', []);
                    showToast('error', 'Khong the tai danh sach phuong/xa.');
                }
            });
        }

        if (orderModal) {
            orderModal.addEventListener('click', function (event) {
                if (event.target === orderModal || event.target.closest('[data-close-order-modal="true"]')) {
                    closeOrderModal();
                }
            });
        }

        if (addressForm) {
            addressForm.addEventListener('submit', async function (event) {
                event.preventDefault();

                const authUser = requireAuthenticatedCustomer();
                if (!authUser) {
                    return;
                }

                const normalizedPhone = normalizeVietnamPhone(addressForm.phone.value);
                addressForm.phone.value = normalizedPhone;

                if (!isValidVietnamPhone(normalizedPhone)) {
                    showToast('error', 'So dien thoai phai gom 10 chu so va bat dau bang so 0.', 'Loi');
                    addressForm.phone.focus();
                    return;
                }

                const provinceName = getSelectedLabel(addressProvinceSelect);
                const districtName = getSelectedLabel(addressDistrictSelect);
                const wardName = getSelectedLabel(addressWardSelect);

                if (!addressProvinceSelect?.value || !provinceName) {
                    showToast('error', 'Vui long chon tinh/thanh pho.', 'Loi');
                    addressProvinceSelect?.focus();
                    return;
                }

                if (!addressDistrictSelect?.value || !districtName) {
                    showToast('error', 'Vui long chon quan/huyen.', 'Loi');
                    addressDistrictSelect?.focus();
                    return;
                }

                if (!addressWardSelect?.value || !wardName) {
                    showToast('error', 'Vui long chon phuong/xa.', 'Loi');
                    addressWardSelect?.focus();
                    return;
                }

                const submitButton = addressForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'DANG LUU...';

                try {
                    const response = await apiFetch('/account/addresses', {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: authUser.email,
                            full_name: addressForm.full_name.value.trim(),
                            phone: normalizedPhone,
                            address_line: addressForm.address_line.value.trim(),
                            province_name: provinceName,
                            province_code: addressProvinceSelect.value,
                            district_name: districtName,
                            district_code: addressDistrictSelect.value,
                            ward_name: wardName,
                            ward_code: addressWardSelect.value,
                            default: addressForm.default.checked
                        })
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        const messages = flattenErrors(data.errors);
                        throw new Error(messages[0] || data.message || 'Them dia chi that bai.');
                    }

                    showToast('success', data.message || 'Them dia chi moi thanh cong.');
                    addressForm.reset();
                    closeAddressForm();
                    await refreshAccountAddresses();
                    activateTab('address');
                } catch (error) {
                    console.error(error);
                    showToast('error', error.message || 'Them dia chi that bai.');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Luu dia chi';
                }
            });
        }

        $(document).off('click', '.account-set-default').on('click', '.account-set-default', async function () {
            const authUser = requireAuthenticatedCustomer();
            if (!authUser) {
                return;
            }

            const addressId = $(this).data('address-id');
            try {
                const response = await apiFetch(`/account/addresses/${addressId}/default`, {
                    method: 'PUT',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: authUser.email })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Khong the cap nhat dia chi mac dinh.');
                }

                showToast('success', data.message || 'Da cap nhat dia chi mac dinh.');
                await refreshAccountAddresses();
                activateTab('address');
            } catch (error) {
                console.error(error);
                showToast('error', error.message || 'Khong the cap nhat dia chi mac dinh.');
            }
        });

        $(document).off('click', '.account-view-order').on('click', '.account-view-order', async function () {
            const orderId = $(this).data('order-id');
            if (!orderId) {
                return;
            }

            await viewOrderDetail(orderId);
        });

        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async function (event) {
                event.preventDefault();

                const authUser = requireAuthenticatedCustomer();
                if (!authUser) {
                    return;
                }

                const currentPassword = changePasswordForm.current_password.value;
                const newPassword = changePasswordForm.new_password.value;
                const confirmNewPassword = changePasswordForm.confirm_new_password.value;

                let errorMessage = '';
                if (!currentPassword) {
                    errorMessage += 'Vui long nhap mat khau hien tai. <br>';
                }

                if (newPassword.length < 6) {
                    errorMessage += 'Mat khau moi phai co it nhat 6 ky tu. <br>';
                }

                if (newPassword !== confirmNewPassword) {
                    errorMessage += 'Mat khau nhap lai khong khop. <br>';
                }

                if (errorMessage) {
                    showToast('error', errorMessage, 'Loi');
                    return;
                }

                const submitButton = changePasswordForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'DANG DOI...';

                try {
                    const response = await apiFetch('/account/change-password', {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: authUser.email,
                            current_password: currentPassword,
                            new_password: newPassword,
                            confirm_new_password: confirmNewPassword
                        })
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        const messages = flattenErrors(data.errors);
                        throw new Error(messages[0] || data.message || 'Doi mat khau that bai.');
                    }

                    showToast('success', data.message || 'Doi mat khau thanh cong.');
                    changePasswordForm.reset();
                } catch (error) {
                    console.error(error);
                    showToast('error', error.message || 'Doi mat khau that bai.');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Doi mat khau';
                }
            });
        }


        if (accountProfileSubmit) {
            accountProfileSubmit.addEventListener('click', async function () {
                const authUser = requireAuthenticatedCustomer();
                if (!authUser) {
                    return;
                }

                const name = accountNameInput ? accountNameInput.value.trim() : '';
                const phoneNumber = accountPhoneInput ? normalizeVietnamPhone(accountPhoneInput.value) : '';
                const address = accountAddressInput ? accountAddressInput.value.trim() : '';
                const avatarFile = accountAvatarFileInput && accountAvatarFileInput.files
                    ? accountAvatarFileInput.files[0]
                    : null;

                let errorMessage = '';
                if (name.length < 2) {
                    errorMessage += 'Ho va ten phai co it nhat 2 ky tu. <br>';
                }

                if (phoneNumber && !isValidVietnamPhone(phoneNumber)) {
                    errorMessage += 'So dien thoai phai gom 10 chu so va bat dau bang so 0. <br>';
                }

                if (address.length > 255) {
                    errorMessage += 'Dia chi khong duoc vuot qua 255 ky tu. <br>';
                }

                if (errorMessage) {
                    showToast('error', errorMessage, 'Loi');
                    return;
                }

                if (accountPhoneInput) {
                    accountPhoneInput.value = phoneNumber;
                }

                const formData = new FormData();
                formData.append('email', authUser.email);
                formData.append('name', name);
                formData.append('phone_number', phoneNumber);
                formData.append('address', address);

                if (avatarFile) {
                    formData.append('avatar', avatarFile);
                }

                accountProfileSubmit.disabled = true;
                accountProfileSubmit.textContent = 'DANG CAP NHAT...';

                try {
                    const response = await apiFetch('/account/profile', {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json'
                        },
                        body: formData
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        const messages = flattenErrors(data.errors);
                        throw new Error(messages[0] || data.message || 'Cap nhat thong tin tai khoan that bai.');
                    }

                    if (data.user) {
                        updateStoredAuthUser({
                            name: data.user.name || authUser.name,
                            email: data.user.email || authUser.email
                        });
                    }

                    showToast('success', data.message || 'Cap nhat thong tin tai khoan thanh cong.');
                } catch (error) {
                    console.error(error);
                    showToast('error', error.message || 'Cap nhat thong tin tai khoan that bai.');
                } finally {
                    accountProfileSubmit.disabled = false;
                    accountProfileSubmit.textContent = 'Cap nhat';
                }
            });
        }
        $(document).off('click', '.account-delete-address').on('click', '.account-delete-address', async function () {
            const authUser = requireAuthenticatedCustomer();
            if (!authUser) {
                return;
            }

            const addressId = $(this).data('address-id');
            if (!window.confirm('Ban co chac muon xoa dia chi nay?')) {
                return;
            }

            try {
                const response = await apiFetch(`/account/addresses/${addressId}`, {
                    method: 'DELETE',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: authUser.email })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.message || 'Khong the xoa dia chi.');
                }

                showToast('success', data.message || 'Xoa dia chi thanh cong.');
                await refreshAccountAddresses();
                activateTab('address');
            } catch (error) {
                console.error(error);
                showToast('error', error.message || 'Khong the xoa dia chi.');
            }
        });

        const initialTab = new URLSearchParams(window.location.search).get('tab');
        if (initialTab && tabLinks.some((button) => button.dataset.accountTab === initialTab)) {
            activateTab(initialTab);
        }

        loadAccountSummary();
    }

    function initializeResetPage() {
        const form = document.getElementById('reset-password-form');
        if (!form) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const email = params.get('email') || '';
        const token = params.get('token') || '';

        const emailInput = form.querySelector('input[name="email"]');
        const tokenInput = form.querySelector('input[name="token"]');

        if (emailInput) {
            emailInput.value = email;
        }

        if (tokenInput) {
            tokenInput.value = token;
        }

        if (!email || !token) {
            showToast('error', 'Lien ket dat lai mat khau khong hop le hoac da thieu thong tin.');
        }
    }

    handleAuthQueryToasts();
    if (guardPageAccess()) {
        return;
    }
    initializeResetPage();
    initializeAccountPage();

    $('#register-form').submit(async function (e) {
        e.preventDefault();

        const name = $('input[name="name"]').val().trim();
        const email = $('input[name="email"]').val().trim();
        const password = $('input[name="password"]').val();
        const confirmPassword = $('input[name="confirmPassword"]').val();
        const checkbox2 = $('input[name="checkbox2"]').is(':checked');
        let errorMessage = '';

        if (name.length < 3) {
            errorMessage += 'Ho va ten phai co it nhat 3 ky tu. <br>';
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorMessage += 'Email khong hop le. <br>';
        }

        if (password.length < 6) {
            errorMessage += 'Mat khau phai co it nhat 6 ky tu. <br>';
        }

        if (password !== confirmPassword) {
            errorMessage += 'Mat khau nhap lai khong khop. <br>';
        }

        if (!checkbox2) {
            errorMessage += 'Ban phai dong y voi chinh sach bao mat truoc khi tao tai khoan. <br>';
        }

        if (errorMessage !== '') {
            showToast('error', errorMessage, 'Loi');
            return;
        }

        const $submitButton = $(this).find('button[type="submit"]');
        $submitButton.prop('disabled', true).text('DANG GUI...');

        try {
            const response = await apiFetch('/client-auth/register', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    password_confirmation: confirmPassword
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const messages = flattenErrors(data.errors);
                showToast('error', messages[0] || data.message || 'Dang ky that bai.', 'Loi');
                return;
            }

            showToast('success', data.message || `Da gui kich hoat ve ${email}. Vui long kiem tra email.`);
            $('input[name="password"]').val('');
            $('input[name="confirmPassword"]').val('');
        } catch (error) {
            console.error(error);
            showToast('error', 'Khong the ket noi den may chu. Vui long thu lai.');
        } finally {
            $submitButton.prop('disabled', false).text('TAO TAI KHOAN');
        }
    });

    $('#login-form').submit(async function (e) {
        e.preventDefault();

        const email = $('input[name="email"]').val().trim();
        const password = $('input[name="password"]').val();
        let errorMessage = '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            errorMessage += 'Email khong hop le. <br>';
        }

        if (password.length < 6) {
            errorMessage += 'Mat khau phai co it nhat 6 ky tu. <br>';
        }

        if (errorMessage !== '') {
            showToast('error', errorMessage, 'Loi');
            return;
        }

        const $submitButton = $(this).find('button[type="submit"]');
        $submitButton.prop('disabled', true).text('DANG DANG NHAP...');

        try {
            const response = await apiFetch('/client-auth/login', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const messages = flattenErrors(data.errors);
                showToast('error', messages[0] || data.message || 'Dang nhap that bai.', 'Loi');
                return;
            }

            const isSaved = saveAuthUser(data.user || {});
            if (!isSaved) {
                showToast('error', 'Tai khoan nay khong co quyen truy cap khu vuc khach hang.', 'Loi');
                return;
            }

            showToast('success', data.message || 'Dang nhap thanh cong.');
            window.setTimeout(() => {
                redirectToHome({ login: 'success' });
            }, 700);
        } catch (error) {
            console.error(error);
            showToast('error', 'Khong the ket noi den may chu. Vui long thu lai.');
        } finally {
            $submitButton.prop('disabled', false).text('DANG NHAP');
        }
    });

    $('#forgot-password-form').submit(async function (e) {
        e.preventDefault();

        const email = $('input[name="email"]').val().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            showToast('error', 'Email khong hop le.', 'Loi');
            return;
        }

        const $submitButton = $(this).find('button[type="submit"]');
        $submitButton.prop('disabled', true).text('DANG GUI...');

        try {
            const response = await apiFetch('/client-auth/forgot-password', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const messages = flattenErrors(data.errors);
                showToast('error', messages[0] || data.message || 'Gui yeu cau that bai.', 'Loi');
                return;
            }

            showToast('success', data.message || 'Da gui lien ket dat lai mat khau ve email cua ban.');
        } catch (error) {
            console.error(error);
            showToast('error', 'Khong the ket noi den may chu. Vui long thu lai.');
        } finally {
            $submitButton.prop('disabled', false).text('GUI LIEN KET DAT LAI MAT KHAU');
        }
    });

    $('#reset-password-form').submit(async function (e) {
        e.preventDefault();

        const email = $('input[name="email"]').val().trim();
        const token = $('input[name="token"]').val().trim();
        const password = $('input[name="password"]').val();
        const confirmPassword = $('input[name="password_confirmation"]').val();
        let errorMessage = '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            errorMessage += 'Email khong hop le. <br>';
        }

        if (!token) {
            errorMessage += 'Token dat lai mat khau khong hop le. <br>';
        }

        if (password.length < 6) {
            errorMessage += 'Mat khau moi phai co it nhat 6 ky tu. <br>';
        }

        if (password !== confirmPassword) {
            errorMessage += 'Mat khau nhap lai khong khop. <br>';
        }

        if (errorMessage !== '') {
            showToast('error', errorMessage, 'Loi');
            return;
        }

        const $submitButton = $(this).find('button[type="submit"]');
        $submitButton.prop('disabled', true).text('DANG CAP NHAT...');

        try {
            const response = await apiFetch('/client-auth/reset-password', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    token,
                    password,
                    password_confirmation: confirmPassword
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const messages = flattenErrors(data.errors);
                showToast('error', messages[0] || data.message || 'Dat lai mat khau that bai.', 'Loi');
                return;
            }

            showToast('success', data.message || 'Dat lai mat khau thanh cong.');
            window.setTimeout(() => {
                redirectToLogin({ reset: 'success' });
            }, 900);
        } catch (error) {
            console.error(error);
            showToast('error', 'Khong the ket noi den may chu. Vui long thu lai.');
        } finally {
            $submitButton.prop('disabled', false).text('DAT LAI MAT KHAU');
        }
    });
});








