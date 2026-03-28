"use strict";
/**
 * Tamara API Client
 * خدمة التكامل مع تمارا - اشتر الآن وادفع لاحقاً
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setApiToken = setApiToken;
exports.createCheckoutSession = createCheckoutSession;
exports.getOrderDetails = getOrderDetails;
exports.getPaymentStatus = getPaymentStatus;
exports.authorizeOrder = authorizeOrder;
exports.capturePayment = capturePayment;
exports.cancelOrder = cancelOrder;
exports.refundPayment = refundPayment;
exports.checkCustomerEligibility = checkCustomerEligibility;
// Tamara API Base URLs
const TAMARA_SANDBOX_URL = "https://api-sandbox.tamara.co";
const TAMARA_PRODUCTION_URL = "https://api.tamara.co";
// استخدام Production (Live)
const TAMARA_API_URL = TAMARA_PRODUCTION_URL;
// مفتاح API - سيتم تخزينه في Firestore settings
let apiToken = null;
/**
 * تعيين مفتاح API
 */
function setApiToken(token) {
    apiToken = token;
}
/**
 * الحصول على مفتاح API
 */
function getApiToken() {
    if (!apiToken) {
        throw new Error("Tamara API token غير مُعد. يرجى إعداده أولاً.");
    }
    return apiToken;
}
/**
 * إرسال طلب HTTP لـ Tamara API
 */
async function tamaraRequest(endpoint, method = "GET", body) {
    const url = `${TAMARA_API_URL}${endpoint}`;
    const token = getApiToken();
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    };
    const options = {
        method,
        headers,
    };
    if (body && method !== "GET") {
        options.body = JSON.stringify(body);
    }
    console.log(`Tamara API Request: ${method} ${endpoint}`);
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
        console.error("Tamara API Error:", data);
        throw new Error(data.message || data.error || `فشل طلب Tamara: ${response.status}`);
    }
    return data;
}
/**
 * إنشاء جلسة دفع تمارا
 */
async function createCheckoutSession(request) {
    const currency = request.currency || "SAR";
    // تحويل العناصر لتنسيق تمارا
    const items = request.items.map((item) => ({
        reference_id: item.reference_id,
        type: "physical",
        name: item.name,
        quantity: item.quantity,
        unit_price: {
            amount: item.unit_price,
            currency,
        },
        total_amount: {
            amount: item.unit_price * item.quantity,
            currency,
        },
        image_url: item.image_url,
    }));
    // تجهيز بيانات المستهلك
    const consumer = {
        first_name: request.consumer.first_name,
        last_name: request.consumer.last_name || request.consumer.first_name,
        email: request.consumer.email,
        phone_number: request.consumer.phone,
    };
    // تجهيز عنوان الشحن
    const shippingAddress = {
        first_name: request.shipping_address.first_name,
        last_name: request.shipping_address.last_name || request.shipping_address.first_name,
        line1: request.shipping_address.line1,
        city: request.shipping_address.city,
        country_code: "SA", // السعودية
        phone_number: request.shipping_address.phone,
    };
    // تجهيز طلب Checkout
    const checkoutRequest = {
        order_reference_id: request.order_reference_id,
        total_amount: {
            amount: request.total_amount,
            currency,
        },
        description: request.description || `طلب من جبوري للإلكترونيات #${request.order_reference_id}`,
        country_code: "SA",
        payment_type: "PAY_BY_INSTALMENTS",
        instalments: 3, // 3 أقساط
        locale: "ar_SA",
        items,
        consumer,
        shipping_address: shippingAddress,
        shipping_amount: {
            amount: request.shipping_amount,
            currency,
        },
        tax_amount: {
            amount: 0,
            currency,
        },
        merchant_url: {
            success: request.success_url,
            failure: request.failure_url,
            cancel: request.cancel_url,
            notification: request.success_url, // Webhook URL - يمكن تغييره لاحقاً
        },
    };
    console.log("Creating Tamara checkout session:", JSON.stringify(checkoutRequest, null, 2));
    const response = await tamaraRequest("/checkout", "POST", checkoutRequest);
    return {
        checkout_id: response.checkout_id,
        checkout_url: response.checkout_url,
        status: response.status || "created",
    };
}
/**
 * الحصول على تفاصيل الطلب
 */
async function getOrderDetails(orderId) {
    return tamaraRequest(`/orders/${orderId}`);
}
/**
 * التحقق من حالة الدفع
 */
async function getPaymentStatus(checkoutId) {
    const response = await tamaraRequest(`/checkout/${checkoutId}`);
    return response;
}
/**
 * تأكيد الطلب (Authorize)
 * يتم استدعاؤه بعد نجاح الدفع من العميل
 */
async function authorizeOrder(orderId) {
    const response = await tamaraRequest(`/orders/${orderId}/authorise`, "POST", {});
    return response;
}
/**
 * تأكيد استلام الطلب (Capture)
 * يتم استدعاؤه بعد شحن الطلب
 */
async function capturePayment(orderId, amount, currency = "SAR") {
    const captureRequest = {
        total_amount: {
            amount,
            currency,
        },
        shipping_info: {
            shipped_at: new Date().toISOString(),
            shipping_company: "Local Delivery",
        },
    };
    return tamaraRequest(`/orders/${orderId}/capture`, "POST", captureRequest);
}
/**
 * إلغاء الطلب
 */
async function cancelOrder(orderId) {
    return tamaraRequest(`/orders/${orderId}/cancel`, "POST", {});
}
/**
 * استرداد المبلغ
 */
async function refundPayment(orderId, amount, currency = "SAR", reason = "Customer refund request") {
    const refundRequest = {
        total_amount: {
            amount,
            currency,
        },
        comment: reason,
    };
    return tamaraRequest(`/orders/${orderId}/refund`, "POST", refundRequest);
}
/**
 * التحقق من صلاحية العميل لاستخدام تمارا
 */
async function checkCustomerEligibility(phone, totalAmount, currency = "SAR") {
    const request = {
        phone_number: phone,
        total_amount: {
            amount: totalAmount,
            currency,
        },
        country_code: "SA",
    };
    try {
        const response = await tamaraRequest("/checkout/customer-eligibility", "POST", request);
        return {
            has_available_credit: response.has_available_credit || false,
            credit_limit: response.credit_limit,
        };
    }
    catch (error) {
        // في حالة فشل التحقق، نعتبر العميل مؤهل افتراضياً
        console.warn("Customer eligibility check failed:", error);
        return { has_available_credit: true };
    }
}
//# sourceMappingURL=tamaraClient.js.map