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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cjSyncOrderStatuses = exports.onOrderCreated = exports.cjGetBalance = exports.cjCalculateFreight = exports.cjGetTracking = exports.cjListOrders = exports.cjConfirmOrder = exports.cjCreateOrder = exports.cjGetCategories = exports.cjGetProductInventory = exports.cjGetProductVariants = exports.cjGetProductDetail = exports.cjSearchProducts = exports.cjTestConnection = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cj = __importStar(require("./cjClient"));
admin.initializeApp();
// التحقق من أن المستخدم أدمن
async function verifyAdmin(auth) {
    if (!auth)
        throw new functions.https.HttpsError("unauthenticated", "يجب تسجيل الدخول");
    const userDoc = await admin.firestore().doc(`users/${auth.uid}`).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== "admin") {
        throw new functions.https.HttpsError("permission-denied", "صلاحية الأدمن مطلوبة");
    }
}
// ==================== اختبار الاتصال ====================
exports.cjTestConnection = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    const { email, apiKey } = data;
    if (!email)
        throw new functions.https.HttpsError("invalid-argument", "بريد CJ مطلوب");
    if (!apiKey)
        throw new functions.https.HttpsError("invalid-argument", "مفتاح API مطلوب");
    return cj.testConnection(email, apiKey);
});
// تحويل الأخطاء العادية إلى HttpsError
function wrapError(error) {
    if (error instanceof functions.https.HttpsError)
        throw error;
    const msg = error instanceof Error ? error.message : "خطأ غير متوقع";
    if (msg.includes("API Key غير مُعد") || msg.includes("غير مُعد")) {
        throw new functions.https.HttpsError("failed-precondition", msg);
    }
    throw new functions.https.HttpsError("internal", msg);
}
// ==================== البحث عن منتجات ====================
exports.cjSearchProducts = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    try {
        const result = await cj.searchProducts({
            productNameEn: data.keyword,
            categoryId: data.categoryId,
            pageNum: data.pageNum || 1,
            pageSize: data.pageSize || 20,
        });
        // Log first product image for debugging
        const res = result;
        if ((_c = (_b = res === null || res === void 0 ? void 0 : res.data) === null || _b === void 0 ? void 0 : _b.list) === null || _c === void 0 ? void 0 : _c[0]) {
            const s = res.data.list[0];
            console.log("CJ productImage:", s.productImage);
        }
        return result;
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== تفاصيل منتج ====================
exports.cjGetProductDetail = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    if (!data.pid)
        throw new functions.https.HttpsError("invalid-argument", "pid مطلوب");
    try {
        return await cj.getProductDetail(data.pid);
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== متغيرات المنتج ====================
exports.cjGetProductVariants = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    if (!data.pid)
        throw new functions.https.HttpsError("invalid-argument", "pid مطلوب");
    try {
        return await cj.getProductVariants(data.pid);
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== مخزون المنتج ====================
exports.cjGetProductInventory = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    if (!data.vid)
        throw new functions.https.HttpsError("invalid-argument", "vid مطلوب");
    try {
        return await cj.getProductInventory(data.vid);
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== تصنيفات CJ ====================
exports.cjGetCategories = functions.https.onCall(async (_data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    try {
        return await cj.getCJCategories();
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== إنشاء طلب CJ ====================
exports.cjCreateOrder = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    const { firestoreOrderId, orderData } = data;
    if (!orderData)
        throw new functions.https.HttpsError("invalid-argument", "orderData مطلوب");
    try {
        const result = await cj.createCJOrder(orderData);
        // تحديث الطلب في Firestore مع بيانات CJ
        if (result.result && result.data && firestoreOrderId) {
            await admin
                .firestore()
                .doc(`orders/${firestoreOrderId}`)
                .update({
                isCJOrder: true,
                cjOrderId: result.data.orderId || result.data.orderNum,
                cjOrderNum: result.data.orderNum,
                cjOrderStatus: "CREATED",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return result;
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== تأكيد طلب CJ ====================
exports.cjConfirmOrder = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    if (!data.orderId)
        throw new functions.https.HttpsError("invalid-argument", "orderId مطلوب");
    try {
        return await cj.confirmCJOrder(data.orderId);
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== قائمة طلبات CJ ====================
exports.cjListOrders = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    try {
        return await cj.listCJOrders({
            pageNum: data.pageNum || 1,
            pageSize: data.pageSize || 20,
            orderStatus: data.orderStatus,
        });
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== تتبع الشحنة ====================
exports.cjGetTracking = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    if (!data.trackNumber)
        throw new functions.https.HttpsError("invalid-argument", "trackNumber مطلوب");
    try {
        return await cj.getTrackingInfo(data.trackNumber);
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== حساب الشحن ====================
exports.cjCalculateFreight = functions.https.onCall(async (data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    try {
        return await cj.calculateFreight({
            startCountryCode: data.startCountryCode || "CN",
            endCountryCode: data.endCountryCode || "SA",
            products: data.products,
        });
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== رصيد CJ ====================
exports.cjGetBalance = functions.https.onCall(async (_data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    try {
        return await cj.getCJBalance();
    }
    catch (error) {
        wrapError(error);
    }
});
// ==================== إرسال طلب تلقائي بعد الشراء ====================
exports.onOrderCreated = functions.firestore
    .document("orders/{orderId}")
    .onCreate(async (snap, context) => {
    const order = snap.data();
    const orderId = context.params.orderId;
    // التحقق من إعدادات CJ
    const settingsDoc = await admin
        .firestore()
        .doc("settings/cjDropshipping")
        .get();
    const settings = settingsDoc.data();
    if (!(settings === null || settings === void 0 ? void 0 : settings.apiKey) || !(settings === null || settings === void 0 ? void 0 : settings.autoForwardOrders)) {
        return; // لا يوجد إعداد CJ أو الإرسال التلقائي معطل
    }
    // البحث عن منتجات CJ في الطلب
    const cjItems = [];
    for (const item of order.items || []) {
        const productDoc = await admin
            .firestore()
            .doc(`products/${item.productId}`)
            .get();
        const product = productDoc.data();
        if ((product === null || product === void 0 ? void 0 : product.isCJProduct) && (product === null || product === void 0 ? void 0 : product.cjVariantId)) {
            cjItems.push({
                vid: product.cjVariantId,
                quantity: item.quantity,
            });
        }
    }
    if (cjItems.length === 0)
        return; // لا يوجد منتجات CJ
    // إنشاء الطلب في CJ
    try {
        const address = order.address || {};
        const cjOrderData = {
            orderNumber: `JAB-${orderId}`,
            shippingZip: "00000",
            shippingCountryCode: "SA",
            shippingCountry: "Saudi Arabia",
            shippingProvince: address.city || order.shippingAddress || "",
            shippingCity: address.city || "",
            shippingAddress: `${address.district || ""} ${address.street || ""} ${address.building || ""}`.trim(),
            shippingCustomerName: address.fullName || order.customer || "",
            shippingPhone: address.phone || order.phone || "",
            remark: order.notes || "",
            fromCountryCode: settings.defaultWarehouse || "CN",
            logisticName: settings.defaultLogistic || "CJPacket",
            products: cjItems,
        };
        const result = await cj.createCJOrder(cjOrderData);
        if (result.result && result.data) {
            await snap.ref.update({
                isCJOrder: true,
                cjOrderId: result.data.orderId || "",
                cjOrderNum: result.data.orderNum || "",
                cjOrderStatus: "CREATED",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`CJ order created for Firestore order ${orderId}`);
        }
        else {
            console.error(`CJ order creation failed for ${orderId}:`, result.message);
        }
    }
    catch (error) {
        console.error(`Error creating CJ order for ${orderId}:`, error);
    }
});
// ==================== مزامنة حالة الطلبات (يدوي) ====================
exports.cjSyncOrderStatuses = functions.https.onCall(async (_data, context) => {
    var _a;
    await verifyAdmin((_a = context.auth) !== null && _a !== void 0 ? _a : undefined);
    const db = admin.firestore();
    const ordersSnap = await db
        .collection("orders")
        .where("isCJOrder", "==", true)
        .where("status", "not-in", ["delivered", "cancelled"])
        .get();
    const results = [];
    for (const doc of ordersSnap.docs) {
        const order = doc.data();
        if (!order.cjOrderId)
            continue;
        try {
            const cjResult = await cj.queryCJOrder(order.cjOrderId);
            if (cjResult.result && cjResult.data) {
                const cjOrder = cjResult.data;
                const updates = {
                    cjOrderStatus: cjOrder.orderStatus,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                // تحديث رقم التتبع إذا متوفر
                if (cjOrder.trackNumber) {
                    updates.trackingNumber = cjOrder.trackNumber;
                }
                // تحويل حالة CJ إلى حالة المتجر
                const statusMap = {
                    CREATED: "processing",
                    IN_CART: "processing",
                    UNPAID: "processing",
                    UNSHIPPED: "processing",
                    SHIPPED: "shipped",
                    DELIVERED: "delivered",
                    CANCELLED: "cancelled",
                };
                if (statusMap[cjOrder.orderStatus]) {
                    updates.status = statusMap[cjOrder.orderStatus];
                }
                await doc.ref.update(updates);
                results.push({ orderId: doc.id, status: cjOrder.orderStatus });
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : "خطأ";
            results.push({ orderId: doc.id, status: "error", error: msg });
        }
    }
    return { synced: results.length, results };
});
//# sourceMappingURL=index.js.map