(function () {
    const AUTH_STORAGE_KEY = "psg-authenticated";
    const AUTH_USER_KEY = "psg-auth-user";
    const API_BASE_STORAGE_KEY = "psg-api-base";
    const LOCAL_API_BASE = "http://127.0.0.1:8000/api";
    const DEPLOY_API_BASE = "/api";
    let sharedAssetsPromise = null;
    const assetPromiseCache = new Map();

    function configureLocalApiBase() {
        const localHosts = new Set(["localhost", "127.0.0.1"]);
        const isLocalHost = localHosts.has(window.location.hostname);
        const preferredApiBase = isLocalHost ? LOCAL_API_BASE : DEPLOY_API_BASE;
        const apiBaseCandidates = [preferredApiBase];

        window.PSG_API_BASE = preferredApiBase;
        window.PSG_API_BASES = apiBaseCandidates;

        try {
            window.sessionStorage.setItem(API_BASE_STORAGE_KEY, preferredApiBase);
        } catch (error) {
            // Ignore storage errors.
        }
    }

    configureLocalApiBase();

    function getContextBase() {
        const normalizedPath = window.location.pathname.replace(/\\/g, "/");
        const inNestedPage = /\/(partials|pages)\//.test(normalizedPath);
        return {
            assetBase: inNestedPage ? "../assets" : "./assets",
            pageBase: inNestedPage ? ".." : "."
        };
    }

    function loadStyleOnce(href) {
        if (document.head.querySelector(`link[data-psg-asset="${href}"]`)) {
            return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.setAttribute("data-psg-asset", href);
        document.head.appendChild(link);
    }

    function loadScriptOnce(src) {
        if (assetPromiseCache.has(src)) {
            return assetPromiseCache.get(src);
        }

        const existingScript = document.head.querySelector(`script[data-psg-asset="${src}"]`);
        if (existingScript) {
            const existingPromise = existingScript.dataset.psgLoaded === "true"
                ? Promise.resolve()
                : new Promise((resolve, reject) => {
                    existingScript.addEventListener("load", () => {
                        existingScript.dataset.psgLoaded = "true";
                        resolve();
                    }, { once: true });
                    existingScript.addEventListener("error", () => {
                        reject(new Error(`Khong the tai script ${src}`));
                    }, { once: true });
                });

            assetPromiseCache.set(src, existingPromise);
            return existingPromise;
        }

        const promise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.setAttribute("data-psg-asset", src);
            script.addEventListener("load", () => {
                script.dataset.psgLoaded = "true";
                resolve();
            }, { once: true });
            script.addEventListener("error", () => {
                reject(new Error(`Khong the tai script ${src}`));
            }, { once: true });
            document.head.appendChild(script);
        });

        assetPromiseCache.set(src, promise);
        return promise;
    }

    function ensureSharedAssets() {
        if (sharedAssetsPromise) {
            return sharedAssetsPromise;
        }

        const { assetBase } = getContextBase();
        const styles = [
            "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
            "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
            "https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.css",
            `${assetBase}/css/petsaigon-layout.css`
        ];
        const scripts = [
            "https://code.jquery.com/jquery-3.7.1.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js",
            `${assetBase}/js/custom.js`,
            `${assetBase}/js/cart-store.js`
        ];

        styles.forEach(loadStyleOnce);

        if (document.body) {
            document.body.dataset.psgAuthReady = "loading";
        }

        sharedAssetsPromise = (async () => {
            for (const src of scripts) {
                await loadScriptOnce(src);
            }

            if (document.body) {
                document.body.dataset.psgAuthReady = "true";
            }
        })().catch((error) => {
            if (document.body) {
                document.body.dataset.psgAuthReady = "error";
            }

            console.error(error);
        });

        return sharedAssetsPromise;
    }

    function resolveDynamicPaths(scope) {
        const root = scope || document;
        const { assetBase, pageBase } = getContextBase();

        root.querySelectorAll("[data-psg-page]").forEach((link) => {
            link.setAttribute("href", `${pageBase}/${link.dataset.psgPage}`);
        });

        root.querySelectorAll("[data-psg-href]").forEach((link) => {
            link.setAttribute("href", `${pageBase}/${link.dataset.psgHref}`);
        });

        root.querySelectorAll("form[data-psg-action]").forEach((form) => {
            form.setAttribute("action", `${pageBase}/${form.dataset.psgAction}`);
        });

        root.querySelectorAll("[data-psg-image]").forEach((image) => {
            image.setAttribute("src", `${assetBase}/${image.dataset.psgImage}`);
        });
    }

    function resolveActiveNavKey() {
        const page = (document.body?.dataset.psgPage || "").trim().toLowerCase();

        if (page === "home") {
            return "home";
        }

        if (page === "products" || page === "detail") {
            return "products";
        }

        return "";
    }

    function highlightActiveNavigation(scope) {
        const root = scope || document;
        const activeNavKey = resolveActiveNavKey();

        root.querySelectorAll(".psg-main-nav .psg-nav-item").forEach((item) => {
            item.classList.remove("active");

            if (!activeNavKey) {
                return;
            }

            const navLink = item.querySelector("[data-psg-nav]");
            if (navLink?.dataset.psgNav === activeNavKey) {
                item.classList.add("active");
            }
        });
    }

    function applyEngagementNavigation(scope) {
        const root = scope || document;
        const { pageBase } = getContextBase();
        const blogUrl = `${pageBase}/pages/customer-engagement.html`;
        const contactUrl = `${pageBase}/pages/customer-contact.html`;
        const wishlistUrl = `${pageBase}/pages/customer-engagement-wishlist.html`;

        const heartIcon = root.querySelector(".fa-heart");
        const wishlistLink = heartIcon ? heartIcon.closest("a") : null;
        if (wishlistLink) {
            wishlistLink.setAttribute("href", wishlistUrl);
        }

        const navItems = root.querySelectorAll(".psg-nav-items > .psg-nav-item");
        const blogItem = navItems[4];
        if (blogItem) {
            const blogLink = blogItem.querySelector(":scope > a");
            if (blogLink) {
                blogLink.setAttribute("href", blogUrl);
            }

            const blogTargets = [
                `${blogUrl}?category=dog`,
                `${blogUrl}?category=cat`,
                `${blogUrl}?category=tips`
            ];

            blogItem.querySelectorAll(".psg-submenu a").forEach((link, index) => {
                link.setAttribute("href", blogTargets[index] || blogUrl);
            });
        }

        const contactItem = navItems[5];
        if (contactItem) {
            const contactLink = contactItem.querySelector("a");
            if (contactLink) {
                contactLink.setAttribute("href", contactUrl);
            }
        }
    }

    function notifyLayoutReady() {
        document.dispatchEvent(new CustomEvent("psg:layout-ready"));
    }

    function normalizeUserRole(role) {
        return String(role || "").trim().toLowerCase();
    }

    function readStoredAuthUser() {
        try {
            const raw = window.localStorage.getItem(AUTH_USER_KEY);
            if (!raw) {
                return null;
            }

            const user = JSON.parse(raw);
            const email = String(user?.email || "").trim();
            const role = normalizeUserRole(user?.role);

            if (!email || role !== "customer") {
                return null;
            }

            return { ...user, email, role };
        } catch (error) {
            return null;
        }
    }

    function clearStoredAuthState() {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(AUTH_USER_KEY);
        document.dispatchEvent(new CustomEvent("psg:auth-updated", {
            detail: {
                user: null
            }
        }));
    }

    function buildLoginPageUrl() {
        const { pageBase } = getContextBase();
        return `${pageBase}/pages/login.html?logout=success`;
    }

    function isAuthenticated() {
        const authUser = readStoredAuthUser();
        if (!authUser) {
            clearStoredAuthState();
            return false;
        }

        return true;
    }

    function syncAccountMenus(scope) {
        const root = scope || document;
        const authenticated = isAuthenticated();

        root.querySelectorAll(".psg-account-menu").forEach((menu) => {
            menu.classList.toggle("is-authenticated", authenticated);
            menu.dataset.psgAuthState = authenticated ? "authenticated" : "guest";
        });

        root.querySelectorAll("[data-psg-logout]").forEach((button) => {
            if (button.dataset.psgLogoutBound === "true") {
                return;
            }

            button.dataset.psgLogoutBound = "true";
            button.addEventListener("click", (event) => {
                event.preventDefault();
                clearStoredAuthState();
                window.location.replace(buildLoginPageUrl());
            });
        });
    }

    function bindDemoAuthForms(scope) {
        const root = scope || document;
        const loginForm = root.querySelector(".login-form[action='#']:not([data-psg-api-auth='true'])");

        if (loginForm && root.body?.classList?.contains("login-body") !== false) {
            const isLoginPage = !!root.querySelector(".login-card h2") && /dang nhap|dang nh?p/i.test(root.querySelector(".login-card h2")?.textContent || "");
            if (isLoginPage) {
                loginForm.addEventListener("submit", (event) => {
                    event.preventDefault();
                    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
                    syncAccountMenus(document);
                });
            }
        }
    }

    function ensureSiteFavicon() {
        const { assetBase } = getContextBase();
        const faviconHref = `${assetBase}/images/petsaigon-favicon.svg`;
        let favicon = document.head.querySelector("link[data-psg-favicon='true']");

        if (!favicon) {
            favicon = document.createElement("link");
            favicon.rel = "icon";
            favicon.type = "image/svg+xml";
            favicon.setAttribute("data-psg-favicon", "true");
            document.head.appendChild(favicon);
        }

        favicon.href = faviconHref;
    }

    function guardApiAuthForms() {
        if (document.documentElement.dataset.psgAuthGuardBound === "true") {
            return;
        }

        document.documentElement.dataset.psgAuthGuardBound = "true";

        document.addEventListener("submit", (event) => {
            const form = event.target;
            if (!(form instanceof HTMLFormElement) || form.dataset.psgApiAuth !== "true") {
                return;
            }

            const authReadyState = document.body?.dataset.psgAuthReady;
            if (authReadyState === "true") {
                return;
            }

            event.preventDefault();

            const message = authReadyState === "error"
                ? "Khong the tai chuc nang dang ky/dang nhap. Vui long tai lai trang."
                : "Dang tai chuc nang dang ky/dang nhap. Vui long thu lai sau vai giay.";

            if (window.toastr && typeof window.toastr.warning === "function") {
                window.toastr.warning(message);
                return;
            }

            window.alert(message);
        }, true);
    }

    async function loadPartial(targetId, filePath) {
        const target = document.getElementById(targetId);
        if (!target) return;

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Khong the tai ${filePath}`);
            }

            target.innerHTML = await response.text();
            resolveDynamicPaths(target);
            syncAccountMenus(target);
            highlightActiveNavigation(target);
            applyEngagementNavigation(target);
        } catch (error) {
            console.error(error);
            target.innerHTML = `<div style="padding:16px;color:red;">Loi tai ${filePath}</div>`;
        }
    }

    async function initLayout(config) {
        const sharedAssetsJob = ensureSharedAssets();
        resolveDynamicPaths(document);
        syncAccountMenus(document);
        bindDemoAuthForms(document);

        if (!config) return;

        const jobs = [];
        if (config.headerTarget && config.headerPath) {
            jobs.push(loadPartial(config.headerTarget, config.headerPath));
        }
        if (config.footerTarget && config.footerPath) {
            jobs.push(loadPartial(config.footerTarget, config.footerPath));
        }
        await Promise.all([sharedAssetsJob, ...jobs]);
        highlightActiveNavigation(document);
        applyEngagementNavigation(document);
        notifyLayoutReady();
    }

    function autoInitFromBody() {
        const body = document.body;
        if (!body) return;

        guardApiAuthForms();
        ensureSiteFavicon();

        const headerTarget = body.dataset.psgHeaderTarget;
        const headerPath = body.dataset.psgHeaderPath;
        const footerTarget = body.dataset.psgFooterTarget;
        const footerPath = body.dataset.psgFooterPath;

        if (headerTarget || footerTarget) {
            initLayout({ headerTarget, headerPath, footerTarget, footerPath }).catch(console.error);
        } else {
            resolveDynamicPaths(document);
            syncAccountMenus(document);
            bindDemoAuthForms(document);
            highlightActiveNavigation(document);
            applyEngagementNavigation(document);
            notifyLayoutReady();
            ensureSharedAssets().catch(console.error);
        }
    }

    window.PSGSite = {
        ensureSharedAssets,
        resolveDynamicPaths,
        loadPartial,
        initLayout,
        syncAccountMenus,
        highlightActiveNavigation
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoInitFromBody);
    } else {
        autoInitFromBody();
    }
})();




