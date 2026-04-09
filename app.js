let BASE_API = window.BASE_API || "https://sieuthithucung-backend-72cr.onrender.com/api/v1";
let AUTH_TOKEN_KEY = window.AUTH_TOKEN_KEY || "sttc_admin_token";
let AUTH_USER_KEY = window.AUTH_USER_KEY || "sttc_admin_user";

const modules = {
    users: {
        title: "Nguoi dung",
        resource: "users",
        fields: [
            { key: "name", label: "Ho ten" },
            { key: "email", label: "Email", type: "email" },
            { key: "password", label: "Mat khau", type: "password", hiddenInTable: true, noPrefill: true },
            {
                key: "status",
                label: "Trang thai",
                options: [
                    { value: "pending", label: "Cho kich hoat" },
                    { value: "active", label: "Dang hoat dong" },
                    { value: "banned", label: "Da khoa" },
                    { value: "deleted", label: "Da xoa" }
                ]
            },
            { key: "phoneNumber", label: "So dien thoai" },
            { key: "avatar", label: "URL anh dai dien", full: true, uploadable: true },
            { key: "address", label: "Dia chi", full: true },
            { key: "roleId", label: "Ma vai tro", type: "number" }
        ]
    },
    categories: {
        title: "Danh muc",
        resource: "categories",
        fields: [
            { key: "name", label: "Ten danh muc" },
            { key: "slug", label: "Slug" },
            { key: "description", label: "Mo ta", type: "textarea", full: true },
            { key: "image", label: "URL anh", full: true, uploadable: true }
        ]
    },
    products: {
        title: "San pham",
        resource: "products",
        fields: [
            { key: "name", label: "Ten san pham" },
            { key: "slug", label: "Slug" },
            { key: "categoryId", label: "Ma danh muc", type: "number" },
            { key: "description", label: "Mo ta", type: "textarea", full: true },
            { key: "price", label: "Gia", type: "number", step: "0.01" },
            { key: "stock", label: "So luong ton", type: "number" },
            {
                key: "status",
                label: "Trang thai",
                options: [
                    { value: "in_stock", label: "Con hang" },
                    { value: "out_of_stock", label: "Het hang" }
                ]
            },
            { key: "unit", label: "Don vi" },
            { key: "primaryImage", label: "Anh dai dien", full: true, uploadable: true, hiddenInTable: true, virtual: true }
        ]
    },
    orders: {
        title: "Don hang",
        resource: "orders",
        fields: [
            { key: "userId", label: "Ma nguoi dung", type: "number" },
            { key: "totalPrice", label: "Tong tien", type: "number", step: "0.01" },
            {
                key: "status",
                label: "Trang thai",
                options: [
                    { value: "pending", label: "Cho xu ly" },
                    { value: "processing", label: "Dang xu ly" },
                    { value: "shipped", label: "Dang giao" },
                    { value: "completed", label: "Hoan tat" },
                    { value: "cancelled", label: "Da huy" }
                ]
            },
            { key: "shippingAddressId", label: "Ma dia chi giao", type: "number" }
        ]
    },
    orderItems: {
        title: "Chi tiet don hang",
        resource: "order-items",
        fields: [
            { key: "orderId", label: "Ma don hang", type: "number" },
            { key: "productId", label: "Ma san pham", type: "number" },
            { key: "userId", label: "Ma nguoi dung", type: "number" },
            { key: "quantity", label: "So luong", type: "number" },
            { key: "price", label: "Gia", type: "number", step: "0.01" }
        ]
    },
    payments: {
        title: "Thanh toan",
        resource: "payments",
        fields: [
            { key: "orderId", label: "Ma don hang", type: "number" },
            {
                key: "paymentMethod",
                label: "Phuong thuc thanh toan",
                options: [
                    { value: "cash", label: "Tien mat" },
                    { value: "paypal", label: "PayPal" }
                ]
            },
            { key: "transactionId", label: "Ma giao dich" },
            {
                key: "status",
                label: "Trang thai",
                options: [
                    { value: "pending", label: "Cho thanh toan" },
                    { value: "completed", label: "Thanh cong" },
                    { value: "failed", label: "That bai" }
                ]
            },
            { key: "paidAy", label: "Thoi gian thanh toan" },
            { key: "amount", label: "So tien", type: "number", step: "0.01" }
        ]
    },
    coupons: {
        title: "Ma giam gia",
        resource: "coupons",
        fields: [
            { key: "code", label: "Ma coupon" },
            {
                key: "type",
                label: "Loai",
                options: [
                    { value: "percent", label: "Giam theo %" },
                    { value: "fixed", label: "Giam tien mat" },
                    { value: "shipping", label: "Giam phi ship" }
                ]
            },
            { key: "discount", label: "Muc giam", type: "number", step: "0.01" },
            { key: "minSubtotal", label: "Don toi thieu", type: "number", step: "0.01" },
            { key: "maxDiscount", label: "Giam toi da", type: "number", step: "0.01" },
            { key: "label", label: "Mo ta hien thi", full: true },
            { key: "expiredAt", label: "Han su dung", type: "datetime-local" },
            {
                key: "isActive",
                label: "Kich hoat",
                type: "boolean",
                options: [
                    { value: "true", label: "Dang bat" },
                    { value: "false", label: "Dang tat" }
                ]
            }
        ]
    },
    reviews: {
        title: "Danh gia",
        resource: "reviews",
        fields: [
            { key: "userId", label: "Ma nguoi dung", type: "number" },
            { key: "productId", label: "Ma san pham", type: "number" },
            { key: "rating", label: "So sao", type: "number" },
            { key: "comment", label: "Noi dung", type: "textarea", full: true }
        ]
    },
    notifications: {
        title: "Thong bao",
        resource: "notifications",
        fields: [
            { key: "userId", label: "Ma nguoi dung", type: "number" },
            { key: "type", label: "Loai" },
            { key: "message", label: "Noi dung", type: "textarea", full: true },
            { key: "link", label: "Lien ket" },
            {
                key: "isRead",
                label: "Da doc",
                type: "boolean",
                options: [
                    { value: "false", label: "Chua doc" },
                    { value: "true", label: "Da doc" }
                ]
            }
        ]
    },
    contacts: {
        title: "Lien he",
        resource: "contacts",
        fields: [
            { key: "fullName", label: "Ho ten" },
            { key: "phoneNumber", label: "So dien thoai" },
            { key: "email", label: "Email", type: "email" },
            { key: "message", label: "Noi dung", type: "textarea", full: true },
            {
                key: "isReplied",
                label: "Da phan hoi",
                options: [
                    { value: "0", label: "Chua" },
                    { value: "1", label: "Da" }
                ]
            }
        ]
    }
};

