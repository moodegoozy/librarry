"use strict";
/**
 * Tap Payments API Client
 * خدمة التكامل مع تاب - Backend
 * توثيق: https://developers.tap.company/reference/create-a-charge
 *
 * نستخدم مصدر src_all لعرض جميع وسائل الدفع المفعّلة في حساب تاب
 * (mada, KNET, Visa, Mastercard, AMEX, Apple Pay, Google Pay, Benefit, ...).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setApiKeys = setApiKeys;
exports.getPublicKey = getPublicKey;
exports.createCharge = createCharge;
exports.retrieveCharge = retrieveCharge;
exports.refundCharge = refundCharge;
exports.testConnection = testConnection;
// المفتاح السري لتاب (sk_live_... أو sk_test_...)
let secretKey = "";
// المفتاح العام (pk_...) — يُخزَّن للمرجع فقط، لا يُستخدم في مسار الـ redirect
let publicKey = "";
const TAP_API_URL = "https://api.tap.company/v2";
/**
 * تعيين مفاتيح API
 */
function setApiKeys(secKey, pubKey) {
    secretKey = secKey;
    if (pubKey !== undefined)
        publicKey = pubKey;
}
function getPublicKey() {
    return publicKey;
}
/**
 * إنشاء عملية دفع (Charge) بمصدر src_all لعرض كل الوسائل
 */
async function createCharge(params) {
    var _a, _b;
    if (!secretKey) {
        throw new Error("مفتاح Tap السري غير معد");
    }
    const requestBody = {
        amount: params.amount,
        currency: params.currency || "SAR",
        threeDSecure: true,
        save_card: false,
        description: params.description || "",
        reference: {
            transaction: params.transaction_reference || params.order_reference,
            order: params.order_reference,
        },
        receipt: {
            email: true,
            sms: true,
        },
        customer: params.customer,
        source: {
            id: params.source_id || "src_all",
        },
        ...(params.post_url ? { post: { url: params.post_url } } : {}),
        redirect: {
            url: params.redirect_url,
        },
        ...(params.metadata ? { metadata: params.metadata } : {}),
    };
    const response = await fetch(`${TAP_API_URL}/charges`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${secretKey}`,
        },
        body: JSON.stringify(requestBody),
    });
    const result = (await response.json().catch(() => ({})));
    if (!response.ok) {
        console.error("Tap API error:", JSON.stringify(result));
        const msg = ((_b = (_a = result.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.description) ||
            result.message ||
            `Tap API error: ${response.status}`;
        throw new Error(msg);
    }
    console.log("Tap charge response:", JSON.stringify(result, null, 2));
    return result;
}
/**
 * استرجاع حالة عملية الدفع
 */
async function retrieveCharge(chargeId) {
    var _a, _b;
    if (!secretKey) {
        throw new Error("مفتاح Tap السري غير معد");
    }
    const response = await fetch(`${TAP_API_URL}/charges/${chargeId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${secretKey}`,
        },
    });
    const result = (await response.json().catch(() => ({})));
    if (!response.ok) {
        const msg = ((_b = (_a = result.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.description) ||
            result.message ||
            `Tap retrieve error: ${response.status}`;
        throw new Error(msg);
    }
    return result;
}
/**
 * استرجاع الدفع (Refund)
 */
async function refundCharge(params) {
    var _a, _b;
    if (!secretKey) {
        throw new Error("مفتاح Tap السري غير معد");
    }
    const response = await fetch(`${TAP_API_URL}/refunds`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
            charge_id: params.chargeId,
            amount: params.amount,
            currency: params.currency || "SAR",
            reason: params.reason || "requested_by_customer",
        }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const msg = ((_b = (_a = result.errors) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.description) ||
            result.message ||
            `Tap refund error: ${response.status}`;
        throw new Error(msg);
    }
    return result;
}
/**
 * التحقق من صحة المفتاح السري بجلب قائمة العملات المتاحة للتاجر
 */
async function testConnection() {
    if (!secretKey) {
        throw new Error("مفتاح Tap السري غير معد");
    }
    // نستخدم نقطة نهاية خفيفة للتحقق من صلاحية المفتاح
    const response = await fetch(`${TAP_API_URL}/charges/?limit=1`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${secretKey}`,
        },
    });
    if (response.status === 401 || response.status === 403) {
        throw new Error("المفتاح السري غير صالح");
    }
    // أي استجابة غير 401/403 تعني أن المفتاح مقبول
    return true;
}
//# sourceMappingURL=tapClient.js.map