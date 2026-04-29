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
    var _a, _b;
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
                return {
                    data: list,
                    total: (res === null || res === void 0 ? void 0 : res.total) || ((_a = res === null || res === void 0 ? void 0 : res.meta) === null || _a === void 0 ? void 0 : _a.total) || (res === null || res === void 0 ? void 0 : res.count) || list.length,
                    raw: res,
                };
            }
            // إذا لم نجد عناصر، نرجع أول رد ناجح بدلاً من رمي خطأ
            if (res) {
                return {
                    data: extractProductList(res),
                    total: (res === null || res === void 0 ? void 0 : res.total) || ((_b = res === null || res === void 0 ? void 0 : res.meta) === null || _b === void 0 ? void 0 : _b.total) || (res === null || res === void 0 ? void 0 : res.count) || 0,
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
    try {
        return await internalFetch(`/products/${productId}`);
    }
    catch (_a) {
        return await internalFetch(`/products/edit/${productId}`);
    }
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