"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = testConnection;
exports.searchProducts = searchProducts;
exports.getProductDetail = getProductDetail;
exports.getProductVariants = getProductVariants;
exports.getCategories = getCategories;
exports.createOrder = createOrder;
exports.getOrder = getOrder;
exports.listOrders = listOrders;
exports.getTracking = getTracking;
exports.getBalance = getBalance;
const node_fetch_1 = __importDefault(require("node-fetch"));
const admin = __importStar(require("firebase-admin"));
// ==================== Yakkyofy APIs ====================
// REST الرسمي (طلبات): https://rest.yakkyofy.com
// API الداخلي (منتجات): https://api.yakkyofy.com/api
const YAKKYOFY_REST_URL = "https://rest.yakkyofy.com";
const YAKKYOFY_INTERNAL_URL = "https://api.yakkyofy.com/api";
const YAKKYOFY_V2_URL = "https://apiv2.yakkyofy.com";
const YAKKYOFY_MEDIA_FALLBACK = "https://yakkyofy-media.dokku.yakkyo.com";
async function getSettings() {
    const db = admin.firestore();
    const settingsDoc = await db.doc("settings/yakkyofy").get();
    return (settingsDoc.data() || {});
}
// ==================== الحصول على API Key ====================
async function getApiKey() {
    const settings = await getSettings();
    if (!(settings === null || settings === void 0 ? void 0 : settings.apiKey)) {
        throw new Error("مفتاح Yakkyofy API غير مُعد. يرجى إدخاله في إعدادات Yakkyofy.");
    }
    return settings.apiKey;
}
function extractToken(payload) {
    var _a, _b, _c;
    return ((payload === null || payload === void 0 ? void 0 : payload.token) ||
        (payload === null || payload === void 0 ? void 0 : payload.accessToken) ||
        (payload === null || payload === void 0 ? void 0 : payload.access_token) ||
        ((_a = payload === null || payload === void 0 ? void 0 : payload.data) === null || _a === void 0 ? void 0 : _a.token) ||
        ((_b = payload === null || payload === void 0 ? void 0 : payload.data) === null || _b === void 0 ? void 0 : _b.accessToken) ||
        ((_c = payload === null || payload === void 0 ? void 0 : payload.data) === null || _c === void 0 ? void 0 : _c.access_token) ||
        null);
}
async function loginInternal(email, password) {
    const response = await (0, node_fetch_1.default)(`${YAKKYOFY_INTERNAL_URL}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (_a) {
        throw new Error(`فشل تسجيل الدخول الداخلي (${response.status}): ${text.substring(0, 200)}`);
    }
    if (!response.ok) {
        throw new Error(`فشل تسجيل الدخول الداخلي (${response.status}): ${(data === null || data === void 0 ? void 0 : data.message) || text.substring(0, 160)}`);
    }
    const token = extractToken(data);
    if (!token) {
        throw new Error("تم تسجيل الدخول لكن لم يتم استلام توكن x-access-token.");
    }
    await admin.firestore().doc("settings/yakkyofy").set({
        internalToken: token,
        internalTokenIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return token;
}
function tokenIsFresh(issuedAt) {
    if (!issuedAt)
        return false;
    let date = null;
    if (typeof issuedAt === "string")
        date = new Date(issuedAt);
    else if (issuedAt.toDate)
        date = issuedAt.toDate();
    if (!date || Number.isNaN(date.getTime()))
        return false;
    const ageMs = Date.now() - date.getTime();
    return ageMs < 90 * 60 * 1000;
}
async function getInternalToken() {
    const settings = await getSettings();
    if (settings.internalToken && tokenIsFresh(settings.internalTokenIssuedAt)) {
        return settings.internalToken;
    }
    if (!settings.email || !settings.password) {
        throw new Error("الاستيراد المباشر يتطلب البريد الإلكتروني وكلمة المرور في إعدادات Yakkyofy.");
    }
    return loginInternal(settings.email, settings.password);
}
// ==================== طلب مصادق ====================
async function yakkyofyFetch(path, options = {}) {
    const apiKey = await getApiKey();
    const url = `${YAKKYOFY_REST_URL}${path}`;
    const response = await (0, node_fetch_1.default)(url, {
        method: options.method || "GET",
        headers: {
            "X-API-Key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (_a) {
        throw new Error(`Yakkyofy API: استجابة غير متوقعة (${response.status}): ${text.substring(0, 200)}`);
    }
    if (!response.ok) {
        const msg = (data === null || data === void 0 ? void 0 : data.message) || JSON.stringify(data);
        throw new Error(`Yakkyofy API error (${response.status}): ${msg}`);
    }
    return data;
}
async function internalFetch(path, options = {}) {
    const token = await getInternalToken();
    let url = `${YAKKYOFY_INTERNAL_URL}${path}`;
    if (options.params) {
        const query = Object.entries(options.params)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join("&");
        if (query)
            url += `?${query}`;
    }
    const response = await (0, node_fetch_1.default)(url, {
        method: options.method || "GET",
        headers: {
            "x-access-token": token,
            "x-api-version": "v1",
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (_a) {
        throw new Error(`Yakkyofy Internal API: استجابة غير متوقعة (${response.status})`);
    }
    if (!response.ok) {
        throw new Error(`Yakkyofy Internal API error (${response.status}): ${(data === null || data === void 0 ? void 0 : data.message) || text.substring(0, 160)}`);
    }
    return data;
}
async function internalV2Fetch(path, options = {}) {
    const token = await getInternalToken();
    let url = `${YAKKYOFY_V2_URL}${path}`;
    if (options.params) {
        const query = Object.entries(options.params)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join("&");
        if (query)
            url += `?${query}`;
    }
    const response = await (0, node_fetch_1.default)(url, {
        method: options.method || "GET",
        headers: {
            "x-access-token": token,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch (_a) {
        throw new Error(`Yakkyofy V2 API: استجابة غير متوقعة (${response.status})`);
    }
    if (!response.ok) {
        throw new Error(`Yakkyofy V2 API error (${response.status}): ${(data === null || data === void 0 ? void 0 : data.message) || text.substring(0, 160)}`);
    }
    return data;
}
function extractProductList(payload) {
    if (Array.isArray(payload))
        return payload;
    if (!payload || typeof payload !== "object")
        return [];
    const candidates = [
        payload.data,
        payload.items,
        payload.products,
        payload.results,
        payload.rows,
        payload.docs,
        payload.list,
        payload.records,
    ];
    for (const c of candidates) {
        if (Array.isArray(c))
            return c;
    }
    for (const value of Object.values(payload)) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
            return value;
        }
    }
    return [];
}
function normalizeImageUrl(value) {
    if (!value)
        return "";
    // إذا كان الكائن يحتوي على مصفوفة روابط، خذ أول واحد
    if (typeof value === "object") {
        const nestedArr = value.fullPathImageURIList ||
            value.fullPathImageURI ||
            value.imageURIList ||
            value.imageURI ||
            value.urls ||
            value.list;
        if (Array.isArray(nestedArr) && nestedArr.length) {
            for (const n of nestedArr) {
                const norm = normalizeImageUrl(n);
                if (norm)
                    return norm;
            }
        }
    }
    const raw = (typeof value === "string" && value) ||
        (value === null || value === void 0 ? void 0 : value.url) ||
        (value === null || value === void 0 ? void 0 : value.src) ||
        (value === null || value === void 0 ? void 0 : value.image) ||
        (value === null || value === void 0 ? void 0 : value.imageUrl) ||
        (value === null || value === void 0 ? void 0 : value.mainImage) ||
        (value === null || value === void 0 ? void 0 : value.fullPath) ||
        (value === null || value === void 0 ? void 0 : value.full) ||
        (value === null || value === void 0 ? void 0 : value.original) ||
        (value === null || value === void 0 ? void 0 : value.large) ||
        (value === null || value === void 0 ? void 0 : value.medium) ||
        (value === null || value === void 0 ? void 0 : value.thumb) ||
        (value === null || value === void 0 ? void 0 : value.thumbnail) ||
        (value === null || value === void 0 ? void 0 : value.path) ||
        "";
    if (!raw)
        return "";
    let str = String(raw).trim();
    if (!str)
        return "";
    // إزالة علامات الاقتباس الإضافية إن وُجدت
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        str = str.slice(1, -1).trim();
    }
    if (str.startsWith("https://"))
        return str;
    if (str.startsWith("http://"))
        return "https://" + str.substring(7); // ترقية لـ https لتفادي mixed-content
    if (str.startsWith("//"))
        return `https:${str}`;
    if (str.startsWith("/"))
        return `${YAKKYOFY_MEDIA_FALLBACK}${str}`;
    // روابط بدون بروتوكول (مثل cbu01.alicdn.com/img/...)
    if (/^[a-z0-9.-]+\.(com|net|cn|org|io)\//i.test(str)) {
        return `https://${str}`;
    }
    return str;
}
function dedupeImages(arr) {
    const seen = new Set();
    const out = [];
    for (const i of arr) {
        const key = (i || "").trim();
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}
// استخراج كل الصور المحتملة من بنيات 1688/Yakkyofy المتعددة
function collectImages(item) {
    if (!item || typeof item !== "object")
        return [];
    const arrays = [
        item.images,
        item.pictures,
        item.imageList,
        item.imageUrls,
        item.imageUrlList,
        item.photoUrls,
        item.productImageList,
        item.productImages,
        item.productPictureUrl,
        item.productPictures,
        item.pictureList,
        item.picList,
        item.picUrls,
        item.picUrlList,
        item.skuImages,
        item.detailImages,
        item.detailImageList,
        item.descImages,
    ].filter(Array.isArray);
    // productImage قد يكون كائناً يحتوي fullPathImageURIList
    const productImageObj = item.productImage && typeof item.productImage === "object" && !Array.isArray(item.productImage)
        ? item.productImage
        : null;
    if (productImageObj) {
        const inner = [
            productImageObj.fullPathImageURIList,
            productImageObj.fullPathImageURI,
            productImageObj.imageURIList,
            productImageObj.imageURI,
            productImageObj.urls,
            productImageObj.list,
        ].filter(Array.isArray);
        arrays.push(...inner);
    }
    const singles = [
        typeof item.productImage === "string" ? item.productImage : null,
        productImageObj === null || productImageObj === void 0 ? void 0 : productImageObj.url,
        productImageObj === null || productImageObj === void 0 ? void 0 : productImageObj.src,
        item.imgUrl,
        item.img_url,
        item.img,
        item.mainImage,
        item.mainImageUrl,
        item.mainPic,
        item.mainPicture,
        item.image,
        item.imageUrl,
        item.cover,
        item.coverImage,
        item.coverUrl,
        item.thumb,
        item.thumbnail,
        item.pic,
        item.picUrl,
        item.pic_url,
        item.productImg,
        item.productImageUrl,
    ];
    const all = [];
    for (const arr of arrays)
        all.push(...arr);
    all.push(...singles);
    return dedupeImages(all.map(normalizeImageUrl).filter(Boolean));
}
function normalizeProduct(item) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const images = collectImages(item);
    const variantsRaw = (item === null || item === void 0 ? void 0 : item.variants) || (item === null || item === void 0 ? void 0 : item.skus) || (item === null || item === void 0 ? void 0 : item.skuList) || (item === null || item === void 0 ? void 0 : item.skuInfos) || [];
    const variants = Array.isArray(variantsRaw)
        ? variantsRaw.map((v) => ({
            id: (v === null || v === void 0 ? void 0 : v.id) || (v === null || v === void 0 ? void 0 : v._id) || (v === null || v === void 0 ? void 0 : v.skuId) || (v === null || v === void 0 ? void 0 : v.sku) || "",
            name: (v === null || v === void 0 ? void 0 : v.name) || (v === null || v === void 0 ? void 0 : v.title) || (v === null || v === void 0 ? void 0 : v.sku) || (v === null || v === void 0 ? void 0 : v.skuAttributes) || "",
            sku: (v === null || v === void 0 ? void 0 : v.sku) || (v === null || v === void 0 ? void 0 : v.code) || (v === null || v === void 0 ? void 0 : v.skuId) || "",
            price: Number((v === null || v === void 0 ? void 0 : v.price) || (v === null || v === void 0 ? void 0 : v.salePrice) || (v === null || v === void 0 ? void 0 : v.offerPrice) || 0) || undefined,
            image: normalizeImageUrl((v === null || v === void 0 ? void 0 : v.image) || (v === null || v === void 0 ? void 0 : v.imageUrl) || (v === null || v === void 0 ? void 0 : v.mainImage) || (v === null || v === void 0 ? void 0 : v.pic) || (v === null || v === void 0 ? void 0 : v.picUrl) || (v === null || v === void 0 ? void 0 : v.thumb) || (v === null || v === void 0 ? void 0 : v.thumbnail)) || undefined,
        }))
        : [];
    // الأسعار قد تكون نصاً ("4.00") أو رقماً
    const toNum = (v) => {
        if (v === null || v === undefined || v === "")
            return 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };
    const priceUsd = toNum((_c = (_b = (_a = item === null || item === void 0 ? void 0 : item.priceUsd) !== null && _a !== void 0 ? _a : item === null || item === void 0 ? void 0 : item.price_usd) !== null && _b !== void 0 ? _b : item === null || item === void 0 ? void 0 : item.usdPrice) !== null && _c !== void 0 ? _c : item === null || item === void 0 ? void 0 : item.salePriceUsd);
    const priceLocal = toNum((_f = (_e = (_d = item === null || item === void 0 ? void 0 : item.price) !== null && _d !== void 0 ? _d : item === null || item === void 0 ? void 0 : item.minPrice) !== null && _e !== void 0 ? _e : item === null || item === void 0 ? void 0 : item.offerPrice) !== null && _f !== void 0 ? _f : item === null || item === void 0 ? void 0 : item.wholesalePrice);
    // إذا priceUsd موجود نستخدمه، وإلا نستخدم price
    const finalPrice = priceUsd > 0 ? priceUsd : priceLocal;
    return {
        id: (item === null || item === void 0 ? void 0 : item.id) ||
            (item === null || item === void 0 ? void 0 : item._id) ||
            (item === null || item === void 0 ? void 0 : item.itemId) ||
            (item === null || item === void 0 ? void 0 : item.productId) ||
            (item === null || item === void 0 ? void 0 : item.offerId) ||
            (item === null || item === void 0 ? void 0 : item.pid) ||
            "",
        name: (item === null || item === void 0 ? void 0 : item.translateTitle) ||
            (item === null || item === void 0 ? void 0 : item.titleEn) ||
            (item === null || item === void 0 ? void 0 : item.name) ||
            (item === null || item === void 0 ? void 0 : item.title) ||
            (item === null || item === void 0 ? void 0 : item.productName) ||
            (item === null || item === void 0 ? void 0 : item.subjectTrans) ||
            (item === null || item === void 0 ? void 0 : item.subject) ||
            "منتج",
        image: (images === null || images === void 0 ? void 0 : images[0]) || "",
        images,
        price: finalPrice,
        sale_price: toNum((item === null || item === void 0 ? void 0 : item.sale_price) || (item === null || item === void 0 ? void 0 : item.salePrice)) || finalPrice,
        category: (item === null || item === void 0 ? void 0 : item.category) || (item === null || item === void 0 ? void 0 : item.categoryName) || (item === null || item === void 0 ? void 0 : item.catName) || "",
        sku: (item === null || item === void 0 ? void 0 : item.sku) || (item === null || item === void 0 ? void 0 : item.code) || (item === null || item === void 0 ? void 0 : item.itemId) || "",
        description: (item === null || item === void 0 ? void 0 : item.description) ||
            (item === null || item === void 0 ? void 0 : item.desc) ||
            (item === null || item === void 0 ? void 0 : item.translateTitle) ||
            (item === null || item === void 0 ? void 0 : item.title) ||
            "",
        variants,
        stock: (_h = (_g = item === null || item === void 0 ? void 0 : item.stock) !== null && _g !== void 0 ? _g : item === null || item === void 0 ? void 0 : item.quantity) !== null && _h !== void 0 ? _h : undefined,
        raw: item,
    };
}
// ==================== اختبار الاتصال ====================
// يستخدم GET /orders/{id} - إذا عاد 400/404 JSON يعني الـ API key صحيح
// إذا عاد 401/403 يعني الـ key غير صحيح
async function testConnection(apiKey, email, password) {
    try {
        const response = await (0, node_fetch_1.default)(`${YAKKYOFY_REST_URL}/orders/connection-test`, {
            method: "GET",
            headers: {
                "X-API-Key": apiKey,
                Accept: "application/json",
            },
        });
        const text = await response.text();
        const isJson = text.trim().startsWith("{") || text.trim().startsWith("[");
        if (!isJson) {
            return {
                success: false,
                message: `مفتاح API غير صحيح - الخادم أعاد HTML (${response.status}). تحقق من مفتاح API في app.yakkyofy.com → Manage Stores`,
            };
        }
        if (response.status === 401 || response.status === 403) {
            const data = JSON.parse(text);
            return {
                success: false,
                message: `مفتاح API غير صحيح (${response.status}): ${(data === null || data === void 0 ? void 0 : data.message) || "Unauthorized"}`,
            };
        }
        if (email && password) {
            const token = await loginInternal(email, password);
            if (!token) {
                return { success: false, message: "فشل الحصول على توكن الاستيراد المباشر." };
            }
            return { success: true, message: "تم الاتصال بـ Yakkyofy (REST + استيراد مباشر) بنجاح ✓" };
        }
        return { success: true, message: "تم الاتصال بـ Yakkyofy REST API بنجاح ✓" };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "خطأ غير معروف";
        return { success: false, message: msg };
    }
}
// ==================== منتجات (API داخلي غير رسمي) ====================
async function searchProducts(params) {
    var _a, _b, _c;
    // 1) كتالوج Yakkyofy/1688 عبر V2 (أقرب لما يظهر داخل المنصة)
    try {
        const v2 = await internalV2Fetch("/1688-catalogue", {
            params: {
                page: params.page || 1,
                perPage: params.per_page || 20,
                category: params.category,
                keyword: params.keyword,
            },
        });
        const listRaw = extractProductList(v2);
        const list = listRaw.map(normalizeProduct);
        return {
            data: list,
            total: ((_a = v2 === null || v2 === void 0 ? void 0 : v2.pagination) === null || _a === void 0 ? void 0 : _a.total) || (v2 === null || v2 === void 0 ? void 0 : v2.total) || list.length,
            raw: v2,
            source: "v2-1688-catalogue",
        };
    }
    catch (_d) {
        // fallback to V1 internal endpoints
    }
    const commonParams = {
        page: params.page || 1,
        per_page: params.per_page || 20,
        limit: params.per_page || 20,
        keyword: params.keyword,
        q: params.keyword,
        search: params.keyword,
        name: params.keyword,
        title: params.keyword,
        category: params.category,
    };
    const attempts = [
        () => internalFetch("/products", { params: commonParams }),
        () => internalFetch("/products/", { params: commonParams }),
        () => internalFetch("/products/management", { params: commonParams }),
        () => internalFetch("/products/management/", { params: commonParams }),
        () => internalFetch("/products/search", { method: "POST", body: commonParams }),
        () => internalFetch("/products/management/search", { method: "POST", body: commonParams }),
    ];
    let lastError = null;
    for (const attempt of attempts) {
        try {
            const res = await attempt();
            const list = extractProductList(res);
            if (list.length > 0) {
                const normalized = list.map(normalizeProduct);
                return {
                    data: normalized,
                    total: (res === null || res === void 0 ? void 0 : res.total) || ((_b = res === null || res === void 0 ? void 0 : res.meta) === null || _b === void 0 ? void 0 : _b.total) || (res === null || res === void 0 ? void 0 : res.count) || normalized.length,
                    raw: res,
                };
            }
            // إذا لم نجد عناصر، نرجع أول رد ناجح بدلاً من رمي خطأ
            if (res) {
                const normalized = extractProductList(res).map(normalizeProduct);
                return {
                    data: normalized,
                    total: (res === null || res === void 0 ? void 0 : res.total) || ((_c = res === null || res === void 0 ? void 0 : res.meta) === null || _c === void 0 ? void 0 : _c.total) || (res === null || res === void 0 ? void 0 : res.count) || normalized.length || 0,
                    raw: res,
                };
            }
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error("Yakkyofy search failed");
        }
    }
    throw lastError || new Error("تعذر جلب منتجات Yakkyofy.");
}
async function getProductDetail(productId) {
    const attempts = [
        { label: "v2 /1688-catalogue/{id}", fn: () => internalV2Fetch(`/1688-catalogue/${productId}`) },
        { label: "v2 /1688-catalogue/detail/{id}", fn: () => internalV2Fetch(`/1688-catalogue/detail/${productId}`) },
        { label: "v2 /1688-catalogue?itemId", fn: () => internalV2Fetch(`/1688-catalogue`, { params: { itemId: productId } }) },
        { label: "v2 /1688-catalogue/item/{id}", fn: () => internalV2Fetch(`/1688-catalogue/item/${productId}`) },
        { label: "v1 /products/{id}", fn: () => internalFetch(`/products/${productId}`) },
        { label: "v1 /products/edit/{id}", fn: () => internalFetch(`/products/edit/${productId}`) },
    ];
    let lastError = null;
    for (const a of attempts) {
        try {
            const res = await a.fn();
            const base = (res === null || res === void 0 ? void 0 : res.data) || res;
            // إذا كان رد عبارة عن قائمة، نأخذ أول عنصر
            const candidate = Array.isArray(base) ? base[0] : base;
            if (candidate && typeof candidate === "object" && Object.keys(candidate).length > 1) {
                console.log(`[yakkyofy] detail ok via ${a.label}, keys:`, Object.keys(candidate));
                return normalizeProduct(candidate);
            }
        }
        catch (err) {
            lastError = err;
            console.log(`[yakkyofy] detail attempt ${a.label} failed: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
        }
    }
    throw lastError || new Error("تعذر جلب تفاصيل منتج Yakkyofy.");
}
async function getProductVariants(productId) {
    var _a;
    try {
        return await internalFetch(`/products/variants/index/${productId}`);
    }
    catch (_b) {
        const detail = await getProductDetail(productId);
        return (detail === null || detail === void 0 ? void 0 : detail.variants) || ((_a = detail === null || detail === void 0 ? void 0 : detail.data) === null || _a === void 0 ? void 0 : _a.variants) || [];
    }
}
async function getCategories() {
    return internalFetch("/products/settings");
}
// ==================== إنشاء طلب ====================
async function createOrder(orderData) {
    return yakkyofyFetch("/orders", {
        method: "POST",
        body: orderData,
    });
}
// ==================== جلب طلب معين ====================
async function getOrder(orderId) {
    return yakkyofyFetch(`/orders/${orderId}`);
}
async function listOrders(params) {
    return internalFetch("/orders", {
        params: {
            page: params.page || 1,
            per_page: params.per_page || 20,
            status: params.status,
        },
    });
}
async function getTracking(orderId) {
    try {
        return await internalFetch(`/orders/fulfillment/tracking/${orderId}`);
    }
    catch (_a) {
        return await internalFetch("/orders/fulfillment/tracking", {
            params: { orderId },
        });
    }
}
async function getBalance() {
    try {
        return await internalFetch("/subscription");
    }
    catch (_a) {
        return { balance: null };
    }
}
//# sourceMappingURL=yakkyofyClient.js.map