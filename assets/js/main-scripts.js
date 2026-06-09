/**
 * MAIN-SCRIPTS.JS
 * Single page app router for index.html with clean URLs.
 */

const SHEET_CONFIG = {
    DATA_PATH: '/assets/others/base-data/admin.php?action=get_posts',
};

const DEFAULT_PAGINATION = {
    homeCategoriesPerPage: 3,
    categoryPostsPerPage: 5,
};

const APP_BASE_PATH = (() => {
    const baseTag = document.querySelector('base[href]');
    const path = baseTag
        ? new URL(baseTag.getAttribute('href'), window.location.href).pathname
        : (window.location.pathname || '').replace(/index\.html$/i, '');
    return path.endsWith('/') ? path : `${path}/`;
})();


const APP_ROOT_PATH = (() => {
    if (APP_BASE_PATH.includes('/pages/')) {
        return APP_BASE_PATH.substring(0, APP_BASE_PATH.indexOf('/pages/') + 1);
    }
    return APP_BASE_PATH;
})();

function withAppBase(path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path) || /^mailto:/i.test(path) || /^tel:/i.test(path)) return path;
    const clean = path.replace(/\/+/g, '/');
    if (clean.startsWith('/')) {
        const trimmed = clean.replace(/^\/+/, '');
        return `${APP_ROOT_PATH}${trimmed}`.replace(/\/+/g, '/');
    }
    return `${APP_BASE_PATH}${clean}`.replace(/\/+/g, '/');
}

const ADMIN_SETTINGS_PATH = withAppBase('/assets/others/base-data/admin.php');
window.adminSettings = {
    paginationConfig: { ...DEFAULT_PAGINATION },
    pageConfig: [],
    dropdownMenus: []
};

function slugify(value) {
    if (!value && value !== 0) return '';
    return value.toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function isVisiblePostRow(row) {
    return (row?.[6] || '').toString().trim().toLowerCase() !== 'none';
}

function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
}

function normalizePath(pathname = window.location.pathname) {
    const clean = pathname.replace(/\/+/g, '/');
    const basePattern = APP_BASE_PATH === '/' ? '' : APP_BASE_PATH.replace(/\//g, '\\/');
    const stripped = basePattern ? clean.replace(new RegExp(`^${basePattern}`), '') : clean;
    return stripped.replace(/^\/+|\/+$/g, '');
}

function getRouteInfo() {
    const pathname = normalizePath(window.location.pathname);
    const segments = pathname ? pathname.split('/') : [];
    if (segments.length === 0) {
        return { route: 'home', page: 1 };
    }

    const [first, second, third] = segments;

    // Treat explicit index files as home route (e.g. /index.html or /index)
    if (first === 'index.html' || first === 'index' || first === 'index.php') {
        return { route: 'home', page: 1 };
    }

    if (first === 'page' && second && /^\d+$/.test(second)) {
        return { route: 'home', page: Number(second) };
    }

    if (first === 'c') {
        return {
            route: 'category',
            slug: second ? second.trim() : '',
            page: segments[2] === 'page' && segments[3] && /^\d+$/.test(segments[3]) ? Number(segments[3]) : 1,
        };
    }

    if (first === 'p') {
        if (!second || !second.trim()) {
            return { route: 'notfound' };
        }
        return {
            route: 'post',
            slug: second.trim(),
            page: segments[2] === 'page' && segments[3] && /^\d+$/.test(segments[3]) ? Number(segments[3]) : 1,
        };
    }

    if (first === 'f' || first === 'q') {
        const raw = segments.slice(1).join('/');
        return {
            route: 'search',
            query: raw ? decodeURIComponent(raw).trim() : '',
        };
    }

    if (first === 'tag') {
        const rawTag = segments.slice(1).join('/');
        return {
            route: 'tag',
            query: rawTag ? decodeURIComponent(rawTag).trim() : '',
        };
    }

    if (first === 'contact') {
        return { route: 'contact' };
    }

    return { route: 'notfound' };
}

function getRouteFallbackFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) {
        return { route: 'post', slug: params.get('id').trim() };
    }
    if (params.get('category')) {
        return { route: 'category', slug: slugify(params.get('category').trim()) };
    }
    if (params.get('q')) {
        return { route: 'search', query: params.get('q').trim() };
    }
    if (params.get('tag')) {
        return { route: 'tag', query: params.get('tag').trim() };
    }
    return null;
}

function getPageConfig() {
    try {
        const configSource = window.adminSettings?.pageConfig;
        if (Array.isArray(configSource) && configSource.length > 0) {
            let config = configSource.map(item => ({
                ...item,
                label: item.label || item.category || '',
                category: item.category || item.label || '',
            }));
            config.sort((a, b) => (a.order || 0) - (b.order || 0));
            if (localStorage.getItem('appPageAutoSortByName') === 'true') {
                config.sort((a, b) => a.label.localeCompare(b.label, 'vi', { sensitivity: 'base' }));
            }
            return config;
        }

        const stored = localStorage.getItem('appPageConfig');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                let config = parsed.map(item => ({
                    ...item,
                    label: item.label || item.category || '',
                    category: item.category || item.label || '',
                }));
                config.sort((a, b) => (a.order || 0) - (b.order || 0));
                if (localStorage.getItem('appPageAutoSortByName') === 'true') {
                    config.sort((a, b) => a.label.localeCompare(b.label, 'vi', { sensitivity: 'base' }));
                }
                return config;
            }
        }
    } catch (error) {
        console.warn('Không đọc được pageConfig', error);
    }
    return [];
}

function getDropdownMenus() {
    try {
        const configSource = window.adminSettings?.dropdownMenus;
        if (Array.isArray(configSource)) {
            return configSource;
        }
    } catch (error) {
        console.warn('Không đọc được dropdown menus', error);
    }
    return [];
}

