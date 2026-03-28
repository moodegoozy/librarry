"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.captureOrder = captureOrder;
exports.getOrderDetails = getOrderDetails;
const node_fetch_1 = __importDefault(require("node-fetch"));
// PayPal API URLs
const PAYPAL_SANDBOX_URL = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_URL = "https://api-m.paypal.com";
// Get PayPal config from environment variables
function getPayPalConfig() {
    return {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        mode: process.env.PAYPAL_MODE || "sandbox",
    };
}
// Get the appropriate PayPal API URL based on mode
function getBaseUrl() {
    const { mode } = getPayPalConfig();
    return mode === "live" ? PAYPAL_LIVE_URL : PAYPAL_SANDBOX_URL;
}
// Get PayPal access token
async function getAccessToken() {
    const { clientId, clientSecret } = getPayPalConfig();
    if (!clientId || !clientSecret) {
        throw new Error("PayPal credentials not configured");
    }
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const baseUrl = getBaseUrl();
    const response = await (0, node_fetch_1.default)(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });
    const data = await response.json();
    if (!response.ok) {
        console.error("PayPal auth error:", data);
        throw new Error(data.error_description || "Failed to get PayPal access token");
    }
    return data.access_token;
}
// Create PayPal order for Smart Buttons
async function createOrder(orderData) {
    var _a, _b;
    const accessToken = await getAccessToken();
    const baseUrl = getBaseUrl();
    // PayPal لا يدعم SAR - نحول دائماً إلى USD
    // سعر الصرف التقريبي: 1 SAR ≈ 0.27 USD
    const currency = "USD";
    const amount = orderData.currency === "SAR"
        ? (orderData.amount * 0.27).toFixed(2)
        : orderData.amount.toFixed(2);
    const payload = {
        intent: "CAPTURE",
        purchase_units: [
            {
                reference_id: orderData.orderId,
                description: orderData.description,
                amount: {
                    currency_code: currency,
                    value: amount,
                },
            },
        ],
        // application_context لتجربة مستخدم أفضل
        application_context: {
            brand_name: "جبوري للإلكترونيات",
            landing_page: "NO_PREFERENCE",
            user_action: "PAY_NOW",
            return_url: "https://jabouri-digital-library.web.app/checkout/success",
            cancel_url: "https://jabouri-digital-library.web.app/checkout",
        },
    };
    const response = await (0, node_fetch_1.default)(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `order-${orderData.orderId}-${Date.now()}`,
        },
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
        console.error("PayPal create order error:", data);
        throw new Error(data.message || ((_b = (_a = data.details) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.description) || "Failed to create PayPal order");
    }
    return {
        id: data.id,
        status: data.status,
    };
}
// Capture PayPal order (complete the payment)
async function captureOrder(paypalOrderId) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const accessToken = await getAccessToken();
    const baseUrl = getBaseUrl();
    const response = await (0, node_fetch_1.default)(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json();
    if (!response.ok) {
        console.error("PayPal capture error:", data);
        throw new Error(data.message || ((_b = (_a = data.details) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.description) || "Failed to capture PayPal payment");
    }
    const capture = (_f = (_e = (_d = (_c = data.purchase_units) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.payments) === null || _e === void 0 ? void 0 : _e.captures) === null || _f === void 0 ? void 0 : _f[0];
    return {
        id: data.id,
        status: data.status,
        captureId: (capture === null || capture === void 0 ? void 0 : capture.id) || "",
        amount: ((_g = capture === null || capture === void 0 ? void 0 : capture.amount) === null || _g === void 0 ? void 0 : _g.value) || "0",
        currency: ((_h = capture === null || capture === void 0 ? void 0 : capture.amount) === null || _h === void 0 ? void 0 : _h.currency_code) || "SAR",
    };
}
// Get order details
async function getOrderDetails(paypalOrderId) {
    const accessToken = await getAccessToken();
    const baseUrl = getBaseUrl();
    const response = await (0, node_fetch_1.default)(`${baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json();
    if (!response.ok) {
        console.error("PayPal get order error:", data);
        throw new Error(data.message || "Failed to get PayPal order details");
    }
    return data;
}
//# sourceMappingURL=paypalClient.js.map