const state = {
    moduleKey: "users",
    items: [],
    viewItems: [],
    editingId: null,
    authToken: null,
    currentAdmin: null,
    searchTerm: "",
    statsMonth: ""
};

const els = {
    appShell: document.getElementById("appShell"),
    loginOverlay: document.getElementById("loginOverlay"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginBtn: document.getElementById("loginBtn"),
    registerName: document.getElementById("registerName"),
    registerEmail: document.getElementById("registerEmail"),
    registerPassword: document.getElementById("registerPassword"),
    registerPhone: document.getElementById("registerPhone"),
    registerAddress: document.getElementById("registerAddress"),
    registerBtn: document.getElementById("registerBtn"),
    switchToRegisterBtn: document.getElementById("switchToRegisterBtn"),
    switchToLoginBtn: document.getElementById("switchToLoginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    sessionUser: document.getElementById("sessionUser"),
    moduleNav: document.getElementById("moduleNav"),
    moduleTitle: document.getElementById("moduleTitle"),
    statUsers: document.getElementById("statUsers"),
    statOrders: document.getElementById("statOrders"),
    statRevenue: document.getElementById("statRevenue"),
    statPending: document.getElementById("statPending"),
    statsMonth: document.getElementById("statsMonth"),
    statsAllBtn: document.getElementById("statsAllBtn"),
    ordersStatusChart: document.getElementById("ordersStatusChart"),
    paymentsStatusChart: document.getElementById("paymentsStatusChart"),
    topProductsChart: document.getElementById("topProductsChart"),
    tableTitle: document.getElementById("tableTitle"),
    tableHead: document.getElementById("tableHead"),
    tableBody: document.getElementById("tableBody"),
    searchInput: document.getElementById("searchInput"),
    pageInfo: document.getElementById("pageInfo"),
    prevPageBtn: document.getElementById("prevPageBtn"),
    nextPageBtn: document.getElementById("nextPageBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    newBtn: document.getElementById("newBtn"),
    recordForm: document.getElementById("recordForm"),
    submitBtn: document.getElementById("submitBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    formTitle: document.getElementById("formTitle"),
    editingHint: document.getElementById("editingHint"),
    toast: document.getElementById("toast")
};

bootstrap();

async function bootstrap() {
    await loadRuntimeConfig();
    init();
}

async function loadRuntimeConfig() {
    try {
        const response = await fetch("/api/env", { cache: "no-store" });
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        if (typeof data?.BASE_API === "string" && data.BASE_API.trim()) {
            BASE_API = data.BASE_API.trim();
        }
        if (typeof data?.AUTH_TOKEN_KEY === "string" && data.AUTH_TOKEN_KEY.trim()) {
            AUTH_TOKEN_KEY = data.AUTH_TOKEN_KEY.trim();
        }
    } catch (_) {
    }
}

function init() {
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const savedUserRaw = localStorage.getItem(AUTH_USER_KEY);
    const savedUser = safeParseJson(savedUserRaw);

    if (savedToken) {
        state.authToken = savedToken;
    }
    if (savedUser && typeof savedUser === "object") {
        state.currentAdmin = savedUser;
    }

    state.statsMonth = currentMonthValue();
    if (els.statsMonth) {
        els.statsMonth.value = state.statsMonth;
    }

    renderModuleNav();
    bindEvents();

    if (state.authToken) {
        unlockAdmin(getAdminLabel());
        loadDashboardStats();
        switchModule(state.moduleKey);
    } else {
        lockAdmin();
    }
}

function getAdminLabel() {
    if (!state.currentAdmin) {
        return "Dang nhap thanh cong";
    }

    const name = state.currentAdmin.name || "ADMIN";
    const email = state.currentAdmin.email || "";
    const role = state.currentAdmin.role || "ADMIN";

    if (email) {
        return `${name} (${email} - ${role})`;
    }
    return `${name} (${role})`;
}

function bindEvents() {
    els.loginBtn.addEventListener("click", () => login());
    els.registerBtn.addEventListener("click", () => register());
    els.switchToRegisterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchToRegisterForm();
    });
    els.switchToLoginBtn.addEventListener("click", (e) => {
        e.preventDefault();
        switchToLoginForm();
    });
    els.logoutBtn.addEventListener("click", () => logout());

    els.refreshBtn.addEventListener("click", () => loadList());
    els.refreshBtn.addEventListener("click", () => loadDashboardStats());
    els.statsMonth.addEventListener("change", (event) => {
        state.statsMonth = event.target.value || "";
        loadDashboardStats();
    });
    els.statsAllBtn.addEventListener("click", () => {
        state.statsMonth = "";
        els.statsMonth.value = "";
        loadDashboardStats();
    });
    els.searchInput.addEventListener("input", (event) => {
        state.searchTerm = (event.target.value || "").trim().toLowerCase();
        renderTable();
    });
    els.newBtn.addEventListener("click", () => resetForm());
    els.submitBtn.addEventListener("click", () => saveRecord());
    els.cancelEditBtn.addEventListener("click", () => resetForm());

}

function renderModuleNav() {
    const entries = Object.entries(modules);
    els.moduleNav.innerHTML = "";

    entries.forEach(([key, module]) => {
        const btn = document.createElement("button");
        btn.className = "module-btn";
        btn.type = "button";
        btn.textContent = module.title;
        btn.addEventListener("click", () => switchModule(key));
        btn.dataset.module = key;
        els.moduleNav.appendChild(btn);
    });
}

function switchModule(moduleKey) {
    state.moduleKey = moduleKey;
    state.editingId = null;

    for (const btn of els.moduleNav.querySelectorAll(".module-btn")) {
        btn.classList.toggle("active", btn.dataset.module === moduleKey);
    }

    const module = getCurrentModule();
    els.moduleTitle.textContent = module.title;
    els.tableTitle.textContent = `Danh sach ${module.title}`;
    els.searchInput.value = "";
    state.searchTerm = "";

    renderForm();
    resetForm();
    loadList();
}

function renderForm() {
    const module = getCurrentModule();
    els.recordForm.innerHTML = "";

    module.fields.forEach((field) => {
        const wrapper = document.createElement("div");
        wrapper.className = field.full ? "field full" : "field";

        const label = document.createElement("label");
        label.textContent = field.label;
        label.htmlFor = `field-${field.key}`;

        let input;
        if (field.options?.length) {
            input = document.createElement("select");

            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = "-- Chon --";
            input.appendChild(emptyOption);

            field.options.forEach((option) => {
                const opt = document.createElement("option");
                opt.value = option.value;
                opt.textContent = option.label;
                input.appendChild(opt);
            });
        } else if (field.type === "textarea") {
            input = document.createElement("textarea");
        } else {
            input = document.createElement("input");
            input.type = field.type === "boolean" ? "text" : (field.type || "text");
            if (field.step) {
                input.step = field.step;
            }
        }

        input.id = `field-${field.key}`;
        input.name = field.key;

        if (field.uploadable) {
            const uploadRow = document.createElement("div");
            uploadRow.className = "upload-row";

            const uploadBtn = document.createElement("button");
            uploadBtn.type = "button";
            uploadBtn.className = "btn btn-secondary";
            uploadBtn.textContent = "Tai anh len";

            const picker = document.createElement("input");
            picker.type = "file";
            picker.accept = "image/*";
            picker.style.display = "none";

            const preview = document.createElement("img");
            preview.className = "upload-preview hidden";
            preview.alt = `preview-${field.key}`;

            uploadBtn.addEventListener("click", () => picker.click());
            picker.addEventListener("change", async () => {
                const [file] = picker.files || [];
                if (!file) {
                    return;
                }

                await uploadImageAndFill(file, input, preview);
                picker.value = "";
            });

            input.addEventListener("input", () => updatePreview(preview, input.value));

            uploadRow.append(input, uploadBtn, picker);
            wrapper.append(label, uploadRow, preview);
        } else {
            wrapper.append(label, input);
        }

        els.recordForm.appendChild(wrapper);
    });
}

async function loadList() {
    try {
        const module = getCurrentModule();
        const url = resourceUrl(module.resource);
        const data = await request(url);

        state.items = Array.isArray(data) ? data : [];
        state.viewItems = state.items;

        renderTable();
        updatePagination();
    } catch (error) {
        showToast(error.message || "Khong the tai du lieu", true);
    }
}

function renderTable() {
    const module = getCurrentModule();
    const filteredItems = filterItems(state.items, state.searchTerm);
    state.viewItems = filteredItems;

    const visibleFieldKeys = module.fields.filter((f) => !f.hiddenInTable).map((f) => f.key);
    const dynamicKeys = inferColumns(filteredItems, module.fields.map((f) => f.key));
    const columns = ["id", ...visibleFieldKeys, ...dynamicKeys]
        .filter((value, index, arr) => arr.indexOf(value) === index);

    els.tableHead.innerHTML = "";
    const headRow = document.createElement("tr");

    columns.forEach((key) => {
        const th = document.createElement("th");
        th.textContent = getColumnLabel(module, key);
        headRow.appendChild(th);
    });

    const actionTh = document.createElement("th");
    actionTh.textContent = "thao tac";
    headRow.appendChild(actionTh);
    els.tableHead.appendChild(headRow);

    els.tableBody.innerHTML = "";

    if (!filteredItems.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = columns.length + 1;
        cell.textContent = state.searchTerm ? "Khong tim thay du lieu phu hop" : "Khong co du lieu";
        row.appendChild(cell);
        els.tableBody.appendChild(row);
        return;
    }

    filteredItems.forEach((item) => {
        const row = document.createElement("tr");

        columns.forEach((key) => {
            const cell = document.createElement("td");
            cell.textContent = valueToText(item[key]);
            row.appendChild(cell);
        });

        const actions = document.createElement("td");
        actions.className = "actions-cell";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-secondary";
        editBtn.textContent = "Chinh sua";
        editBtn.addEventListener("click", () => startEdit(item));

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn btn-danger";
        deleteBtn.textContent = "Xoa";
        deleteBtn.addEventListener("click", () => removeRecord(item.id));

        actions.append(editBtn, deleteBtn);
        row.appendChild(actions);
        els.tableBody.appendChild(row);
    });
}

function updatePagination() {
    els.pageInfo.textContent = `Tong ${state.viewItems.length} ban ghi`;
    els.prevPageBtn.disabled = true;
    els.nextPageBtn.disabled = true;
}

function startEdit(item) {
    state.editingId = item.id;
    const module = getCurrentModule();

    module.fields.forEach((field) => {
        if (field.noPrefill) {
            return;
        }
        const input = document.getElementById(`field-${field.key}`);
        if (!input) {
            return;
        }
        const rawValue = item[field.key];
        if (field.type === "boolean") {
            input.value = rawValue === true ? "true" : rawValue === false ? "false" : "";
        } else if (field.type === "datetime-local") {
            input.value = toDateTimeLocalInputValue(rawValue);
        } else {
            input.value = rawValue ?? "";
        }

        if (field.uploadable) {
            const preview = input.closest(".upload-row")?.parentElement?.querySelector(".upload-preview");
            if (preview) {
                updatePreview(preview, input.value);
            }
        }
    });

    els.formTitle.textContent = `Chinh sua #${item.id}`;
    els.editingHint.textContent = "Dang o che do cap nhat. Bam Luu ban ghi de gui PUT.";

    if (state.moduleKey === "products") {
        loadPrimaryImageForProduct(item.id);
    }
}

function resetForm() {
    state.editingId = null;
    els.recordForm.reset();
    for (const preview of els.recordForm.querySelectorAll(".upload-preview")) {
        preview.classList.add("hidden");
        preview.removeAttribute("src");
    }
    els.formTitle.textContent = "Tao ban ghi moi";
    els.editingHint.textContent = "Nhap thong tin va bam Luu ban ghi de gui POST.";
}

async function saveRecord() {
    const module = getCurrentModule();
    const payload = buildPayload(module.fields);
    const primaryImage = getFieldValue("primaryImage");

    try {
        let savedRecord;

        if (state.editingId) {
            savedRecord = await request(resourceUrl(`${module.resource}/${state.editingId}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (state.moduleKey === "products" && primaryImage) {
                await upsertProductImage(state.editingId, primaryImage);
            }

            showToast("Cap nhat thanh cong");
        } else {
            savedRecord = await request(resourceUrl(module.resource), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (state.moduleKey === "products" && primaryImage && savedRecord?.id) {
                await upsertProductImage(savedRecord.id, primaryImage);
            }

            showToast("Tao moi thanh cong");
        }

        resetForm();
        await loadList();
    } catch (error) {
        showToast(error.message || "Luu that bai", true);
    }
}

function unlockAdmin(userLabel) {
    els.appShell.classList.remove("locked");
    els.loginOverlay.classList.add("hidden");
    els.sessionUser.textContent = userLabel || "ADMIN";
    if (els.loginPassword) {
        els.loginPassword.value = "";
    }
}

function lockAdmin() {
    els.appShell.classList.add("locked");
    els.loginOverlay.classList.remove("hidden");
    els.sessionUser.textContent = "Chua dang nhap";
}

async function login() {
    const email = (els.loginEmail.value || "").trim();
    const password = els.loginPassword.value || "";

    if (!email || !password) {
        showLoginPopup("Nhap email va password de dang nhap");
        return;
    }

    try {
        const result = await request(resourceUrl("auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        }, true);

        if (!result || !result.token) {
            throw new Error("Phan hoi login khong hop le");
        }

        if ((result.role || "").toUpperCase() !== "ADMIN") {
            throw new Error("Chi tai khoan ADMIN moi duoc vao trang quan tri");
        }

        state.authToken = result.token;
        state.currentAdmin = result;
        localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result));

        unlockAdmin(getAdminLabel());
        showToast("Dang nhap thanh cong");
        await loadDashboardStats();
        switchModule(state.moduleKey);
    } catch (error) {
        const message = (error.message || "").toLowerCase();
        if (message.includes("http 401") || message.includes("sai thong tin dang nhap")) {
            showLoginPopup("Sai email hoac mat khau");
        } else {
            showLoginPopup(error.message || "Dang nhap that bai");
        }
        lockAdmin();
    }
}

function showLoginPopup(message) {
    window.alert(message);
}

async function logout() {
    try {
        if (state.authToken) {
            await request(resourceUrl("auth/logout"), { method: "POST" }, false, true);
        }
    } catch (_) {
    }

    state.authToken = null;
    state.currentAdmin = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    lockAdmin();
    showToast("Da dang xuat");
}

async function register() {
    const name = (els.registerName.value || "").trim();
    const email = (els.registerEmail.value || "").trim();
    const password = els.registerPassword.value || "";
    const phone = (els.registerPhone.value || "").trim();
    const address = (els.registerAddress.value || "").trim();

    if (!name || !email || !password) {
        showLoginPopup("Nhap day du thong tin: ho va ten, email va mat khau");
        return;
    }

    if (password.length < 6) {
        showLoginPopup("Mat khau phai co it nhat 6 ky tu");
        return;
    }

    try {
        const result = await request(resourceUrl("auth/register"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password,
                phoneNumber: phone || null,
                address: address || null
            })
        }, true);

        if (!result || !result.id) {
            throw new Error("Phan hoi dang ky khong hop le");
        }

        showLoginPopup("Dang ky thanh cong! Vui long dang nhap voi tai khoan moi");
        clearRegisterForm();
        switchToLoginForm();
    } catch (error) {
        const message = error.message || "";
        if (message.includes("da duoc dang ky")) {
            showLoginPopup("Email nay da duoc dang ky");
        } else {
            showLoginPopup(message || "Dang ky that bai");
        }
    }
}

function switchToRegisterForm() {
    els.loginForm.style.display = "none";
    els.registerForm.style.display = "block";
    document.getElementById("authTitle").textContent = "Dang ky tai khoan";
    document.getElementById("authHint").textContent = "Tao tai khoan de truy cap he thong quan tri.";
    clearRegisterForm();
}

function switchToLoginForm() {
    els.registerForm.style.display = "none";
    els.loginForm.style.display = "block";
    document.getElementById("authTitle").textContent = "Dang nhap quan tri";
    document.getElementById("authHint").textContent = "Chi tai khoan ADMIN moi duoc truy cap.";
    clearLoginForm();
}

function clearLoginForm() {
    els.loginEmail.value = "";
    els.loginPassword.value = "";
}

function clearRegisterForm() {
    els.registerName.value = "";
    els.registerEmail.value = "";
    els.registerPassword.value = "";
    els.registerPhone.value = "";
    els.registerAddress.value = "";
}

async function loadDashboardStats() {
    try {
        const [users, orders, payments, orderItems, products] = await Promise.all([
            fetchAll("users"),
            fetchAll("orders"),
            fetchAll("payments"),
            fetchAll("order-items"),
            fetchAll("products")
        ]);

        const filteredUsers = users.filter((user) => isInSelectedMonth(user.createdAt));
        const filteredOrders = orders.filter((order) => isInSelectedMonth(order.createdAt));
        const filteredPayments = payments.filter((payment) => isInSelectedMonth(payment.paidAy || payment.createdAt));
        const filteredOrderItems = orderItems.filter((item) => isInSelectedMonth(item.createdAt));

        const totalUsers = filteredUsers.length;
        const totalOrders = filteredOrders.length;
        const pendingOrders = filteredOrders.filter((order) => (order.status || "").toLowerCase() === "pending").length;

        const paidRevenue = filteredPayments
            .filter((payment) => (payment.status || "").toLowerCase() === "completed")
            .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        els.statUsers.textContent = String(totalUsers);
        els.statOrders.textContent = String(totalOrders);
        els.statPending.textContent = String(pendingOrders);
        els.statRevenue.textContent = formatCurrency(paidRevenue);

        const orderStatusCounts = countBy(filteredOrders, (item) => item.status || "khac");
        renderBarChart(els.ordersStatusChart, orderStatusCounts, mapOrderStatusLabel);

        const paymentStatusCounts = countBy(filteredPayments, (item) => item.status || "khac");
        renderBarChart(els.paymentsStatusChart, paymentStatusCounts, mapPaymentStatusLabel);

        const productNameById = new Map(products.map((product) => [Number(product.id), product.name || `SP #${product.id}`]));
        const quantityByProduct = new Map();
        filteredOrderItems.forEach((item) => {
            const key = Number(item.productId);
            const current = quantityByProduct.get(key) || 0;
            quantityByProduct.set(key, current + Number(item.quantity || 0));
        });

        const topProducts = Array.from(quantityByProduct.entries())
            .map(([productId, quantity]) => ({
                label: productNameById.get(productId) || `SP #${productId}`,
                value: quantity
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        renderBarChart(els.topProductsChart, topProducts, (text) => text, true);
    } catch (error) {
        showToast(error.message || "Khong tai duoc thong ke", true);
    }
}

async function fetchAll(resource) {
    const data = await request(resourceUrl(resource));
    return Array.isArray(data) ? data : [];
}

function countBy(items, keySelector) {
    const map = new Map();
    items.forEach((item) => {
        const key = String(keySelector(item)).toLowerCase();
        map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

function renderBarChart(container, rows, labelMapper, alreadyMapped = false) {
    container.innerHTML = "";
    if (!rows.length) {
        container.textContent = "Chua co du lieu";
        return;
    }

    const maxValue = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
    rows.forEach((row) => {
        const barRow = document.createElement("div");
        barRow.className = "bar-row";

        const label = document.createElement("span");
        label.className = "bar-label";
        const mapped = alreadyMapped ? row.label : labelMapper(row.label);
        label.textContent = mapped;

        const track = document.createElement("div");
        track.className = "bar-track";

        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = `${Math.max(6, (Number(row.value || 0) / maxValue) * 100)}%`;

        const value = document.createElement("span");
        value.className = "bar-value";
        value.textContent = String(row.value || 0);

        track.appendChild(fill);
        barRow.append(label, track, value);
        container.appendChild(barRow);
    });
}

function mapOrderStatusLabel(value) {
    const map = {
        pending: "Cho xu ly",
        processing: "Dang xu ly",
        shipped: "Dang giao",
        completed: "Hoan tat",
        cancelled: "Da huy"
    };
    return map[value] || value;
}

function mapPaymentStatusLabel(value) {
    const map = {
        pending: "Cho thanh toan",
        completed: "Thanh cong",
        failed: "That bai"
    };
    return map[value] || value;
}

function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value || 0));
}

function isInSelectedMonth(dateLike) {
    if (!state.statsMonth) {
        return true;
    }

    if (!dateLike) {
        return false;
    }

    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) {
        return false;
    }

    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return month === state.statsMonth;
}

function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function removeRecord(id) {
    if (!id) {
        showToast("Khong tim thay id de xoa", true);
        return;
    }

    const confirmed = window.confirm(`Xoa ban ghi #${id}?`);
    if (!confirmed) {
        return;
    }

    try {
        const module = getCurrentModule();
        await request(resourceUrl(`${module.resource}/${id}`), { method: "DELETE" });
        showToast("Xoa thanh cong");
        await loadList();
    } catch (error) {
        showToast(error.message || "Xoa that bai", true);
    }
}

function buildPayload(fields) {
    const payload = {};

    fields.forEach((field) => {
        if (field.virtual) {
            return;
        }

        const input = document.getElementById(`field-${field.key}`);
        if (!input) {
            return;
        }

        const raw = input.value;
        if (raw === "") {
            return;
        }

        if (field.type === "number") {
            const numeric = Number(raw);
            if (!Number.isNaN(numeric)) {
                payload[field.key] = numeric;
            }
            return;
        }

        if (field.type === "boolean") {
            payload[field.key] = raw === "true";
            return;
        }

        if (field.type === "datetime-local") {
            payload[field.key] = normalizeDateTimeLocalValue(raw);
            return;
        }

        payload[field.key] = raw;
    });

    return payload;
}

function inferColumns(items, preferredKeys) {
    const extraKeys = new Set();

    items.forEach((item) => {
        Object.keys(item).forEach((key) => {
            if (!preferredKeys.includes(key) && key !== "id") {
                extraKeys.add(key);
            }
        });
    });

    return Array.from(extraKeys);
}

function getColumnLabel(module, key) {
    if (key === "id") {
        return "ID";
    }

    const match = module.fields.find((field) => field.key === key);
    return match?.label || key;
}

function valueToText(value) {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    return String(value);
}

function toDateTimeLocalInputValue(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeDateTimeLocalValue(value) {
    if (!value) {
        return value;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        return `${value}:00`;
    }

    return value;
}

function toAbsoluteUrl(pathOrUrl) {
    if (!pathOrUrl) {
        return "";
    }

    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }

    const apiBase = cleanBaseUrl(BASE_API);
    const root = apiBase.replace(/\/api\/v1$/i, "");
    return `${root}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function updatePreview(previewEl, pathOrUrl) {
    const fullUrl = toAbsoluteUrl(pathOrUrl);
    if (!fullUrl) {
        previewEl.classList.add("hidden");
        previewEl.removeAttribute("src");
        return;
    }

    previewEl.src = fullUrl;
    previewEl.classList.remove("hidden");
}

async function uploadImageAndFill(file, targetInput, previewEl) {
    try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await request(resourceUrl("uploads/images"), {
            method: "POST",
            body: formData
        });

        const path = response?.path || response?.url;
        if (!path) {
            throw new Error("Upload thanh cong nhung khong nhan duoc URL anh");
        }

        targetInput.value = path;
        updatePreview(previewEl, path);
        showToast("Upload anh thanh cong");
    } catch (error) {
        showToast(error.message || "Upload anh that bai", true);
    }
}

function getFieldValue(fieldKey) {
    const input = document.getElementById(`field-${fieldKey}`);
    return input ? (input.value || "").trim() : "";
}

async function upsertProductImage(productId, imagePath) {
    const list = await request(resourceUrl("product-images"));
    const items = Array.isArray(list) ? list : [];
    const existing = items.find((item) => Number(item.productId) === Number(productId));

    const body = JSON.stringify({ productId, image: imagePath });
    if (existing?.id) {
        await request(resourceUrl(`product-images/${existing.id}`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body
        });
        return;
    }

    await request(resourceUrl("product-images"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
    });
}

async function loadPrimaryImageForProduct(productId) {
    try {
        const list = await request(resourceUrl("product-images"));
        const items = Array.isArray(list) ? list : [];
        const existing = items.find((item) => Number(item.productId) === Number(productId));

        const input = document.getElementById("field-primaryImage");
        if (!input) {
            return;
        }

        input.value = existing?.image || "";
        const preview = input.closest(".upload-row")?.parentElement?.querySelector(".upload-preview");
        if (preview) {
            updatePreview(preview, input.value);
        }
    } catch (_) {
    }
}

function filterItems(items, searchTerm) {
    if (!searchTerm) {
        return items;
    }

    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(searchTerm));
}

function getCurrentModule() {
    return modules[state.moduleKey];
}

function cleanBaseUrl(baseUrl) {
    return (baseUrl || "").trim().replace(/\/$/, "");
}

function resourceUrl(path) {
    const base = cleanBaseUrl(BASE_API);
    return `${base}/${path}`;
}

async function request(url, options = {}, skipAuth = false, suppressUnauthorizedHandler = false) {
    const requestOptions = {
        ...options,
        headers: {
            ...(options.headers || {})
        }
    };

    if (!skipAuth && state.authToken) {
        requestOptions.headers.Authorization = `Bearer ${state.authToken}`;
    }

    const response = await fetch(url, requestOptions);

    if (response.status === 401 && !skipAuth && !suppressUnauthorizedHandler) {
        state.authToken = null;
        state.currentAdmin = null;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        lockAdmin();
        throw new Error("Phien dang nhap het han. Vui long dang nhap lai.");
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    const data = text ? safeParseJson(text) : null;

    if (!response.ok) {
        const details = data && typeof data === "object" ? JSON.stringify(data) : text;
        throw new Error(`HTTP ${response.status}: ${details || "Yeu cau that bai"}`);
    }

    return data;
}

function safeParseJson(value) {
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

let toastTimer = null;
function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.style.background = isError ? "#7e2824" : "#1d252b";
    els.toast.classList.add("show");

    if (toastTimer) {
        clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
        els.toast.classList.remove("show");
    }, 1800);
}