async function loadAdminSettings() {
    try {
        const res = await fetch(ADMIN_SETTINGS_PATH + '?action=public_config&t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('Không thể tải cấu hình');
        const data = await res.json();
        if (data && typeof data === 'object') {
            if (data.paginationConfig && typeof data.paginationConfig === 'object') {
                // Accept both legacy keys and new keys
                const categoriesPerPage = Number(data.paginationConfig.categoriesPerPage ?? data.paginationConfig.homeCategoriesPerPage);
                const postsPerCategoryPage = Number(data.paginationConfig.postsPerCategoryPage ?? data.paginationConfig.categoryPostsPerPage);
                window.adminSettings.paginationConfig = {
                    homeCategoriesPerPage: Number.isInteger(categoriesPerPage) && categoriesPerPage > 0 ? categoriesPerPage : DEFAULT_PAGINATION.homeCategoriesPerPage,
                    categoryPostsPerPage: Number.isInteger(postsPerCategoryPage) && postsPerCategoryPage > 0 ? postsPerCategoryPage : DEFAULT_PAGINATION.categoryPostsPerPage,
                };
            }
            if (Array.isArray(data.pageConfig)) {
                window.adminSettings.pageConfig = data.pageConfig;
            }
            if (Array.isArray(data.dropdownMenus)) {
                window.adminSettings.dropdownMenus = data.dropdownMenus;
            }
        }
    } catch (error) {
        console.error('Lỗi tải cấu hình admin:', error);
    }
}

function getPaginationConfig() {
    const defaultConfig = { ...DEFAULT_PAGINATION };
    try {
        const config = window.adminSettings?.paginationConfig;
        if (config && typeof config === 'object') {
            return {
                homeCategoriesPerPage: Number.isInteger(config.homeCategoriesPerPage) && config.homeCategoriesPerPage > 0 ? config.homeCategoriesPerPage : defaultConfig.homeCategoriesPerPage,
                categoryPostsPerPage: Number.isInteger(config.categoryPostsPerPage) && config.categoryPostsPerPage > 0 ? config.categoryPostsPerPage : defaultConfig.categoryPostsPerPage,
            };
        }
    } catch (error) {
        console.warn('Không đọc config phân trang', error);
    }
    return defaultConfig;
}

function buildAdminRequestUrls(query) {
    const cacheKiller = Date.now();
    const suffix = `${query}&v=${cacheKiller}`;
    return [
        `${ADMIN_SETTINGS_PATH}?${suffix}`,
        `assets/others/base-data/admin.php?${suffix}`,
        `../assets/others/base-data/admin.php?${suffix}`,
        `../../assets/others/base-data/admin.php?${suffix}`
    ];
}

async function fetchLocalData() {
    const candidates = buildAdminRequestUrls('action=get_posts&page=1');
    const header = ["ID", "Tên bài viết", "Link img", "(alt) img", "Trích dẫn <p>", "Nội dung bài viết", "Chuyên mục", "Tag", "Thời gian", "Link page"];

    let lastError = null;
    for (const basePath of candidates) {
        try {
            // Fetch all pages to get complete data (especially needed for homepage category grouping)
            let allPosts = [];
            let page = 1;
            let totalPages = 1;

            while (page <= totalPages) {
                const pathWithPage = basePath.replace(/page=\d+/, `page=${page}`);
                const res = await fetch(pathWithPage, { cache: 'no-store' });
                if (!res.ok) {
                    lastError = new Error(`Failed to load posts: ${basePath} page ${page} returned ${res.status}`);
                    break;
                }
                const json = await res.json();
                if (json.status === 'success' && Array.isArray(json.posts)) {
                    allPosts = allPosts.concat(json.posts);
                    totalPages = json.pagination?.totalPages || 1;
                    page++;
                } else {
                    lastError = new Error('Dữ liệu không đúng định dạng');
                    break;
                }
            }

            if (allPosts.length > 0) {
                return [header, ...allPosts];
            }
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('Không thể tải dữ liệu');
}

async function fetchPostDetail(postId) {
    const candidates = buildAdminRequestUrls(`action=get_post&id=${encodeURIComponent(postId)}`);

    let lastError = null;
    for (const path of candidates) {
        try {
            const res = await fetch(path, { cache: 'no-store' });
            if (!res.ok) {
                lastError = new Error(`Failed to load post detail: ${path} returned ${res.status}`);
                continue;
            }
            const json = await res.json();
            if (json.status === 'success' && json.post && typeof json.post === 'object') {
                return json.post;
            }
            lastError = new Error(json.message || 'Không thể tải bài viết');
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('Không thể tải bài viết');
}

function resolveComponentUrl(url) {
    return window.location.origin + withAppBase(url);
}

function loadComponent(url, elementSelector, isHead = false, callback = null) {
    const resolvedUrl = resolveComponentUrl(url);
    const cacheKiller = Date.now();
    const finalUrl = `${resolvedUrl}?t=${cacheKiller}`;
    fetch(finalUrl, { cache: 'no-store' })
        .then(response => {
            if (response.status === 404 && !url.includes('404')) {
                window.location.href = '/404.html';
                throw new Error('404 - Redirect');
            }
            if (!response.ok) throw new Error('Không tìm thấy file: ' + url);
            return response.text();
        })
        .then(html => {
            if (isHead) {
                document.head.insertAdjacentHTML('afterbegin', html);
            } else {
                const element = document.querySelector(elementSelector);
                if (element) element.innerHTML = html;
                if (callback) callback();
            }
        })
        .catch(error => {
            if (!error.message.includes('404 - Redirect')) {
                console.error('Lỗi load component:', error);
            }
        });
}

function buildCategoryUrl(categorySlug, pageNumber = 1) {
    if (!categorySlug) return withAppBase('/');
    const path = pageNumber > 1 ? `/c/${categorySlug}/page/${pageNumber}` : `/c/${categorySlug}`;
    return withAppBase(path);
}

function buildPostUrl(postId, title, pageNumber = 1) {
    const id = (postId || '').toString();
    const path = pageNumber > 1 ? `/p/${id}/page/${pageNumber}` : `/p/${id}`;
    return withAppBase(path);
}

function buildSearchUrl(keyword) {
    return withAppBase(`/f/${encodeURIComponent(keyword)}`);
}

function buildSearchAliasUrl(keyword) {
    return withAppBase(`/q/${encodeURIComponent(keyword)}`);
}

function buildTagUrl(tag) {
    return withAppBase(`/tag/${encodeURIComponent(tag)}`);
}

function buildHomeUrl(pageNumber = 1) {
    return withAppBase(pageNumber > 1 ? `/page/${pageNumber}` : '/');
}

function findPageDefinitionBySlug(slug) {
    if (!slug) return null;
    const normalized = slugify(slug);
    const pages = getPageConfig();
    return pages.find(page => slugify(page.category || page.label || '') === normalized || slugify(page.label || '') === normalized);
}

function normalizeMenuHref(href) {
    if (href === undefined || href === null) return '';
    const clean = href.toString().trim();
    if (clean === '' || clean === '#') return clean;
    if (clean.startsWith('/pages/')) {
        return clean;
    }
    if (clean.startsWith('/tag/')) {
        const tag = decodeURIComponent(clean.split('/').slice(2).join('/'));
        return buildTagUrl(tag);
    }
    return withAppBase(clean);
}

function isMenuParentOnly(href) {
    return !href || href.toString().trim() === '#';
}

function renderPageLinks() {
    const pages = getPageConfig();
    const dropdownMenus = getDropdownMenus();

    const desktop = document.getElementById('dynamicPageLinksDesktop');
    if (desktop) {
        const existingLis = Array.from(desktop.querySelectorAll('li'));
        const homeLi = existingLis.find(li => li.querySelector('a')?.getAttribute('href') === '/');
        const contactLi = existingLis.find(li => li.querySelector('a')?.getAttribute('href') === '/contact');
        const categoryMenuLi = existingLis.find(li => li.getAttribute('data-menu') === 'categories');
        const tagMenuLi = existingLis.find(li => li.getAttribute('data-menu') === 'tags');

        desktop.innerHTML = '';
        if (homeLi) desktop.appendChild(homeLi);
        if (categoryMenuLi) desktop.appendChild(categoryMenuLi);
        if (tagMenuLi) desktop.appendChild(tagMenuLi);

        dropdownMenus.forEach(menu => {
            const li = document.createElement('li');
            li.className = 'dropdown-item';
            li.setAttribute('data-menu', menu.name);
            li.innerHTML = `
                <a href="#">${menu.label}</a>
                <div class="caret"></div>
                <ul class="dropdown-menu">
                    ${renderMenuItems(menu.items)}
                </ul>
            `;
            desktop.appendChild(li);
        });

        if (contactLi) desktop.appendChild(contactLi);
    }

    const mobile = document.getElementById('dynamicPageLinksMobile');
    if (mobile) {
        const existingLis = Array.from(mobile.querySelectorAll('li'));
        const homeLi = existingLis.find(li => li.querySelector('a')?.getAttribute('href') === '/');
        const contactLi = existingLis.find(li => li.querySelector('a')?.getAttribute('href') === '/contact');
        const categoryMenuLi = existingLis.find(li => li.getAttribute('data-menu') === 'categories');
        const tagMenuLi = existingLis.find(li => li.getAttribute('data-menu') === 'tags');

        mobile.innerHTML = '';
        if (homeLi) mobile.appendChild(homeLi);
        if (categoryMenuLi) mobile.appendChild(categoryMenuLi);
        if (tagMenuLi) mobile.appendChild(tagMenuLi);

        dropdownMenus.forEach(menu => {
            const li = document.createElement('li');
            li.className = 'mobile-menu-item';
            li.setAttribute('data-menu', menu.name);

            const itemsHtml = (menu.items && menu.items.length) ? renderMenuItems(menu.items, true) : '';
            if (itemsHtml && itemsHtml.trim()) {
                li.innerHTML = `
                    <div class="mobile-drop-btn">
                        <span class="mobile-menu-title">${menu.label}</span>
                        <button type="button" class="mobile-toggle-btn" onclick="event.preventDefault(); toggleMobileMenu('${menu.name}')" aria-label="Mở ${menu.label}">
                            <span class="caret"></span>
                        </button>
                    </div>
                    <div class="mobile-dropdown-content">
                        ${itemsHtml}
                    </div>
                `;
            } else {
                const href = normalizeMenuHref(menu.href || menu.url || '#');
                if (href && href !== '#') {
                    li.innerHTML = `<a href="${href}" onclick="toggleMenu()">${menu.label}</a>`;
                } else {
                    li.innerHTML = `<div class="mobile-drop-btn"><span class="mobile-menu-title">${menu.label}</span></div>`;
                }
            }
            mobile.appendChild(li);
        });

        if (contactLi) mobile.appendChild(contactLi);
    }
}

// Ensure dynamic header/footer links are adapted for SPA and avoid undefined function errors
async function renderDynamicMenu() {
    try {
        const anchors = Array.from(document.querySelectorAll('#header-placeholder a, #header-placeholder li a, #footer-placeholder a, .dropdown-menu a'));
        anchors.forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!href.startsWith('/')) return;
            if (href === '/' || href.startsWith('/contact') || href.startsWith('/tag/') || href.startsWith('/f/') || href.startsWith('/q/') || href.startsWith('/c/') || href.startsWith('/p/')) {
                a.setAttribute('href', withAppBase(href));
                return;
            }
            // Convert legacy /pages/*.html to SPA routes when possible
            if (href.startsWith('/pages/')) {
                a.setAttribute('href', withAppBase(href));
                return;
            }
        });
        const pages = getPageConfig();
        const visibleCategories = pages.filter(page => {
            const category = (page.category || page.label || '').toString().trim();
            return category && category.toLowerCase() !== 'none';
        });

        const categoryHtml = visibleCategories.map(page => {
            const category = (page.category || page.label || '').toString().trim();
            const slug = slugify(category);
            return `<li><a href="${buildCategoryUrl(slug)}">${page.label}</a></li>`;
        }).join('');

        let tagGroupHtml = '';
        let mobileTagHtml = '';
        try {
            const allRows = await fetchLocalData();
            const rows = Array.isArray(allRows) ? allRows.slice(1).filter(isVisiblePostRow) : [];
            const groupedTags = new Map();

            rows.forEach(row => {
                const category = (row[6] || '').toString().trim();
                if (!category || category.toLowerCase() === 'none') return;
                const key = category.toLowerCase();
                if (!groupedTags.has(key)) groupedTags.set(key, { label: category, tags: new Set() });
                const rawTags = (row[7] || '').toString();
                rawTags.split(/[,;|]/).forEach(tag => {
                    const value = tag.toString().trim();
                    if (value) groupedTags.get(key).tags.add(value);
                });
            });

            const categoryOrder = getPageConfig()
                .map(page => (page.category || page.label || '').toString().trim().toLowerCase())
                .filter(cat => cat && cat !== 'none');

            const sortedGroups = Array.from(groupedTags.values())
                .sort((a, b) => {
                    const aKey = a.label.toLowerCase();
                    const bKey = b.label.toLowerCase();
                    const aIndex = categoryOrder.indexOf(aKey);
                    const bIndex = categoryOrder.indexOf(bKey);
                    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    return a.label.localeCompare(b.label, 'vi', { sensitivity: 'base' });
                });

            tagGroupHtml = sortedGroups.map(group => {
                const items = Array.from(group.tags).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }))
                    .map(tag => `<li><a href="${buildTagUrl(tag)}">${tag}</a></li>`)
                    .join('');
                const hasClass = items ? 'has-submenu submenu-parent' : '';
                return `<li class="${hasClass}"><a href="${buildCategoryUrl(slugify(group.label))}">${group.label}</a>${items ? `<ul class="submenu-level-3">${items}</ul>` : ''}</li>`;
            }).join('');

            mobileTagHtml = sortedGroups.map(group => {
                const submenuId = `tag-${slugify(group.label)}`;
                const categoryHref = buildCategoryUrl(slugify(group.label));
                const tagsArr = Array.from(group.tags).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
                const tags = tagsArr.map(tag => `<a href="${buildTagUrl(tag)}" onclick="toggleMenu()">${tag}</a>`).join('');
                if (tagsArr.length === 0) {
                    // No tags: render a single link to the category (no toggle button)
                    return `<div class="mobile-sub-container"><a class="mobile-sub-link" href="${categoryHref}" onclick="toggleMenu()">${group.label}</a></div>`;
                }
                return `<div class="mobile-sub-container">
                    <div class="mobile-sub-row">
                        <a class="mobile-sub-link" href="${categoryHref}" onclick="toggleMenu()">${group.label}</a>
                        <button type="button" class="mobile-sub-btn" data-submenu="${submenuId}" onclick="event.preventDefault(); toggleMobileSubmenu('${submenuId}')" aria-label="Mở submenu">
                            <span class="caret"></span>
                        </button>
                    </div>
                    <div class="mobile-dropdown-content sub-content" data-submenu="${submenuId}">${tags}</div>
                </div>`;
            }).join('');
        } catch (err) {
            console.warn('Cannot load tags', err);
        }

        const catMenu = document.getElementById('dynamic-category-menu');
        const tagMenu = document.getElementById('dynamic-tag-menu');
        const mobileCatContainer = document.getElementById('dynamic-category-menu-mobile');
        const mobileTagContainer = document.getElementById('dynamic-tag-menu-mobile');

        if (catMenu) {
            catMenu.innerHTML = categoryHtml || '<li><a href="/">Không có chuyên mục</a></li>';
        }
        if (tagMenu) {
            tagMenu.innerHTML = tagGroupHtml || '<li><a href="/">Không có thẻ</a></li>';
        }
        if (mobileCatContainer) {
            mobileCatContainer.innerHTML = visibleCategories.map(page => {
                const slug = slugify((page.category || page.label || '').toString());
                return `<a href="${buildCategoryUrl(slug)}" onclick="toggleMenu()">${page.label}</a>`;
            }).join('') || '<a href="/" onclick="toggleMenu()">Không có chuyên mục</a>';
        }
        if (mobileTagContainer) {
            mobileTagContainer.innerHTML = mobileTagHtml || '<a href="/" onclick="toggleMenu()">Không có thẻ</a>';
        }
    } catch (e) {
        console.warn('renderDynamicMenu error', e);
    }
}

