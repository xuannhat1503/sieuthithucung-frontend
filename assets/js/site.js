(function () {
    const AUTH_STORAGE_KEY = "psg-authenticated";
    const AUTH_USER_KEY = "psg-auth-user";
    let sharedAssetsPromise = null;
    const assetPromiseCache = new Map();

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
            `${assetBase}/js/custom.js`
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

        root.querySelectorAll("[data-psg-image]").forEach((image) => {
            image.setAttribute("src", `${assetBase}/${image.dataset.psgImage}`);
        });
    }

    function isAuthenticated() {
        const bodyState = document.body?.dataset.psgAuthState;
        if (bodyState === "authenticated") return true;
        if (bodyState === "guest") return false;
        return window.localStorage.getItem(AUTH_STORAGE_KEY) === "true";
    }

    function syncAccountMenus(scope) {
        const root = scope || document;
        const authenticated = isAuthenticated();

        root.querySelectorAll(".psg-account-menu").forEach((menu) => {
            menu.classList.toggle("is-authenticated", authenticated);
            menu.dataset.psgAuthState = authenticated ? "authenticated" : "guest";
        });

        root.querySelectorAll("[data-psg-logout]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                window.localStorage.removeItem(AUTH_STORAGE_KEY);
                window.localStorage.removeItem(AUTH_USER_KEY);
                window.location.reload();
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
        } catch (error) {
            console.error(error);
            target.innerHTML = `<div style="padding:16px;color:red;">Loi tai ${filePath}</div>`;
        }
    }

    async function initLayout(config) {
        await ensureSharedAssets();
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
        await Promise.all(jobs);
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
            ensureSharedAssets().then(() => {
                resolveDynamicPaths(document);
                syncAccountMenus(document);
                bindDemoAuthForms(document);
            }).catch(console.error);
        }
    }

    window.PSGSite = {
        ensureSharedAssets,
        resolveDynamicPaths,
        loadPartial,
        initLayout,
        syncAccountMenus
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoInitFromBody);
    } else {
        autoInitFromBody();
    }
})();




