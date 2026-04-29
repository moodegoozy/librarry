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
const YAKKYOFY_BASE_URL = "https://app.yakkyofy.com/api";
// ==================== تسجيل الدخول والحصول على Access Token ====================
async function loginAndGetToken(email, password) {
    var _a;
    const response = await (0, node_fetch_1.default)(`${YAKKYOFY_BASE_URL}/b2b/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
    });
    const bodyText = await response.text();
    let data;
    try {
        data = JSON.parse(bodyText);
    }
    catch (_b) {
        throw new Error(`تسجيل الدخول فشل (${response.status}): ${bodyText.substring(0, 300)}`);
    }
    if (!response.ok) {
        const msg = (data === null || data === void 0 ? void 0 : data.message) || (data === null || data === void 0 ? void 0 : data.error) || JSON.stringify(data);
        throw new Error(`فشل تسجيل الدخول في Yakkyofy (${response.status}): ${msg}`);
    }
    const token = (data === null || data === void 0 ? void 0 : data.access_token) || (data === null || data === void 0 ? void 0 : data.token) || ((_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.access_token);
    if (!token) {
        throw new Error(`لم يُعاد access_token من Yakkyofy. الاستجابة: ${JSON.stringify(data).substring(0, 300)}`);
    }
    // حفظ الـ token في Firestore مع تاريخ انتهاء الصلاحية (24 ساعة)
    const db = admin.firestore();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.doc("settings/yakkyofy").set({
        accessToken: token,
        tokenExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    }, { merge: true });
    return token;
}
// ==================== الحصول على access token صالح ====================
async function getValidAccessToken() {
    const db = admin.firestore();
    const settingsDoc = await db.doc("settings/yakkyofy").get();
    const settings = settingsDoc.data();
    if (!(settings === null || settings === void 0 ? void 0 : settings.email) || !(settings === null || settings === void 0 ? void 0 : settings.apiKey)) {
        throw new Error("بيانات Yakkyofy غير مُعدة. يرجى إدخال البريد الإلكتروني ومفتاح API في إعدادات Yakkyofy.");
    }
    // التحقق من صلاحية الـ token المخزّن
    if (settings.accessToken && settings.tokenExpiresAt) {
        let expiry;
        if (settings.tokenExpiresAt.toDate) {
            expiry = settings.tokenExpiresAt.toDate();
        }
        else {
            expiry = new Date(settings.tokenExpiresAt);
        }
        // إضافة هامش 5 دقائق
        if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
            return settings.accessToken;
        }
    }
    // تسجيل دخول للحصول على token جديد
    return await loginAndGetToken(settings.email, settings.apiKey);
}
// ==================== طلب مصادق ====================
async function yakkyofyFetch(path, options = {}) {
    const accessToken = await getValidAccessToken();
    let url = `${YAKKYOFY_BASE_URL}${path}`;
    // إضافة query params
    if (options.params && Object.keys(options.params).length > 0) {
        const query = Object.entries(options.params)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
        if (query)
            url += `?${query}`;
    }
    const response = await (0, node_fetch_1.default)(url, {
        method: options.method || "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        ...(options.body
            ? { body: JSON.stringify(options.body) }
            : {}),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Yakkyofy API error ${response.status}: ${text.substring(0, 300) || response.statusText}`);
    }
    // التحقق من أن الاستجابة JSON وليست HTML قبل التحويل
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
        const preview = (await response.text()).substring(0, 300);
        const isHtml = preview.toLowerCase().includes("<!doctype") || preview.toLowerCase().includes("<html");
        const hint = isHtml
            ? "الـ API يُعيد صفحة HTML بدل JSON - تحقق من صحة مفتاح API في إعدادات Yakkyofy."
            : `نوع الاستجابة غير متوقع (${contentType}):`;
        throw new Error(`${hint} ${preview}`);
    }
    return response.json();
}
// ==================== اختبار الاتصال ====================
async function testConnection(email, apiKey) {
    try {
        // محاولة تسجيل الدخول للحصول على access_token
        const token = await loginAndGetToken(email, apiKey);
        // اختبار طلب حقيقي بعد الحصول على الـ token
        const response = await (0, node_fetch_1.default)(`${YAKKYOFY_BASE_URL}/b2b/products?per_page=1`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
        if (response.ok) {
            return { success: true, message: "تم الاتصال بـ Yakkyofy بنجاح ✓" };
        }
        else {
            const bodyText = await response.text();
            return {
                success: false,
                message: `تسجيل الدخول نجح لكن طلب المنتجات فشل (${response.status}): ${bodyText.substring(0, 200)}`,
            };
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "خطأ غير معروف";
        return { success: false, message: msg };
    }
}
// ==================== البحث عن منتجات ====================
async function searchProducts(params) {
    const queryParams = {
        page: params.page || 1,
        per_page: params.per_page || 20,
    };
    if (params.name)
        queryParams["name"] = params.name;
    if (params.category)
        queryParams["category"] = params.category;
    return yakkyofyFetch("/b2b/products", { params: queryParams });
}
// ==================== تفاصيل منتج ====================
async function getProductDetail(productId) {
    return yakkyofyFetch(`/b2b/products/${productId}`);
}
// ==================== متغيرات المنتج ====================
async function getProductVariants(productId) {
    return yakkyofyFetch(`/b2b/products/${productId}/variants`);
}
// ==================== التصنيفات ====================
async function getCategories() {
    return yakkyofyFetch("/b2b/categories");
}
// ==================== إنشاء طلب ====================
async function createOrder(orderData) {
    return yakkyofyFetch("/b2b/orders", {
        method: "POST",
        body: orderData,
    });
}
// ==================== جلب طلب ====================
async function getOrder(orderId) {
    return yakkyofyFetch(`/b2b/orders/${orderId}`);
}
// ==================== قائمة الطلبات ====================
async function listOrders(params) {
    const queryParams = {
        page: params.page || 1,
        per_page: params.per_page || 20,
    };
    if (params.status)
        queryParams["status"] = params.status;
    return yakkyofyFetch("/b2b/orders", { params: queryParams });
}
// ==================== تتبع الشحنة ====================
async function getTracking(orderId) {
    return yakkyofyFetch(`/b2b/orders/${orderId}/tracking`);
}
// ==================== رصيد الحساب ====================
async function getBalance() {
    return yakkyofyFetch("/b2b/balance");
}
//# sourceMappingURL=yakkyofyClient.js.map