function renderMenuItems(items, isMobile = false) {
    return items.map(item => {
        const href = normalizeMenuHref(item.href || item.url || '#');
        const isParentOnly = isMenuParentOnly(item.href || item.url);

        if (item.submenu && Array.isArray(item.submenu)) {
            if (isMobile) {
                const submenuId = slugify(item.label || 'submenu');
                const anchorAttrs = isParentOnly
                    ? 'href="#" onclick="event.preventDefault();"'
                    : `href="${href}" onclick="toggleMenu()"`;
                return `<div class="mobile-sub-container">
                    <div class="mobile-sub-row">
                        <a class="mobile-sub-link" ${anchorAttrs}>${item.label}</a>
                        <button type="button" class="mobile-sub-btn" data-submenu="${submenuId}" onclick="event.preventDefault(); toggleMobileSubmenu('${submenuId}')" aria-label="Mở submenu">
                            <span class="caret"></span>
                        </button>
                    </div>
                    <div class="mobile-dropdown-content sub-content" data-submenu="${submenuId}">
                        ${renderMenuItems(item.submenu, true)}
                    </div>
                </div>`;
            }
            const anchorAttrs = isParentOnly
                ? 'href="#" onclick="event.preventDefault();"'
                : `href="${href}"`;
            return `<li class="has-submenu">
                    <a ${anchorAttrs}>${item.label}</a>
                    <ul class="submenu">
                        ${renderMenuItems(item.submenu)}
                    </ul>
                </li>`;
        }

        if (isMobile) {
            if (isParentOnly) {
                return `<span class="mobile-sub-text">${item.label}</span>`;
            }
            return `<a href="${href}" onclick="toggleMenu()">${item.label}</a>`;
        }

        if (isParentOnly) {
            return `<li><span>${item.label}</span></li>`;
        }
        return `<li><a href="${href}">${item.label}</a></li>`;
    }).join('');
}

function getPostIdFromSlug(slug) {
    if (!slug) return null;
    const parts = slug.split('-');
    if (/^[A-Za-z0-9_-]+$/.test(parts[0])) {
        return parts[0];
    }
    return null;
}

function parsePostSlug(slug) {
    if (!slug) return { id: null, raw: '' };
    const id = getPostIdFromSlug(slug);
    if (id) {
        return { id, raw: slug.slice(id.length + 1) };
    }
    return { id: null, raw: slug };
}

function isInternalAppLink(href) {
    if (!href) return false;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    try {
        const parsed = new URL(href, window.location.origin);
        if (parsed.origin !== window.location.origin) return false;
        const pathname = parsed.pathname;
        const currentPath = window.location.pathname || '';
        if (currentPath.startsWith('/pages/')) {
            return false;
        }
        if (pathname.startsWith('/assets/') || pathname.startsWith('/components/') || pathname === '/404.html' || pathname.startsWith('/pages/')) {
            return false;
        }
        return true;
    } catch (error) {
        return false;
    }
}

function navigateTo(path, replace = false) {
    if (!path) return;
    const normalized = withAppBase(path.replace(/\/+/g, '/'));
    if (replace) {
        window.history.replaceState({}, '', normalized);
    } else {
        window.history.pushState({}, '', normalized);
    }
    renderRoute();
}

