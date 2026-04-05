$(document).ready(function () {
    const AUTH_STORAGE_KEY = 'psg-authenticated';
    const AUTH_USER_KEY = 'psg-auth-user';

    function resolveApiBase() {
        if (window.PSG_API_BASE) {
            return window.PSG_API_BASE.replace(/\/$/, '');
        }

        const projectMatch = window.location.pathname.match(/^(.*\/sieuthithucung)(?:\/|$)/);
        const projectBase = projectMatch ? projectMatch[1] : '';
        return `${window.location.origin}${projectBase}/sieuthithucung-backend/public/api`;
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

    function saveAuthUser(user) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

        if (window.PSGSite && typeof window.PSGSite.syncAccountMenus === 'function') {
            window.PSGSite.syncAccountMenus(document);
        }
    }

    function clearAuthUser() {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(AUTH_USER_KEY);

        if (window.PSGSite && typeof window.PSGSite.syncAccountMenus === 'function') {
            window.PSGSite.syncAccountMenus(document);
        }
    }

    function getAuthUser() {
        const raw = window.localStorage.getItem(AUTH_USER_KEY);
        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);
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

        if (changed) {
            const nextQuery = params.toString();
            const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
            window.history.replaceState({}, document.title, nextUrl);
        }
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
        const addressPhoneInput = document.getElementById('address-phone');
        const accountPhoneInput = document.getElementById('account-phone');
        const accountNameInput = document.getElementById('account-name');
        const accountAddressInput = document.getElementById('account-address');
        const defaultAvatarHint = 'Nhan vao avatar de chon anh moi. Email khong duoc thay doi.';
        let avatarPreviewUrl = '';

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
            return `${amount.toLocaleString('vi-VN')} d`;
        }

        function mapStatus(status) {
            const normalized = String(status || 'pending').toLowerCase();
            const statusMap = {
                pending: { className: 'pending', label: 'Cho xac nhan' },
                processing: { className: 'processing', label: 'Dang xu ly' },
                completed: { className: 'completed', label: 'Hoan thanh' },
                canceled: { className: 'canceled', label: 'Da huy' }
            };

            return statusMap[normalized] || { className: 'pending', label: normalized };
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
                    ? `Don gan nhat duoc tao ngay ${latestOrder.created_at || '-'}.`
                    : 'Chua co don hang nao. Ban co the bat dau mua sam ngay.'
            );
            $('#account-dashboard-addresses-count').text(Array.isArray(addresses) ? addresses.length : 0);
            $('#account-dashboard-addresses-copy').text(
                defaultAddress
                    ? `Dia chi mac dinh dang giao tai ${defaultAddress.city || 'Dang cap nhat'}.`
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
                return `
                    <tr>
                        <td>#${order.id}</td>
                        <td>${order.created_at || '-'}</td>
                        <td><span class="account-status-badge ${status.className}">${status.label}</span></td>
                        <td>${formatCurrency(order.total_price)}</td>
                        <td><a href="#" class="account-btn-info">Xem chi tiet</a></td>
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
                    <td>${address.address || '-'}</td>
                    <td>${address.city || '-'}</td>
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
            const authUser = getAuthUser();
            if (!authUser || !authUser.email) {
                window.location.href = './login.html';
                return null;
            }

            try {
                const response = await fetch(`${resolveApiBase()}/account/summary?email=${encodeURIComponent(authUser.email)}`, {
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
                showToast('success', 'Da dang xuat thanh cong.');
                window.setTimeout(() => {
                    window.location.href = './login.html';
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
            toggleAddressFormButton.addEventListener('click', function () {
                openAddressForm();
            });
        }

        if (closeAddressFormButton) {
            closeAddressFormButton.addEventListener('click', function () {
                closeAddressForm();
            });
        }

        if (addressFormWrap) {
            addressFormWrap.addEventListener('click', function (event) {
                if (event.target === addressFormWrap || event.target.closest('[data-close-address-modal="true"]')) {
                    closeAddressForm();
                }
            });
        }

        if (addressForm) {
            addressForm.addEventListener('submit', async function (event) {
                event.preventDefault();

                const authUser = getAuthUser();
                if (!authUser || !authUser.email) {
                    window.location.href = './login.html';
                    return;
                }

                const normalizedPhone = normalizeVietnamPhone(addressForm.phone.value);
                addressForm.phone.value = normalizedPhone;

                if (!isValidVietnamPhone(normalizedPhone)) {
                    showToast('error', 'So dien thoai phai gom 10 chu so va bat dau bang so 0.', 'Loi');
                    addressForm.phone.focus();
                    return;
                }

                const submitButton = addressForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'DANG LUU...';

                try {
                    const response = await fetch(`${resolveApiBase()}/account/addresses`, {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: authUser.email,
                            full_name: addressForm.full_name.value.trim(),
                            phone: normalizedPhone,
                            address: addressForm.address.value.trim(),
                            city: addressForm.city.value.trim(),
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
            const authUser = getAuthUser();
            if (!authUser || !authUser.email) {
                window.location.href = './login.html';
                return;
            }

            const addressId = $(this).data('address-id');
            try {
                const response = await fetch(`${resolveApiBase()}/account/addresses/${addressId}/default`, {
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

        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async function (event) {
                event.preventDefault();

                const authUser = getAuthUser();
                if (!authUser || !authUser.email) {
                    window.location.href = './login.html';
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
                    const response = await fetch(`${resolveApiBase()}/account/change-password`, {
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
                const authUser = getAuthUser();
                if (!authUser || !authUser.email) {
                    window.location.href = './login.html';
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
                    const response = await fetch(`${resolveApiBase()}/account/profile`, {
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
                    window.setTimeout(() => {
                        window.location.reload();
                    }, 700);
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
            const authUser = getAuthUser();
            if (!authUser || !authUser.email) {
                window.location.href = './login.html';
                return;
            }

            const addressId = $(this).data('address-id');
            if (!window.confirm('Ban co chac muon xoa dia chi nay?')) {
                return;
            }

            try {
                const response = await fetch(`${resolveApiBase()}/account/addresses/${addressId}`, {
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
            const response = await fetch(`${resolveApiBase()}/auth/register`, {
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
            const response = await fetch(`${resolveApiBase()}/auth/login`, {
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

            saveAuthUser(data.user || {});
            showToast('success', data.message || 'Dang nhap thanh cong.');
            window.setTimeout(() => {
                window.location.href = data.redirect_url || './account.html?login=success';
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
            const response = await fetch(`${resolveApiBase()}/auth/forgot-password`, {
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
            const response = await fetch(`${resolveApiBase()}/auth/reset-password`, {
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
                window.location.href = data.redirect_url || './login.html?reset=success';
            }, 900);
        } catch (error) {
            console.error(error);
            showToast('error', 'Khong the ket noi den may chu. Vui long thu lai.');
        } finally {
            $submitButton.prop('disabled', false).text('DAT LAI MAT KHAU');
        }
    });
});








