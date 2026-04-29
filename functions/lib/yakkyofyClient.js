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
exports.createOrder = createOrder;
exports.getOrder = getOrder;
const node_fetch_1 = __importDefault(require("node-fetch"));
const admin = __importStar(require("firebase-admin"));
// ==================== Yakkyofy REST API ====================
// توثيق: https://developers.yakkyofy.com
// Base URL: https://rest.yakkyofy.com
// المصادقة: X-API-Key header فقط (من Manage Stores في Dashboard)
// Endpoints المتاحة: GET /orders/{id} - POST /orders
const YAKKYOFY_BASE_URL = "https://rest.yakkyofy.com";
// ==================== الحصول على API Key ====================
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
    const url = `${YAKKYOFY_BASE_URL}${path}`;
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
// ==================== اختبار الاتصال ====================
// يستخدم GET /orders/{id} - إذا عاد 400/404 JSON يعني الـ API key صحيح
// إذا عاد 401/403 يعني الـ key غير صحيح
async function testConnection(apiKey) {
    try {
        const response = await (0, node_fetch_1.default)(`${YAKKYOFY_BASE_URL}/orders/connection-test`, {
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
        // 400 أو 404 = الـ API تعرّف على الطلب = المفتاح صحيح
        return { success: true, message: "تم الاتصال بـ Yakkyofy REST API بنجاح ✓" };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "خطأ غير معروف";
        return { success: false, message: msg };
    }
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
//# sourceMappingURL=yakkyofyClient.js.map