function hideAllSections() {
    const ids = ['home-page', 'category-page', 'search-page', 'tag-page', 'post-page', 'contact-page'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function showSection(id) {
    hideAllSections();
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

function updateDocumentTitle(part) {
    document.title = part ? `${part} | An Tiến pro` : 'An Tiến pro';
}

async function renderRoute() {
    const routeInfo = getRouteInfo();
    if (routeInfo.route === 'notfound') {
        const fallback = getRouteFallbackFromQuery();
        if (fallback) {
            return navigateTo(window.location.pathname);
        }
        window.location.href = withAppBase('/404.html');
        return;
    }

    switch (routeInfo.route) {
        case 'home':
            showSection('home-page');
            toggleGalleryVisibility(true);
            updateDocumentTitle('Trang chủ');
            await loadHomePage(routeInfo.page || 1);
            break;
        case 'category':
            showSection('category-page');
            toggleGalleryVisibility(false);
            await loadCategoryPage(routeInfo.slug, routeInfo.page || 1);
            break;
        case 'post':
            showSection('post-page');
            toggleGalleryVisibility(false);
            await loadPostPage(routeInfo.slug, routeInfo.page || 1);
            break;
        case 'search':
            showSection('search-page');
            toggleGalleryVisibility(false);
            await renderSearchResults(routeInfo.query || '');
            updateDocumentTitle(routeInfo.query ? `Tìm kiếm: ${routeInfo.query}` : 'Tìm kiếm');
            break;
        case 'tag':
            showSection('tag-page');
            toggleGalleryVisibility(false);
            await renderTagResults(routeInfo.query || '');
            updateDocumentTitle(routeInfo.query ? `Tag: ${routeInfo.query}` : 'Tag');
            break;
        case 'contact':
            showSection('contact-page');
            toggleGalleryVisibility(false);
            updateDocumentTitle('Liên hệ');
            attachContactFormListener();
            break;
        default:
            window.location.href = withAppBase('/404.html');
            break;
    }
}

async function loadHomePage(pageNumber = 1) {
    const mainArea = document.getElementById('main-content-area');
    const pagination = document.querySelector('#home-page .pagination');
    if (!mainArea || !pagination) return;
    try {
        const allRows = await fetchLocalData();
        const rows = allRows.slice(1).filter(isVisiblePostRow);
        const { homeCategoriesPerPage, categoryPostsPerPage } = getPaginationConfig();
        const categories = {};

        rows.forEach(row => {
            const title = row[1] || '';
            const excerpt = row[4] || '';
            const catName = (row[6] || '').toString().trim();
            const imgUrl = row[2] || '';
            const imgAlt = row[3] || '';
            const postID = row[0] || '';
            const sortOrder = parseFloat(row[8]) || 0;
            if (!title || !catName || catName.toLowerCase() === 'none') return;
            if (!categories[catName]) categories[catName] = { articles: [], label: catName };
            categories[catName].articles.push({ title, excerpt, imgUrl, imgAlt, postID, sortOrder });
        });

        const pages = getPageConfig().filter(page => {
            const category = (page.category || page.label || '').toString().trim();
            return category && category.toLowerCase() !== 'none';
        });
        const configOrder = pages.map(page => (page.category || page.label || '').toString().trim().toLowerCase());
        const names = Object.keys(categories);
        const nameLookup = new Map(names.map(name => [name.toLowerCase(), name]));
        const orderedNames = [];

        configOrder.forEach(cat => {
            const actual = nameLookup.get(cat);
            if (actual && !orderedNames.includes(actual)) {
                orderedNames.push(actual);
            }
        });
        names.forEach(cat => {
            if (!orderedNames.includes(cat)) {
                orderedNames.push(cat);
            }
        });

        const totalPages = Math.max(1, Math.ceil(orderedNames.length / homeCategoriesPerPage));
        const safePage = Math.min(Math.max(pageNumber, 1), totalPages);
        const pageCategories = orderedNames.slice((safePage - 1) * homeCategoriesPerPage, safePage * homeCategoriesPerPage);

        mainArea.innerHTML = '';
        if (pageCategories.length === 0) {
            mainArea.innerHTML = '<p style="text-align:center">Không có dữ liệu hiển thị cho trang chủ.</p>';
        }

        pageCategories.forEach(categoryName => {
            const data = categories[categoryName];
            const slug = slugify(categoryName);
            const categoryUrl = buildCategoryUrl(slug);
            const section = document.createElement('div');
            section.innerHTML = `<div class="h0" style="text-align: center; margin: 40px 0 10px; width: 100%"><a href="${categoryUrl}" style="text-decoration: none; color: inherit;">${categoryName.toUpperCase()} NỔI BẬT</a></div>`;
            const grid = document.createElement('div');
            grid.className = 'main-content';
            const sortedArticles = data.articles.sort((a, b) => b.sortOrder - a.sortOrder);
            const articlesToShow = sortedArticles.slice(0, 3);
            articlesToShow.forEach(item => {
                const article = document.createElement('article');
                article.className = 'post-card';
                let html = '';
                html += item.imgUrl ? `<a href="${buildPostUrl(item.postID, item.title)}"><img src="${item.imgUrl}" alt="${item.imgAlt}" /></a>` : `<a href="${buildPostUrl(item.postID, item.title)}"><div class="post-card-placeholder"></div></a>`;
                html += `<h3><a href="${buildPostUrl(item.postID, item.title)}">${item.title}</a></h3>`;
                if (item.excerpt) html += `<p>${item.excerpt}</p>`;
                article.innerHTML = html;
                grid.appendChild(article);
            });
            section.appendChild(grid);
            // Show "Xem thêm" link to navigate to category page with full details and filtering
            section.insertAdjacentHTML('beforeend', `<div style="margin-top: 15px; text-align: right; width: 100%;"><a href="${categoryUrl}" style="color: #00bcd4; text-decoration: none; font-weight: bold;">Xem thêm &raquo;</a></div>`);
            mainArea.appendChild(section);
        });

        renderHomePagination(safePage, totalPages);
    } catch (error) {
        console.error('Lỗi tải trang chủ:', error);
    }
}

function renderHomePagination(currentPage, totalPages) {
    const pagination = document.querySelector('#home-page .pagination');
    if (!pagination) return;
    if (!totalPages || totalPages < 2) {
        pagination.innerHTML = '';
        return;
    }
    const pageCount = Math.max(1, totalPages);
    let html = '';
    if (currentPage > 1) html += `<a href="${buildHomeUrl(currentPage - 1)}">&lsaquo;</a>`;
    for (let i = 1; i <= pageCount; i++) {
        html += i === currentPage ? `<span class="current-page">${i}</span>` : `<a href="${buildHomeUrl(i)}">${i}</a>`;
    }
    if (currentPage < pageCount) html += `<a href="${buildHomeUrl(currentPage + 1)}">&rsaquo;</a>`;
    pagination.innerHTML = html;
}

async function loadCategoryPage(categorySlug, pageNumber = 1) {
    const titleEl = document.getElementById('category-title');
    const container = document.getElementById('category-content');
    const pagination = document.querySelector('#category-page .pagination');
    if (!container || !titleEl || !pagination) return;

    const pageDef = findPageDefinitionBySlug(categorySlug);
    if (!pageDef || (pageDef.category || pageDef.label || '').toString().trim().toLowerCase() === 'none') {
        container.innerHTML = `<p style="text-align:center">Chuyên mục không tồn tại.</p>`;
        updateDocumentTitle('Chuyên mục không tồn tại');
        return;
    }

    const categoryLabel = pageDef.category || pageDef.label || categorySlug;
    titleEl.textContent = categoryLabel;
    updateDocumentTitle(categoryLabel);

    try {
        const allRows = await fetchLocalData();
        let rows = allRows.slice(1).filter(isVisiblePostRow);
        rows = rows.filter(row => slugify((row[6] || '').toString().trim()) === categorySlug);
        rows.sort((a, b) => (parseFloat(b[8]) || 0) - (parseFloat(a[8]) || 0));

        const { categoryPostsPerPage } = getPaginationConfig();
        const totalPages = Math.max(1, Math.ceil(rows.length / categoryPostsPerPage));
        const safePage = Math.min(Math.max(pageNumber, 1), totalPages);
        const pageRows = rows.slice((safePage - 1) * categoryPostsPerPage, safePage * categoryPostsPerPage);

        if (pageRows.length === 0) {
            container.innerHTML = `<p style="text-align:center">Không có bài viết cho chuyên mục "${categoryLabel}"</p>`;
        } else {
            container.innerHTML = '';
            pageRows.forEach(row => {
                const title = row[1] || '';
                const excerpt = row[4] || '';
                const imgUrl = row[2] || '';
                const imgAlt = row[3] || '';
                const postID = row[0] || '';
                const article = document.createElement('article');
                article.className = 'post-card';
                let html = '';
                html += imgUrl ? `<a href="${buildPostUrl(postID, title)}"><img src="${imgUrl}" alt="${imgAlt}" /></a>` : `<a href="${buildPostUrl(postID, title)}"><div class="post-card-placeholder"></div></a>`;
                html += `<h3><a href="${buildPostUrl(postID, title)}">${title}</a></h3>`;
                if (excerpt) html += `<p>${excerpt}</p>`;
                article.innerHTML = html;
                container.appendChild(article);
            });
        }

        renderCategoryPagination(categorySlug, safePage, totalPages);
    } catch (error) {
        console.error('Lỗi tải chuyên mục:', error);
    }
}

function renderCategoryPagination(categorySlug, currentPage, totalPages) {
    const pagination = document.querySelector('#category-page .pagination');
    if (!pagination) return;
    if (!totalPages || totalPages < 2) {
        pagination.innerHTML = '';
        return;
    }
    const pageCount = Math.max(1, totalPages);
    let html = '';
    if (currentPage > 1) html += `<a href="${buildCategoryUrl(categorySlug, currentPage - 1)}">&lsaquo;</a>`;
    for (let i = 1; i <= pageCount; i++) {
        html += i === currentPage ? `<span class="current-page">${i}</span>` : `<a href="${buildCategoryUrl(categorySlug, i)}">${i}</a>`;
    }
    if (currentPage < pageCount) html += `<a href="${buildCategoryUrl(categorySlug, currentPage + 1)}">&rsaquo;</a>`;
    pagination.innerHTML = html;
}

const COMMENT_ADMIN_PATH = '/assets/others/base-data/admin.php';
const COMMENT_LIMIT_PER_DAY = 20;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatCommentDate(ts) {
    const date = ts ? new Date(ts) : new Date();
    return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadComments(postId) {
    try {
        const res = await fetch(`${COMMENT_ADMIN_PATH}?action=get_public_comments&postId=${encodeURIComponent(postId)}&t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Không thể tải comment');
        const data = await res.json();
        const comments = Array.isArray(data?.comments) ? data.comments : [];
        renderCommentBox(postId, comments);
        const replyHint = document.getElementById('comment-reply-hint');
        const replyInput = document.querySelector('input[name="replyToName"]');
        const replyNameField = document.querySelector('input[name="commentName"]');

        function setReplyHint(targetName) {
            if (!replyHint) return;
            if (targetName) {
                replyHint.innerHTML = `Đang trả lời: <strong>${escapeHtml(targetName)}</strong> <button type="button" class="comment-reply-cancel-btn">Hủy</button>`;
            } else {
                replyHint.textContent = '';
            }
        }

        if (replyHint && replyHint.dataset.listenerBound !== 'true') {
            replyHint.addEventListener('click', event => {
                if (!event.target.closest('.comment-reply-cancel-btn')) return;
                if (replyInput) replyInput.value = '';
                setReplyHint('');
                replyNameField?.focus();
            });
            replyHint.dataset.listenerBound = 'true';
        }

        document.querySelectorAll('.comment-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetName = btn.getAttribute('data-reply');
                if (replyInput) replyInput.value = targetName || '';
                setReplyHint(targetName || '');
                replyNameField?.focus();
            });
        });
        return comments;
    } catch (error) {
        renderCommentBox(postId, []);
        console.warn('Lỗi tải comment:', error);
        return [];
    }
}

async function loadPostPage(postSlug, pageNumber = 1) {
    const contentEl = document.getElementById('post-content-detail');
    const pagination = document.getElementById('post-pagination');
    if (!contentEl || !pagination) return;

    const parsed = parsePostSlug(postSlug);
    let postData = null;
    let postId = parsed.id;

    try {
        if (postId) {
            postData = await fetchPostDetail(postId);
        } else {
            const allRows = await fetchLocalData();
            const rows = allRows.slice(1);
            const normalizedSlug = slugify(parsed.raw);
            const matched = rows.find(row => slugify(row[1] || '') === normalizedSlug || slugify((row[9] || '').toString()) === normalizedSlug);
            if (matched) {
                postId = matched[0];
                postData = await fetchPostDetail(postId);
            }
        }

        if (!postData || !postData.id) {
            window.location.href = withAppBase('/404.html');
            return;
        }

        updateDocumentTitle(postData.title || 'Bài viết');
        const content = postData.content || '';
        const pages = content.split('<!--nextpage-->');
        const totalPages = Math.max(1, pages.length);
        const safePage = Math.min(Math.max(pageNumber, 1), totalPages);
        contentEl.innerHTML = `<h1>${postData.title || 'Bài viết'}</h1>${pages[safePage - 1]}`;
        renderPostPagination(safePage, totalPages, postId, postData.title || '');
        const commentSection = document.getElementById('comment-section');
        if (commentSection) {
            commentSection.style.display = 'block';
        }
        await loadComments(postId);
        attachCommentFormListener(postId);
    } catch (error) {
        console.error('Lỗi tải bài viết:', error);
        window.location.href = withAppBase('/404.html');
    }
}

function renderPostPagination(currentPage, totalPages, postId, title) {
    const pagination = document.getElementById('post-pagination');
    if (!pagination) return;
    if (!totalPages || totalPages < 2) {
        pagination.innerHTML = '';
        return;
    }
    let html = '';
    if (currentPage > 1) html += `<a href="${buildPostUrl(postId, title, currentPage - 1)}">&laquo;</a>`;
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    if (start > 1) {
        html += `<a href="${buildPostUrl(postId, title, 1)}">1</a>`;
        if (start > 2) html += '<span>...</span>';
    }
    for (let i = start; i <= end; i++) {
        html += i === currentPage ? `<span class="current-page">${i}</span>` : `<a href="${buildPostUrl(postId, title, i)}">${i}</a>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += '<span>...</span>';
        html += `<a href="${buildPostUrl(postId, title, totalPages)}">${totalPages}</a>`;
    }
    if (currentPage < totalPages) html += `<a href="${buildPostUrl(postId, title, currentPage + 1)}">&raquo;</a>`;
    pagination.innerHTML = html;
}

async function normalizeSearchString(s) {
    if (!s && s !== 0) return '';
    try {
        return s.toString()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    } catch (e) {
        return s.toString().toLowerCase();
    }
}

async function renderSearchResults(rawQuery) {
    const query = rawQuery ? rawQuery.trim() : '';
    const displayArea = document.getElementById('search-results');
    if (!displayArea) return;
    if (!query) {
        displayArea.innerHTML = `<p style="text-align:center">Vui lòng nhập từ khóa tìm kiếm.</p>`;
        return;
    }

    try {
        const allRows = await fetchLocalData();
        const rows = allRows.slice(1).filter(isVisiblePostRow);
        const normalizedQuery = await normalizeSearchString(query);
        const filtered = [];

        for (const row of rows) {
            const text = await normalizeSearchString(row.join(' '));
            if (text.includes(normalizedQuery)) {
                filtered.push(row);
            }
        }
        if (filtered.length === 0) {
            displayArea.innerHTML = `<p style="color:cyan; text-align:center; width:100%;">Không tìm thấy: ${query}</p>`;
            return;
        }
        filtered.sort((a, b) => (parseFloat(b[8]) || 0) - (parseFloat(a[8]) || 0));
        displayArea.innerHTML = filtered.map(row => {
            const title = row[1] || '';
            const excerpt = row[4] || '';
            const imgUrl = row[2] || '';
            const imgAlt = row[3] || '';
            const postID = row[0] || '';
            const catName = row[6] || 'Unknown';
            return `<article class="post-card">
                ${imgUrl ? `<a href="${buildPostUrl(postID, title)}"><img src="${imgUrl}" alt="${imgAlt}" /></a>` : `<a href="${buildPostUrl(postID, title)}"><div class="post-card-placeholder"></div></a>`}
                <h3><a href="${buildPostUrl(postID, title)}">${title}</a></h3>
                ${excerpt ? `<p>${excerpt}</p>` : ''}
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(0,255,255,0.3); text-align: center;">
                    <span style="color: white; font-size: 0.85em;">Chuyên mục: </span>
                    <a href="${buildCategoryUrl(slugify(catName))}" style="color: cyan; text-decoration: none; font-size: 0.85em; font-weight: bold;">${catName}</a>
                </div>
            </article>`;
        }).join('');
    } catch (error) {
        console.error('Lỗi tìm kiếm:', error);
    }
}

async function renderTagResults(rawTag) {
    const tag = rawTag ? rawTag.trim() : '';
    const displayArea = document.getElementById('tag-content-area');
    const titleArea = document.getElementById('tag-title');
    if (!displayArea || !titleArea) return;
    if (!tag) {
        displayArea.innerHTML = `<p style="text-align:center">Vui lòng chọn Tag.</p>`;
        return;
    }
    titleArea.innerText = `Tag: ${tag}`;
    try {
        const allRows = await fetchLocalData();
        const normTag = await normalizeSearchString(tag);
        const rows = [];

        for (const row of allRows.slice(1).filter(isVisiblePostRow)) {
            const category = await normalizeSearchString((row[6] || '').toString());
            const tags = await normalizeSearchString((row[7] || '').toString());
            if (category.includes(normTag) || tags.includes(normTag)) {
                rows.push(row);
            }
        }
        if (rows.length === 0) {
            displayArea.innerHTML = `<p style="color:cyan; text-align:center; width:100%;">Không có bài viết cho tag <b>${tag}</b></p>`;
            return;
        }
        rows.sort((a, b) => (parseFloat(b[8]) || 0) - (parseFloat(a[8]) || 0));
        displayArea.innerHTML = rows.map(row => {
            const title = row[1] || '';
            const excerpt = row[4] || '';
            const imgUrl = row[2] || '';
            const imgAlt = row[3] || '';
            const postID = row[0] || '';
            return `<article class="post-card">
                ${imgUrl ? `<a href="${buildPostUrl(postID, title)}"><img src="${imgUrl}" alt="${imgAlt}" /></a>` : `<a href="${buildPostUrl(postID, title)}"><div class="post-card-placeholder"></div></a>`}
                <h3><a href="${buildPostUrl(postID, title)}">${title}</a></h3>
                ${excerpt ? `<p>${excerpt}</p>` : ''}
            </article>`;
        }).join('');
    } catch (error) {
        console.error('Lỗi tag result:', error);
        displayArea.innerHTML = `<p style="color:red; text-align:center;">Lỗi khi hiển thị tag.</p>`;
    }
}

function attachCommentFormListener(postId) {
    const form = document.getElementById('commentForm');
    const status = document.getElementById('comment-status');
    const replyHint = document.getElementById('comment-reply-hint');
    if (!form || !status) return;

    const boundKey = String(postId);
    // If a previous handler exists and is for a different post, remove it
    if (form._commentHandler && form.dataset.boundPost && form.dataset.boundPost !== boundKey) {
        try { form.removeEventListener('submit', form._commentHandler); } catch (e) { /* ignore */ }
        form._commentHandler = null;
    }
    if (form.dataset.boundPost === boundKey && form._commentHandler) return;
    form.dataset.boundPost = boundKey;

    const nameInput = form.querySelector('input[name="commentName"]');
    const contentInput = form.querySelector('textarea[name="commentContent"]');
    const replyInput = form.querySelector('input[name="replyToName"]');

    const handler = async function (event) {
        event.preventDefault();
        const name = nameInput?.value.trim() || '';
        const content = contentInput?.value.trim() || '';
        const replyToName = replyInput?.value.trim() || '';

        if (!name || !content) {
            status.textContent = 'Vui lòng điền họ tên và nội dung bình luận.';
            status.style.color = '#ff6e6e';
            return;
        }

        status.textContent = 'Đang gửi bình luận...';
        status.style.color = '#fff';
        try {
            const res = await fetch(COMMENT_ADMIN_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_comment',
                    comment: {
                        postId: boundKey,
                        name,
                        content,
                        replyToName,
                        createdAt: Date.now()
                    }
                })
            });
            const json = await res.json();
            if (!res.ok || json.status !== 'success') {
                throw new Error(json.message || 'Gửi bình luận thất bại');
            }

            form.reset();
            if (replyHint) replyHint.textContent = '';
            status.textContent = 'Bình luận của bạn đang chờ kiểm duyệt.';
            status.style.color = '#8affb5';
            await loadComments(boundKey);
        } catch (error) {
            status.textContent = 'Lỗi: ' + error.message;
            status.style.color = '#ff6e6e';
            console.error(error);
        }
    };

    form._commentHandler = handler;
    form.addEventListener('submit', handler);

    form.querySelectorAll('[data-reply]').forEach(button => {
        button.addEventListener('click', () => {
            const targetName = button.getAttribute('data-reply');
            if (replyInput) replyInput.value = targetName;
            if (replyHint) replyHint.textContent = `Đang trả lời: ${targetName}`;
            if (nameInput) nameInput.focus();
        });
    });
}

function attachContactFormListener() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('status-msg');
    if (!form || !status) return;
    if (form.dataset.listenerAttached === 'true') return;
    form.dataset.listenerAttached = 'true';

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const nameInput = form.querySelector('input[name="entry.544024106"]');
        const messageInput = form.querySelector('textarea[name="entry.1071615712"]');
        const name = nameInput ? nameInput.value.trim() : '';
        const message = messageInput ? messageInput.value.trim() : '';
        if (!name || !message) {
            status.textContent = 'Vui lòng điền cả tên và nội dung.';
            status.style.color = '#ff6e6e';
            return;
        }
        status.textContent = 'Đang gửi...';
        status.style.color = '#fff';
        try {
            const excelTime = (new Date().getTime() / (86400 * 1000)) + 25569;
            const saveRes = await fetch(ADMIN_SETTINGS_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_contact',
                    contact: { name, message, time: excelTime }
                })
            });
            const json = await saveRes.json();
            if (!saveRes.ok || json.status !== 'success') {
                throw new Error(json.message || 'Lưu không thành công');
            }
            status.textContent = 'Gửi thành công! Cảm ơn bạn đã liên hệ.';
            status.style.color = '#8affb5';
            form.reset();
        } catch (error) {
            status.textContent = 'Lỗi gửi: ' + error.message;
            status.style.color = '#ff6e6e';
            console.error(error);
        }
    });
}

