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
// ==================== الحصول على إعدادات Yakkyofy ====================
async function getApiKey() {
    const db = admin.firestore();
    const settingsDoc = await db.doc("settings/yakkyofy").get();
    const settings = settingsDoc.data();
    if (!(settings === null || settings === void 0 ? void 0 : settings.apiKey)) {
        throw new Error("مفتاح Yakkyofy API غير مُعد. يرجى إدخاله في إعدادات Yakkyofy.");
    }
    return settings.apiKey;
}
// ==================== طلب مصادق ====================
async function yakkyofyFetch(path, options = {}) {
    const apiKey = await getApiKey();
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
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        ...(options.body
            ? { body: JSON.stringify(options.body) }
            : {}),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Yakkyofy API error ${response.status}: ${text || response.statusText}`);
    }
    return response.json();
}
// ==================== اختبار الاتصال ====================
async function testConnection(apiKey) {
    try {
        const response = await (0, node_fetch_1.default)(`${YAKKYOFY_BASE_URL}/b2b/products?per_page=1`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
        if (response.ok) {
            return { success: true, message: "تم الاتصال بـ Yakkyofy بنجاح" };
        }
        else {
            const text = await response.text().catch(() => "");
            return {
                success: false,
                message: `فشل الاتصال (${response.status}): ${text || response.statusText}`,
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