function toggleMenu() {
    document.getElementById('mobileMenu')?.classList.toggle('active');
}

function toggleMobileMenu(menuName) {
    const menuItem = document.querySelector(`.mobile-menu-item[data-menu="${menuName}"]`);
    if (!menuItem) return;
    const dropContent = Array.from(menuItem.children).find(el => el.classList?.contains('mobile-dropdown-content'));
    const toggleBtn = menuItem.querySelector('.mobile-toggle-btn');

    const willOpen = dropContent && !dropContent.classList.contains('open');

    // Close other menus and reset their toggle state
    document.querySelectorAll('.mobile-menu-item').forEach(item => {
        const el = item.querySelector('.mobile-dropdown-content');
        const btn = item.querySelector('.mobile-toggle-btn');
        if (el && el !== dropContent) {
            el.classList.remove('open');
            // also close any nested submenus inside this item
            el.querySelectorAll('.mobile-dropdown-content.sub-content.open').forEach(sc => sc.classList.remove('open'));
            item.querySelectorAll('.mobile-sub-btn.open').forEach(b => b.classList.remove('open'));
        }
        if (btn && btn !== toggleBtn) btn.classList.remove('open');
    });

    if (dropContent) {
        dropContent.classList.toggle('open', willOpen);
        if (!willOpen) {
            // when closing this parent menu, also close all nested submenus and reset their toggles
            dropContent.querySelectorAll('.mobile-dropdown-content.sub-content.open').forEach(sc => sc.classList.remove('open'));
            dropContent.querySelectorAll('.mobile-sub-btn.open').forEach(b => b.classList.remove('open'));
        }
    }
    if (toggleBtn) toggleBtn.classList.toggle('open', willOpen);
}

function toggleMobileSubmenu(submenuName) {
    const subContent = document.querySelector(`.mobile-dropdown-content.sub-content[data-submenu="${submenuName}"]`);
    const toggleButton = document.querySelector(`.mobile-sub-btn[data-submenu="${submenuName}"]`);

    const willOpen = subContent && !subContent.classList.contains('open');

    document.querySelectorAll('.mobile-dropdown-content.sub-content').forEach(el => {
        if (el !== subContent) {
            el.classList.remove('open');
        }
    });
    document.querySelectorAll('.mobile-sub-btn').forEach(btn => {
        if (btn !== toggleButton) {
            btn.classList.remove('open');
        }
    });

    if (subContent) {
        subContent.classList.toggle('open', willOpen);
    }
    if (toggleButton) {
        toggleButton.classList.toggle('open', willOpen);
    }
}

function handleInternalLinkClick(event) {
    const anchor = event.target.closest('a');
    if (!anchor || anchor.target && anchor.target !== '_self') return;
    const href = anchor.getAttribute('href');
    if (!href || !isInternalAppLink(href)) return;
    event.preventDefault();
    navigateTo(href);
}

function executeSearch() {
    const input = document.getElementById('searchInput');
    if (input && input.value.trim()) {
        navigateTo(buildSearchUrl(input.value.trim()));
    }
}

function toggleGalleryVisibility(show) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;
    gallery.style.display = show ? '' : 'none';
}

function initGallery() {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;
    const images = ['assets/img/zaloqr.png',
        'assets/img/zaloqr.png',
        'assets/img/zaloqr.png'];
    gallery.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const card = document.createElement('div');
        card.className = 'flip-card';
        card.innerHTML = `<div class="flip-card-inner"><div class="flip-front"><img src="${images[i % images.length]}"></div><div class="flip-back"><img src="${images[(i + 1) % images.length]}"></div></div>`;
        gallery.appendChild(card);
    }
    setInterval(() => {
        const cards = document.querySelectorAll('.flip-card');
        if (cards.length) {
            const random = cards[Math.floor(Math.random() * cards.length)];
            random.classList.toggle('flipping');
        }
    }, 2500);
}

function attachSubmenuPositionHandlers() {
    if (window.innerWidth < 1024) return;
    const hasSubmenuItems = document.querySelectorAll('.nav-desktop .has-submenu');
    hasSubmenuItems.forEach(item => {
        item.removeEventListener('mouseenter', checkSubmenuPosition);
        item.addEventListener('mouseenter', checkSubmenuPosition);
    });
}

function checkSubmenuPosition(event) {
    const submenu = event.currentTarget.querySelector(':scope > .submenu-level-3, :scope > .submenu');
    if (!submenu) return;
    submenu.classList.remove('left-align');
    submenu.style.display = 'block';
    submenu.style.visibility = 'hidden';
    void submenu.offsetHeight;
    const rect = submenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    if (rect.right > viewportWidth - 20) {
        submenu.classList.add('left-align');
    }
    submenu.style.display = '';
    submenu.style.visibility = '';
}

window.addEventListener('resize', attachSubmenuPositionHandlers);

async function initMainScripts() {
    await loadAdminSettings();
    loadComponent('/components/head.html', 'head', true);
    loadComponent('/components/header.html', '#header-placeholder', false, async () => {
        renderPageLinks();
        await renderDynamicMenu();
        attachSubmenuPositionHandlers();
        initParticles();
        document.dispatchEvent(new Event('headerLoaded'));
        loadComponent('/components/footer.html', '#footer-placeholder', false, async () => {
            await renderDynamicMenu();
        });
    });

    toggleGalleryVisibility(true);
    if (!window.location.pathname.startsWith('/pages/')) {
        renderRoute();
        window.addEventListener('popstate', renderRoute);
    }
    initGallery();
    document.addEventListener('click', handleInternalLinkClick);
    document.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && event.target.id === 'searchInput') {
            executeSearch();
        }
    });
    document.addEventListener('click', (event) => {
        if (event.target.id === 'searchBtn') executeSearch();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMainScripts);
} else {
    initMainScripts();
}
document.addEventListener("DOMContentLoaded", function () {
    const ZOOM_LEVEL = 2.5;
    let isMagnifierEnabled = false;
    let isDragging = false;
    let currentX, currentY, initialX, initialY;
    let xOffset = 0, yOffset = 0;
    let hasDragged = false;
    let dragBtn = document.getElementById("dragBtn");
    const magnifyImages = document.querySelectorAll(".magnify-target");
    const glassMap = new Map();
    const processedImages = new WeakSet();
    let buttonInitialized = false;

    function initDragBtn() {
        if (!dragBtn || buttonInitialized) return;
        buttonInitialized = true;
        dragBtn.classList.add("floating-btn");
        // two-line label to make button vertical and compact
        dragBtn.innerHTML = isMagnifierEnabled ? "TẮT<br>🔎" : "BẬT<br>🔎";

        // Default position: flush to the right edge of the viewport
        // and aligned to the top of the main.container element.
        try {
            // default position: middle right edge
            dragBtn.style.right = '0px';
            dragBtn.style.top = '50%';
            dragBtn.style.transform = 'translateY(-50%)';
            // keep it centered on resize
            window.addEventListener('resize', () => {
                if (!isDragging) {
                    dragBtn.style.top = '50%';
                    dragBtn.style.transform = 'translateY(-50%)';
                }
            });
        } catch (e) {
            console.warn('Không thể căn nút theo main.container', e);
        }

        dragBtn.addEventListener('click', function () {
            if (!hasDragged) {
                toggleMagnifier();
            }
        });

        // Reset button opacity to 0.3 on mouseleave (desktop) or 1.5s after touch (mobile)
        dragBtn.addEventListener('mouseleave', function () {
            dragBtn.style.opacity = '0.3';
        });
        dragBtn.addEventListener('touchend', function () {
            setTimeout(() => {
                dragBtn.style.opacity = '0.3';
            }, 1500);
        });

        setTimeout(() => {
            const rect = dragBtn.getBoundingClientRect();
            xOffset = rect.left;
            yOffset = rect.top;
        }, 100);

        dragBtn.addEventListener("mousedown", dragStart);
        window.addEventListener("mousemove", dragging, { passive: false });
        window.addEventListener("mouseup", dragEnd);

        dragBtn.addEventListener("touchstart", dragStart, { passive: true });
        window.addEventListener("touchmove", dragging, { passive: false });
        window.addEventListener("touchend", dragEnd);
    }

    function createGlass() {
        const glass = document.createElement("div");
        glass.className = "magnifier-glass";
        glass.style.position = "absolute";
        glass.style.display = "none";
        glass.style.pointerEvents = "none";
        glass.style.zIndex = "9999";
        document.body.appendChild(glass);
        return glass;
    }

    function initMagnifier(img) {
        if (processedImages.has(img)) return;
        processedImages.add(img);

        const glass = createGlass();
        glassMap.set(img, glass);

        function updateGlassBackground() {
            glass.style.backgroundImage = `url('${img.src}')`;
            const r = img.getBoundingClientRect();
            const rectWidth = r.width || img.width || img.naturalWidth;
            const rectHeight = r.height || img.height || img.naturalHeight;
            glass.style.backgroundSize = `${rectWidth * ZOOM_LEVEL}px ${rectHeight * ZOOM_LEVEL}px`;
        }

        if (img.complete) {
            updateGlassBackground();
        } else {
            img.addEventListener('load', updateGlassBackground);
        }

        function moveMagnifier(e) {
            if (!isMagnifierEnabled || isDragging) return;
            const rect = img.getBoundingClientRect();
            const pageX = e.type.startsWith('touch') ? e.touches[0].pageX : e.pageX;
            const pageY = e.type.startsWith('touch') ? e.touches[0].pageY : e.pageY;

            let x = pageX - (rect.left + window.pageXOffset);
            let y = pageY - (rect.top + window.pageYOffset);
            if (x > img.width) x = img.width;
            if (x < 0) x = 0;
            if (y > img.height) y = img.height;
            if (y < 0) y = 0;

            const glassWidth = glass.offsetWidth;
            const glassHeight = glass.offsetHeight;
            const defaultLeft = pageX - glassWidth;
            const needsLeftFlip = defaultLeft < glassWidth * 0.2;
            const glassLeft = needsLeftFlip ? pageX : defaultLeft;
            const glassTop = pageY - glassHeight;

            glass.style.left = `${glassLeft}px`;
            glass.style.top = `${glassTop}px`;
            // Use displayed image rect to size background so zoom matches visual size
            const rectWidth = rect.width || img.width;
            const rectHeight = rect.height || img.height;
            glass.style.backgroundSize = `${rectWidth * ZOOM_LEVEL}px ${rectHeight * ZOOM_LEVEL}px`;

            // Scaled coordinates based on displayed image size
            const scaledX = x * ZOOM_LEVEL;
            const scaledY = y * ZOOM_LEVEL;

            // Center the magnified point inside the glass
            const bgX = scaledX - (glassWidth / 2);
            const bgY = scaledY - (glassHeight / 2);

            glass.style.backgroundPosition = `-${bgX}px -${bgY}px`;
        }

        function showGlass(e) {
            if (!isMagnifierEnabled) return;
            updateGlassBackground();
            glass.style.display = 'block';
            moveMagnifier(e);
        }

        function hideGlass() {
            glass.style.display = 'none';
        }

        img.addEventListener('mouseenter', showGlass);
        img.addEventListener('mousemove', moveMagnifier);
        img.addEventListener('mouseleave', hideGlass);
        // Touch handling: activate magnifier only on long-press (>=400ms) to avoid scroll conflicts
        let touchHoldTimer = null;
        let touchActivated = false;

        img.addEventListener('touchstart', function (e) {
            if (!isMagnifierEnabled) return;
            touchActivated = false;
            if (touchHoldTimer) clearTimeout(touchHoldTimer);
            touchHoldTimer = setTimeout(() => {
                touchActivated = true;
                updateGlassBackground();
                glass.style.display = 'block';
                // vibrate once on mobile when magnifier activates
                try { if (navigator.vibrate) navigator.vibrate(50); } catch (err) { }
                moveMagnifier(e);
            }, 400);
        }, { passive: true });

        img.addEventListener('touchmove', function (e) {
            if (!isMagnifierEnabled || isDragging) return;
            if (!touchActivated) {
                // user is scrolling or moving before long-press, cancel activation
                if (touchHoldTimer) {
                    clearTimeout(touchHoldTimer);
                    touchHoldTimer = null;
                }
                return; // allow scroll
            }
            // when magnifier is active, prevent scrolling and update position
            if (e.cancelable) e.preventDefault();
            moveMagnifier(e);
        }, { passive: false });

        img.addEventListener('touchend', function (e) {
            if (touchHoldTimer) { clearTimeout(touchHoldTimer); touchHoldTimer = null; }
            if (touchActivated) {
                touchActivated = false;
                hideGlass();
            }
        });
        // hide magnifier on global scroll or touchcancel (mobile)
        function globalHideOnScroll() {
            if (isMobileDevice()) hideGlass();
        }
        window.addEventListener('scroll', globalHideOnScroll, { passive: true });
        window.addEventListener('touchcancel', function () { hideGlass(); }, { passive: true });
    }

    // Khởi tạo cho tất cả ảnh
    magnifyImages.forEach(img => initMagnifier(img));
    if (dragBtn) initDragBtn();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;

                if (node.id === "dragBtn") {
                    dragBtn = node;
                    initDragBtn();
                }

                if (node.matches && node.matches(".magnify-target")) {
                    initMagnifier(node);
                }

                if (node.querySelectorAll) {
                    node.querySelectorAll('.magnify-target').forEach((img) => initMagnifier(img));
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // On mobile, hide all magnifier glasses when touch ends (release) to avoid lingering
    window.addEventListener('touchend', function () {
        if (!isMobileDevice()) return;
        glassMap.forEach((glass) => { if (glass && glass.style) glass.style.display = 'none'; });
    }, { passive: true });

    function toggleMagnifier() {
        isMagnifierEnabled = !isMagnifierEnabled;
        if (dragBtn) {
            dragBtn.classList.toggle("magnifier-disabled", !isMagnifierEnabled);
            dragBtn.innerHTML = isMagnifierEnabled ? "TẮT<br>🔎" : "BẬT<br>🔎";
        }

        // On mobile, show a short tip when enabling magnifier
        function showMobileTipOnce(text) {
            if (!dragBtn || !isMobileDevice()) return;
            const tip = document.createElement('div');
            tip.className = 'magnifier-tip';
            tip.innerText = text;
            // semi-transparent background via inline style to ensure 0.5
            tip.style.background = 'rgba(0,0,0,0.5)';
            document.body.appendChild(tip);
            // compute position after layout
            const btnRect = dragBtn.getBoundingClientRect();
            const tipRect = tip.getBoundingClientRect();
            // position to the right of the button if space, otherwise to the left
            const rightSpace = window.innerWidth - btnRect.right;
            const leftPos = rightSpace > tipRect.width + 8 ? (btnRect.right + 8) : (btnRect.left - tipRect.width - 8);
            tip.style.top = `${Math.max(8, btnRect.top)}px`;
            tip.style.left = `${Math.max(8, leftPos)}px`;
            // display for 2s then fade
            setTimeout(() => {
                tip.style.opacity = '0';
                setTimeout(() => tip.remove(), 600);
            }, 2000);
        }

        if (!isMagnifierEnabled) {
            glassMap.forEach((glass) => {
                if (glass && glass.style) {
                    glass.style.display = "none";
                }
            });
        }
        else {
            // show tip only on mobile when enabling
            if (isMobileDevice()) showMobileTipOnce('Tip: chạm giữ ảnh để bật kính lúp');
        }
    }

    function dragStart(e) {
        hasDragged = false;
        const clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
        initialX = clientX - xOffset;
        initialY = clientY - yOffset;
        isDragging = true;
    }

    function dragging(e) {
        if (isDragging) {
            if (e.type === "touchmove") e.preventDefault();
            hasDragged = true;

            const clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

            currentX = clientX - initialX;
            currentY = clientY - initialY;

            const padding = 10;
            if (currentX < padding) currentX = padding;
            if (currentX > window.innerWidth - dragBtn.offsetWidth - padding) currentX = window.innerWidth - dragBtn.offsetWidth - padding;
            if (currentY < padding) currentY = padding;
            if (currentY > window.innerHeight - dragBtn.offsetHeight - padding) currentY = window.innerHeight - dragBtn.offsetHeight - padding;

            xOffset = currentX;
            yOffset = currentY;

            // Loại bỏ transform để cho phép định vị tuyệt đối
            dragBtn.style.position = 'fixed';
            dragBtn.style.top = currentY + "px";
            dragBtn.style.left = currentX + "px";
            dragBtn.style.right = 'auto';
            dragBtn.style.transform = 'none';
        }
    }

    function dragEnd() {
        isDragging = false;
    }
});
document.addEventListener("click", (e) => {
    // Sử dụng Event Delegation để bắt được các thẻ <a> sinh ra động từ file JSON pm01.json
    const link = e.target.closest(".trianlink");

    if (!link) return;

    // Lấy đường link đích thực tế (Ví dụ: link Mediafire)
    const targetUrl = link.getAttribute("href");

    if (targetUrl && targetUrl !== "#") {
        // 1. Chặn hành động mở tab ngay lập tức của trình duyệt để xử lý hiệu ứng trước
        e.preventDefault();

        // 2. TẠO THẺ <a> ẨN ĐỂ "LÁCH LUẬT" CHROME CHẶN POP-UP
        // Trình duyệt sẽ cho phép mở tab mới bất đồng bộ nếu nó được liên kết với một phần tử thực tế trong DOM
        const hiddenLink = document.createElement("a");
        hiddenLink.href = targetUrl;
        hiddenLink.target = "_blank";
        hiddenLink.style.display = "none";
        document.body.appendChild(hiddenLink);

        // 3. Cấu hình chữ bay sáng rõ nét
        const message = "Đời đời nhớ ơn anh Tiến đẹp trai đã ban link !!!";
        const audioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

        // 4. Khởi tạo và phát nhạc ngay tại tab cũ
        const audio = new Audio(audioUrl);
        audio.volume = 0.7; // Âm lượng ban đầu 70%
        audio.play().catch(error => {
            console.log("Trình duyệt chặn phát âm thanh tự động:", error);
        });

        // 5. Tạo phần tử chữ bay lên màn hình tab cũ
        const textElement = document.createElement("div");
        textElement.className = "flying-text";
        textElement.innerText = message;
        document.body.appendChild(textElement);

        // Đặt thời gian chờ đúng 4 giây (4000ms) theo yêu cầu mới của bạn
        const animationDuration = 4000;

        setTimeout(() => {
            // Hành động A: Kích hoạt thẻ <a> ẩn để mở trang đích sang TAB MỚI mà không bị Chrome chặn
            hiddenLink.click();
            hiddenLink.remove(); // Xóa thẻ ẩn sau khi dùng xong

            // Hành động B: Hiệu ứng nhạc nhỏ dần (Fade out) trong vòng 0.5 giây rồi tắt hẳn
            let fadeEffect = setInterval(() => {
                if (audio.volume > 0.1) {
                    audio.volume -= 0.1;
                } else {
                    audio.pause();
                    clearInterval(fadeEffect);
                }
            }, 50);

            // Xóa chữ khỏi giao diện sau khi hoàn thành chu kỳ bay
            textElement.remove();

        }, animationDuration);
    }
});

document.addEventListener('click', function (event) {
    const backToTop = event.target.closest('#backToTop');
    if (!backToTop) return;

    event.preventDefault();
    backToTop.classList.add('is-clicked');

    const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const duration = 600;
    const startTime = performance.now();

    function animateScroll(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, startY * (1 - eased));

        if (progress < 1) {
            requestAnimationFrame(animateScroll);
        } else {
            window.scrollTo(0, 0);
            backToTop.classList.remove('is-clicked');
        }
    }

    requestAnimationFrame(animateScroll);
});

window.addEventListener('scroll', function () {
    const backToTop = document.getElementById('backToTop');
    if (!backToTop) return;
    backToTop.classList.toggle('visible', window.scrollY > 250);
}, { passive: true });

function initParticles() {
    const canvas = document.getElementById("particle-canvas");
    if (!canvas) {
        setTimeout(initParticles, 100);
        return;
    }

    if (canvas.dataset.particlesInitialized === "true") return;
    canvas.dataset.particlesInitialized = "true";

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles = [];
    const mouse = { x: undefined, y: undefined };

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    window.removeEventListener("resize", resize); // Tránh trùng lặp event
    window.addEventListener("resize", resize);
    resize();

    const createP = (amt) => {
        for (let i = 0; i < amt; i++) particles.push(new Particle());
    };

    const handleMouseMove = (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        createP(2);
    };

    window.removeEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    class Particle {
        constructor() {
            this.x = mouse.x;
            this.y = mouse.y;
            this.size = Math.random() * 3 + 1;
            this.speedX = (Math.random() - 0.5) * 2;
            this.speedY = (Math.random() - 0.5) * 2;
            this.color = Math.random() > 0.5 ? "#ff00ff" : "#00ffff";
            this.opacity = 1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.opacity > 0.02) this.opacity -= 0.02;
        }
        draw() {
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].opacity <= 0.02) {
                particles.splice(i, 1);
                i--;
            }
        }
        requestAnimationFrame(animate);
    };
    animate();
}


async function hideCommentForEveryone(postId, commentId) {
    try {
        const res = await fetch(COMMENT_ADMIN_PATH, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'hide_comment', id: commentId })
        });
        const json = await res.json();
        if (!res.ok || json.status !== 'success') {
            throw new Error(json.message || 'Không thể ẩn comment');
        }
        await loadComments(postId);
    } catch (error) {
        console.error('Lỗi ẩn comment:', error);
        alert('Không ẩn được comment. Vui lòng thử lại.');
    }
}

function formatCommentDateCompact(ts) {
    const date = ts ? new Date(ts) : new Date();
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear() % 100).padStart(2, '0');
    return `${d}/${m}/${y}`;
}

function renderCommentItem(item, isReply, postId) {
    const isPending = item.status === 'pending';
    const showHideButton = item.is_owner === true && !item.hidden;
    const replyTarget = item.replyToName ? `<span class="comment-reply-label">↩ Trả lời ${escapeHtml(item.replyToName)}</span>` : '';
    const pendingLabel = isPending ? `<div class="comment-pending-label">(chờ kiểm duyệt)</div>` : '';
    const hideButtonHtml = showHideButton ? `<button type="button" class="comment-hide-btn" onclick="hideCommentForEveryone('${postId}', '${escapeHtml(item.id || '')}')">Xóa</button>` : '';
    const dateText = formatCommentDateCompact(item.createdAt || item.time);

    return `
        <article class="comment-card ${isReply ? 'comment-reply' : ''} ${isPending ? 'pending' : ''}">
            ${replyTarget ? `<div class="comment-reply-info">${replyTarget}</div>` : ''}
            <div class="comment-row">
                <div class="comment-left">
                    <div class="comment-header-compact">
                        <span class="comment-author-content"><strong>${escapeHtml(item.name || 'Ẩn danh')}</strong></span>: <span class="comment-body-content">${escapeHtml(item.content || '')}</span>
                    </div>
                </div>
            </div>
            <div class="comment-status-row">
                ${pendingLabel}
                <div class="comment-status-controls">
                    <span class="comment-date-text">${dateText}</span>
                    <div class="comment-action-buttons">
                        <button type="button" class="comment-reply-btn" data-reply="${escapeHtml(item.name || '')}">Trả lời</button>
                        ${hideButtonHtml}
                    </div>
                </div>
            </div>
        </article>`;
}

window.renderCommentBox = function (postId, comments) {
    const container = document.getElementById('comment-list');
    const note = document.getElementById('comment-note');
    if (!container) return;

    const allComments = Array.isArray(comments) ? comments.filter(Boolean) : [];

    if (!allComments.length) {
        container.innerHTML = '<p style="color: #cdefff; text-align:center;">Chưa có bình luận nào cho bài viết này.</p>';
        if (note) note.textContent = 'Bình luận của bạn sẽ hiển thị sau khi được kiểm duyệt.';
        return;
    }

    const rootComments = allComments.filter(c => !c.replyToName);
    const replyMap = {};
    allComments.forEach(c => {
        if (c.replyToName) {
            if (!replyMap[c.replyToName]) replyMap[c.replyToName] = [];
            replyMap[c.replyToName].push(c);
        }
    });

    function renderThread(item) {
        const replies = replyMap[item.name] || [];
        const repliesHtml = replies.map(reply => renderThread(reply)).join('');
        return `
            <div class="comment-thread">
                ${renderCommentItem(item, false, postId)}
                ${repliesHtml ? `<div class="comment-replies">${repliesHtml}</div>` : ''}
            </div>`;
    }

    container.innerHTML = rootComments.map(item => renderThread(item)).join('');

    if (note) {
        const hasPending = allComments.some(comment => comment.status === 'pending');
        note.textContent = hasPending
            ? 'Bình luận chờ kiểm duyệt chỉ hiển thị với bạn đến khi admin duyệt.'
            : 'Bạn có thể trả lời bình luận khác.';
    }

    document.querySelectorAll('.comment-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetName = btn.getAttribute('data-reply');
            const replyInput = document.querySelector('input[name="replyToName"]');
            const replyHint = document.getElementById('comment-reply-hint');
            if (replyInput) replyInput.value = targetName || '';
            if (replyHint) replyHint.textContent = targetName ? `Đang trả lời: ${targetName}` : '';
            document.querySelector('input[name="commentName"]')?.focus();
        });
    });
};

const commentStyles = document.createElement('style');
commentStyles.textContent = `
.comment-thread {
    margin-bottom: 8px;
}

.comment-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 8px;
    color: #fff;
}

.comment-header-compact {
    color: var(--text);
    margin-bottom: 4px;
    display: block;
    line-height: 1.4;
    word-break: break-word;
    font-size: 0.95rem;
}

.comment-author-content {
    display: inline;
    color: var(--text);
    white-space: normal;
    word-break: break-word;
}

.comment-author-content strong {
    color: #007acc;
    font-weight: 700;
}

.comment-body-content {
    color: #effcff;
}

.comment-reply-info {
    color: #8affb5;
    font-size: 0.8rem;
    margin-bottom: 4px;
}

.comment-reply-label {
    color: #8affb5;
    font-size: 0.8rem;
}

.comment-pending-label {
    color: #ffd86b;
    font-size: 0.8rem;
    display: block;
    white-space: nowrap;
}

.comment-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: nowrap;
    margin-top: 6px;
    min-width: 0;
}

.comment-status-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex-wrap: nowrap;
    min-width: 0;
    margin-left: auto;
}

.comment-footer-compact {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
}

.comment-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.comment-left {
    flex: 1 1 auto;
    min-width: 0;
}

.comment-content-inline {
    display: inline-block;
    max-width: 60vw;
    overflow: visible;
    white-space: normal;
    vertical-align: middle;
    margin-left: 3px;
}

.comment-controls {
    flex: 0 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
}

.comment-date-text {
    font-size: 0.7rem;
    color: #999;
    white-space: nowrap;
}

.comment-action-buttons {
    display: flex;
    flex-wrap: nowrap;
    gap: 2px;
}

.comment-reply-btn,
.comment-hide-btn {
    padding: 2px 1px;
    font-size: 0.65rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease;
    white-space: nowrap;
    flex: 0 0 auto;
}

.comment-reply-btn:hover,
.comment-hide-btn:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.12);
}

.comment-replies {
    margin-left: 12px;
    padding-left: 8px;
    border-left: 2px solid rgba(0, 255, 255, 0.12);
    margin-top: 6px;
    display: grid;
    gap: 6px;
}

.comment-reply {
    background: rgba(255, 255, 255, 0.03);
}

@media (max-width: 768px) {
    .comment-footer-compact {
        flex-direction: column;
        align-items: flex-start;
    }

    .comment-row {
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 8px;
    }

    .comment-content-inline {
        max-width: 100%;
    }

    .comment-left {
        width: 100%;
        min-width: 0;
    }

    .comment-controls {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-start;
        gap: 6px;
        margin-left: 0;
    }

    .comment-date-text {
        font-size: 0.7rem;
        flex-shrink: 0;
        white-space: nowrap;
    }

    .comment-action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-end;
        width: auto;
    }

    .comment-reply-btn,
    .comment-hide-btn {
        flex: 0 0 auto;
        padding: 4px 6px;
        font-size: 0.75rem;
        white-space: nowrap;
    }

    .comment-card {
        overflow: visible;
    }
}
`;
document.head.appendChild(commentStyles);

/* BĐ chặn chuột phải */
document.addEventListener('contextmenu', function(e) {
    e.preventDefault(); // Chặn menu chuột phải
});
/* KT Chặn chuột phải */

