import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cj from "./cjClient";
import * as paypal from "./paypalClient";
import * as tamara from "./tamaraClient";
import { scrapeAmazonProduct, scrapeAmazonWithApi } from "./amazonScraper";

admin.initializeApp();

// التحقق من أن المستخدم أدمن
async function verifyAdmin(auth: { uid: string } | undefined): Promise<void> {
  if (!auth)
    throw new functions.https.HttpsError("unauthenticated", "يجب تسجيل الدخول");
  const userDoc = await admin.firestore().doc(`users/${auth.uid}`).get();
  const userData = userDoc.data();
  if (!userData || userData.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "صلاحية الأدمن مطلوبة",
    );
  }
}

// ==================== اختبار الاتصال ====================
export const cjTestConnection = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);
    const { email, apiKey } = data;
    if (!email)
      throw new functions.https.HttpsError("invalid-argument", "بريد CJ مطلوب");
    if (!apiKey)
      throw new functions.https.HttpsError(
        "invalid-argument",
        "مفتاح API مطلوب",
      );
    return cj.testConnection(email, apiKey);
  },
);

// تحويل الأخطاء العادية إلى HttpsError
function wrapError(error: unknown): never {
  if (error instanceof functions.https.HttpsError) throw error;
  const msg = error instanceof Error ? error.message : "خطأ غير متوقع";
  if (msg.includes("API Key غير مُعد") || msg.includes("غير مُعد")) {
    throw new functions.https.HttpsError("failed-precondition", msg);
  }
  throw new functions.https.HttpsError("internal", msg);
}

// ==================== البحث عن منتجات ====================
export const cjSearchProducts = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);
    try {
      const result = await cj.searchProducts({
        productNameEn: data.keyword,
        categoryId: data.categoryId,
        pageNum: data.pageNum || 1,
        pageSize: data.pageSize || 20,
      });
      // Log first product image for debugging
      const res = result as any;
      if (res?.data?.list?.[0]) {
        const s = res.data.list[0];
        console.log("CJ productImage:", s.productImage);
      }
      return result;
    } catch (error) {
      wrapError(error);
    }
  },
);

// ==================== تفاصيل منتج ====================
export const cjGetProductDetail = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);
    if (!data.pid)
      throw new functions.https.HttpsError("invalid-argument", "pid مطلوب");
    try {
      return await cj.getProductDetail(data.pid);
    } catch (error) {
      wrapError(error);
    }
  },
);

// ==================== متغيرات المنتج ====================
export const cjGetProductVariants = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);
    if (!data.pid)
      throw new functions.https.HttpsError("invalid-argument", "pid مطلوب");
    try {
      return await cj.getProductVariants(data.pid);
    } catch (error) {
      wrapError(error);
    }
  },
);

// ==================== مخزون المنتج ====================
export const cjGetProductInventory = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);
    if (!data.vid)
      throw new functions.https.HttpsError("invalid-argument", "vid مطلوب");
    try {
      return await cj.getProductInventory(data.vid);
    } catch (error) {
      wrapError(error);
    }
  },
);

// ==================== تصنيفات CJ ====================
export const cjGetCategories = functions.https.onCall(
  async (_data, context) => {
    await verifyAdmin(context.auth ?? undefined);
    try {
      return await cj.getCJCategories();
    } catch (error) {
      wrapError(error);
    }
  },
);

// ==================== إنشاء طلب CJ ====================
export const cjCreateOrder = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context.auth ?? undefined);

  const { firestoreOrderId, orderData } = data;
  if (!orderData)
    throw new functions.https.HttpsError("invalid-argument", "orderData مطلوب");

  try {
    const result: any = await cj.createCJOrder(orderData);

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
  } catch (error) {
    wrapError(error);
  }
});

// ==================== تأكيد طلب CJ ====================
export const cjConfirmOrder = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context.auth ?? undefined);
  if (!data.orderId)
    throw new functions.https.HttpsError("invalid-argument", "orderId مطلوب");
  try {
    return await cj.confirmCJOrder(data.orderId);
  } catch (error) {
    wrapError(error);
  }
});

// ==================== قائمة طلبات CJ ====================
export const cjListOrders = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context.auth ?? undefined);
  try {
    return await cj.listCJOrders({
      pageNum: data.pageNum || 1,
      pageSize: data.pageSize || 20,
      orderStatus: data.orderStatus,
    });
  } catch (error) {
    wrapError(error);
  }
});

// ==================== تتبع الشحنة ====================
export const cjGetTracking = functions.https.onCall(async (data, context) => {
  await verifyAdmin(context.auth ?? undefined);
  if (!data.trackNumber)
    throw new functions.https.HttpsError(
      "invalid-argument",
      "trackNumber مطلوب",
    );
  try {
    return await cj.getTrackingInfo(data.trackNumber);
  } catch (error) {
    wrapError(error);
  }
});

// ==================== حساب الشحن ====================
export const cjCalculateFreight = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);
    try {
      return await cj.calculateFreight({
        startCountryCode: data.startCountryCode || "CN",
        endCountryCode: data.endCountryCode || "SA",
        products: data.products,
      });
    } catch (error) {
      wrapError(error);
    }
  },
);

// ==================== رصيد CJ ====================
export const cjGetBalance = functions.https.onCall(async (_data, context) => {
  await verifyAdmin(context.auth ?? undefined);
  try {
    return await cj.getCJBalance();
  } catch (error) {
    wrapError(error);
  }
});

// ==================== إرسال طلب تلقائي بعد الشراء ====================
export const onOrderCreated = functions.firestore
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

    if (!settings?.apiKey || !settings?.autoForwardOrders) {
      return; // لا يوجد إعداد CJ أو الإرسال التلقائي معطل
    }

    // البحث عن منتجات CJ في الطلب
    const cjItems: { vid: string; quantity: number }[] = [];
    for (const item of order.items || []) {
      const productDoc = await admin
        .firestore()
        .doc(`products/${item.productId}`)
        .get();
      const product = productDoc.data();
      if (product?.isCJProduct && product?.cjVariantId) {
        cjItems.push({
          vid: product.cjVariantId,
          quantity: item.quantity,
        });
      }
    }

    if (cjItems.length === 0) return; // لا يوجد منتجات CJ

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
        shippingAddress:
          `${address.district || ""} ${address.street || ""} ${address.building || ""}`.trim(),
        shippingCustomerName: address.fullName || order.customer || "",
        shippingPhone: address.phone || order.phone || "",
        remark: order.notes || "",
        fromCountryCode: settings.defaultWarehouse || "CN",
        logisticName: settings.defaultLogistic || "CJPacket",
        products: cjItems,
      };

      const result: any = await cj.createCJOrder(cjOrderData);

      if (result.result && result.data) {
        await snap.ref.update({
          isCJOrder: true,
          cjOrderId: result.data.orderId || "",
          cjOrderNum: result.data.orderNum || "",
          cjOrderStatus: "CREATED",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`CJ order created for Firestore order ${orderId}`);
      } else {
        console.error(
          `CJ order creation failed for ${orderId}:`,
          result.message,
        );
      }
    } catch (error) {
      console.error(`Error creating CJ order for ${orderId}:`, error);
    }
  });

// ==================== مزامنة حالة الطلبات (يدوي) ====================
export const cjSyncOrderStatuses = functions.https.onCall(
  async (_data, context) => {
    await verifyAdmin(context.auth ?? undefined);

    const db = admin.firestore();
    const ordersSnap = await db
      .collection("orders")
      .where("isCJOrder", "==", true)
      .where("status", "not-in", ["delivered", "cancelled"])
      .get();

    const results: { orderId: string; status: string; error?: string }[] = [];

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      if (!order.cjOrderId) continue;

      try {
        const cjResult: any = await cj.queryCJOrder(order.cjOrderId);
        if (cjResult.result && cjResult.data) {
          const cjOrder = cjResult.data;
          const updates: Record<string, unknown> = {
            cjOrderStatus: cjOrder.orderStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          // تحديث رقم التتبع إذا متوفر
          if (cjOrder.trackNumber) {
            updates.trackingNumber = cjOrder.trackNumber;
          }

          // تحويل حالة CJ إلى حالة المتجر
          const statusMap: Record<string, string> = {
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
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "خطأ";
        results.push({ orderId: doc.id, status: "error", error: msg });
      }
    }

    return { synced: results.length, results };
  },
);

// ==================== بروكسي صور CJ ====================
export const cjImageProxy = functions.https.onRequest(async (req, res) => {
  // Allow CORS preflight
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const url = req.query.url as string;

  // Allow CJ Dropshipping image domains
  const allowedDomains = [
    "cf.cjdropshipping.com",
    "cbu01.alicdn.com",
    "cjdropshipping.com",
    "img.cjdropshipping.com",
    "image.cjdropshipping.com",
    "assets.cjdropshipping.com",
    "alicdn.com",
  ];

  const isAllowed = allowedDomains.some((domain) =>
    url?.includes(domain)
  );

  if (!url || typeof url !== "string" || !isAllowed) {
    res.status(400).send("Invalid URL");
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).send("Image fetch failed");
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=604800"); // 7 days
    res.set("Access-Control-Allow-Origin", "*");
    res.send(buffer);
  } catch {
    res.status(500).send("Proxy error");
  }
});

// ==================== PayPal - إنشاء طلب دفع ====================
export const paypalCreateOrder = functions.https.onCall(
  async (data, context) => {
    // التحقق من تسجيل الدخول
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "يجب تسجيل الدخول لإتمام الدفع"
      );
    }

    const { amount, currency, orderId, description } = data;

    if (!amount || amount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "المبلغ غير صحيح"
      );
    }

    if (!orderId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف الطلب مطلوب"
      );
    }

    try {
      const result = await paypal.createOrder({
        amount: parseFloat(amount),
        currency: currency || "SAR",
        orderId,
        description: description || `طلب من جبوري للإلكترونيات #${orderId}`,
      });

      // حفظ معرف PayPal في الطلب المؤقت
      await admin.firestore().doc(`pending_payments/${orderId}`).set({
        userId: context.auth.uid,
        paypalOrderId: result.id,
        amount,
        currency: currency || "SAR",
        status: "CREATED",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return result;
    } catch (error) {
      console.error("PayPal create order error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في إنشاء طلب الدفع";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== PayPal - تأكيد الدفع ====================
export const paypalCaptureOrder = functions.https.onCall(
  async (data, context) => {
    // التحقق من تسجيل الدخول
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "يجب تسجيل الدخول لإتمام الدفع"
      );
    }

    const { paypalOrderId, firestoreOrderId } = data;

    if (!paypalOrderId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف طلب PayPal مطلوب"
      );
    }

    try {
      const result = await paypal.captureOrder(paypalOrderId);

      // تحديث حالة الدفع المعلق
      const pendingRef = admin.firestore().collection("pending_payments");
      const pendingSnap = await pendingRef
        .where("paypalOrderId", "==", paypalOrderId)
        .where("userId", "==", context.auth.uid)
        .limit(1)
        .get();

      if (!pendingSnap.empty) {
        await pendingSnap.docs[0].ref.update({
          status: result.status,
          captureId: result.captureId,
          capturedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // تحديث الطلب في Firestore إذا موجود
      if (firestoreOrderId) {
        await admin.firestore().doc(`orders/${firestoreOrderId}`).update({
          paymentStatus: "paid",
          paypalOrderId: paypalOrderId,
          paypalCaptureId: result.captureId,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return result;
    } catch (error) {
      console.error("PayPal capture error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في تأكيد الدفع";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== PayPal - التحقق من حالة الطلب ====================
export const paypalGetOrderStatus = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "يجب تسجيل الدخول"
      );
    }

    const { paypalOrderId } = data;

    if (!paypalOrderId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف طلب PayPal مطلوب"
      );
    }

    try {
      const result = await paypal.getOrderDetails(paypalOrderId);
      return {
        id: result.id,
        status: result.status,
        amount: result.purchase_units?.[0]?.amount?.value,
        currency: result.purchase_units?.[0]?.amount?.currency_code,
      };
    } catch (error) {
      console.error("PayPal get order error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في جلب حالة الطلب";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== Tamara - إعداد مفتاح API ====================
async function initTamaraToken(): Promise<void> {
  // أولاً: التحقق من Firestore
  const settingsDoc = await admin.firestore().doc("settings/tamara").get();
  const settings = settingsDoc.data();
  if (settings?.apiToken) {
    tamara.setApiToken(settings.apiToken);
    return;
  }

  // ثانياً: التحقق من متغير البيئة
  const envToken = process.env.TAMARA_API_TOKEN;
  if (envToken) {
    tamara.setApiToken(envToken);
    return;
  }

  throw new functions.https.HttpsError(
    "failed-precondition",
    "مفتاح Tamara API غير مُعد. يرجى إعداده في الإعدادات."
  );
}

// ==================== Tamara - إنشاء جلسة دفع ====================
export const tamaraCreateCheckout = functions.https.onCall(
  async (data, context) => {
    // التحقق من تسجيل الدخول
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "يجب تسجيل الدخول لإتمام الدفع"
      );
    }

    const {
      orderReferenceId,
      totalAmount,
      currency,
      items,
      consumer,
      shippingAddress,
      shippingAmount,
      successUrl,
      failureUrl,
      cancelUrl,
      description,
    } = data;

    if (!totalAmount || totalAmount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "المبلغ غير صحيح"
      );
    }

    if (!orderReferenceId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف الطلب مطلوب"
      );
    }

    if (!items || items.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "عناصر الطلب مطلوبة"
      );
    }

    try {
      await initTamaraToken();

      const result = await tamara.createCheckoutSession({
        order_reference_id: orderReferenceId,
        total_amount: totalAmount,
        currency: currency || "SAR",
        items,
        consumer,
        shipping_address: shippingAddress,
        shipping_amount: shippingAmount || 0,
        success_url: successUrl,
        failure_url: failureUrl,
        cancel_url: cancelUrl,
        description,
      });

      // حفظ معلومات الدفع المعلق
      await admin.firestore().doc(`pending_payments/${orderReferenceId}`).set({
        userId: context.auth.uid,
        paymentMethod: "tamara",
        tamaraCheckoutId: result.checkout_id,
        tamaraCheckoutUrl: result.checkout_url,
        totalAmount,
        currency: currency || "SAR",
        status: "CREATED",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return result;
    } catch (error) {
      console.error("Tamara create checkout error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في إنشاء جلسة الدفع";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== Tamara - التحقق من حالة الدفع ====================
export const tamaraGetPaymentStatus = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "يجب تسجيل الدخول"
      );
    }

    const { checkoutId } = data;

    if (!checkoutId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف جلسة الدفع مطلوب"
      );
    }

    try {
      await initTamaraToken();
      const result = await tamara.getPaymentStatus(checkoutId);
      return result;
    } catch (error) {
      console.error("Tamara get payment status error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في جلب حالة الدفع";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== Tamara - تأكيد الطلب (Authorize) ====================
export const tamaraAuthorizeOrder = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "يجب تسجيل الدخول"
      );
    }

    const { orderId, firestoreOrderId } = data;

    if (!orderId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف طلب Tamara مطلوب"
      );
    }

    try {
      await initTamaraToken();
      const result = await tamara.authorizeOrder(orderId);

      // تحديث الطلب في Firestore
      if (firestoreOrderId) {
        await admin.firestore().doc(`orders/${firestoreOrderId}`).update({
          paymentStatus: "paid",
          tamaraOrderId: orderId,
          tamaraStatus: result.status,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return result;
    } catch (error) {
      console.error("Tamara authorize error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في تأكيد الطلب";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== Tamara - حفظ إعدادات API ====================
export const tamaraSaveSettings = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);

    const { apiToken } = data;

    if (!apiToken) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "مفتاح API مطلوب"
      );
    }

    try {
      await admin.firestore().doc("settings/tamara").set({
        apiToken,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth!.uid,
      });

      return { success: true, message: "تم حفظ إعدادات Tamara بنجاح" };
    } catch (error) {
      console.error("Tamara save settings error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في حفظ الإعدادات";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== Tamara - اختبار الاتصال ====================
export const tamaraTestConnection = functions.https.onCall(
  async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);

    const { apiToken } = data;

    if (!apiToken) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "مفتاح API مطلوب للاختبار"
      );
    }

    try {
      // تعيين المفتاح مؤقتاً للاختبار
      tamara.setApiToken(apiToken);

      // محاولة التحقق من أهلية عميل وهمي
      const result = await tamara.checkCustomerEligibility(
        "+966500000000",
        100,
        "SAR"
      );

      return {
        success: true,
        message: "تم الاتصال بـ Tamara بنجاح",
        data: result,
      };
    } catch (error) {
      console.error("Tamara test connection error:", error);
      const msg = error instanceof Error ? error.message : "فشل الاتصال بـ Tamara";
      throw new functions.https.HttpsError("internal", msg);
    }
  }
);

// ==================== Product Scraper (Server-Side) ====================

interface ScrapedProduct {
  name: string;
  nameEn: string;
  description: string;
  price: number;
  oldPrice?: number;
  images: string[];
  supplierUrl: string;
  supplierName: string;
  supplierPrice?: number;
  specs?: Record<string, string>;
}

// Browser-like headers for scraping
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

function getSiteName(url: string): string {
  const domain = new URL(url).hostname.toLowerCase();
  if (domain.includes("amazon")) return "Amazon";
  if (domain.includes("aliexpress")) return "AliExpress";
  if (domain.includes("shein")) return "SHEIN";
  if (domain.includes("noon")) return "Noon";
  if (domain.includes("temu")) return "Temu";
  if (domain.includes("ebay")) return "eBay";
  if (domain.includes("alibaba") || domain.includes("1688")) return "Alibaba";
  return domain.replace("www.", "");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function parseMetaTag(html: string, property: string): string {
  const r1 = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const m1 = html.match(r1);
  if (m1) return decodeHtmlEntities(m1[1]);
  const r2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );
  const m2 = html.match(r2);
  return m2 ? decodeHtmlEntities(m2[1]) : "";
}

function parseJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1]));
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findProductInJsonLd(items: unknown[]): any | null {
  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = item as any;
    if (obj?.["@type"] === "Product") return obj;
    if (Array.isArray(obj?.["@graph"])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found = obj["@graph"].find((g: any) => g?.["@type"] === "Product");
      if (found) return found;
    }
  }
  return null;
}

function amazonFullResUrl(url: string): string {
  if (!url) return "";
  return url.replace(/\._[^.]+_\./, "._AC_SL1500_.");
}

function parseAmazon(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: url,
    supplierName: "Amazon",
    specs: {},
  };

  // Detect Amazon regional domain
  try {
    const domain = new URL(url).hostname;
    if (domain.includes(".sa")) product.supplierName = "Amazon.sa";
    else if (domain.includes(".ae")) product.supplierName = "Amazon.ae";
    else if (domain.includes(".co.uk")) product.supplierName = "Amazon.co.uk";
    else if (domain.includes(".de")) product.supplierName = "Amazon.de";
    else if (domain.includes(".eg")) product.supplierName = "Amazon.eg";
  } catch {
    /* keep default */
  }

  // 1) JSON-LD structured data (most reliable)
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    product.nameEn = jsonLd.name || "";
    product.description = jsonLd.description || "";
    if (jsonLd.image) {
      product.images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
    }
    if (jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      product.price = parseFloat(offer?.price) || parseFloat(offer?.lowPrice) || 0;
      product.supplierPrice = product.price;
      if (offer?.highPrice) product.oldPrice = parseFloat(offer.highPrice);
    }
  }

  // 2) Product title from multiple patterns
  if (!product.nameEn) {
    const titlePatterns = [
      /<span[^>]*id=["']productTitle["'][^>]*>\s*([^<]+)/i,
      /<h1[^>]*id=["']title["'][^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)/i,
      /<span[^>]*class=["'][^"']*product-title[^"']*["'][^>]*>\s*([^<]+)/i,
      /"title"\s*:\s*"([^"]{10,300})"/,
    ];
    for (const p of titlePatterns) {
      const m = html.match(p);
      if (m) {
        const title = decodeHtmlEntities(m[1].trim());
        if (title && title.length > 5) {
          product.nameEn = title;
          break;
        }
      }
    }
  }

  // 3) Price extraction
  if (!product.price) {
    const pricePatterns = [
      /class=["']apexPriceToPay["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>([^<]+)/i,
      /"priceAmount"\s*:\s*"?([\d,.]+)"?/,
      /class=["']a-price[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>([^<]+)/i,
      /class=["']a-price-whole["'][^>]*>([\d,]+)[\s\S]*?class=["']a-price-fraction["'][^>]*>(\d+)/i,
      /id=["']priceblock_dealprice["'][^>]*>([^<]+)/i,
      /id=["']priceblock_ourprice["'][^>]*>([^<]+)/i,
      /id=["']priceblock_saleprice["'][^>]*>([^<]+)/i,
      /"price"\s*:\s*"?([\d,.]+)"?\s*[,}]/,
      /(?:SAR|AED|USD|EUR|GBP|EGP)\s*([\d,.]+)/,
      /(?:ر\.س|د\.إ|جنيه)\s*([\d,.]+)/i,
    ];
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        let priceStr = m[1];
        if (m[2]) priceStr = m[1] + "." + m[2];
        const numMatch = priceStr.replace(/[^\d.,]/g, "").replace(/,/g, "");
        const val = parseFloat(numMatch);
        if (val > 0) {
          product.price = val;
          product.supplierPrice = val;
          break;
        }
      }
    }
  }

  // Old / list price
  if (product.price && !product.oldPrice) {
    const oldPricePatterns = [
      /class=["']a-text-price["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>([^<]+)/i,
      /class=["']basisPrice["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>([^<]+)/i,
      /id=["']listPrice["'][^>]*>([^<]+)/i,
    ];
    for (const p of oldPricePatterns) {
      const m = html.match(p);
      if (m) {
        const numMatch = m[1].replace(/[^\d.,]/g, "").replace(/,/g, "");
        const val = parseFloat(numMatch);
        if (val > product.price) {
          product.oldPrice = val;
          break;
        }
      }
    }
  }

  // 4) Images from colorImages JS
  if (product.images.length === 0) {
    const imgPatterns = [
      /'colorImages':\s*\{[^}]*'initial'\s*:\s*(\[[\s\S]*?\])\s*\}/,
      /"colorImages"\s*:\s*\{[^}]*"initial"\s*:\s*(\[[\s\S]*?\])\s*\}/,
      /"imageGalleryData"\s*:\s*(\[[\s\S]*?\])/,
    ];
    for (const p of imgPatterns) {
      const m = html.match(p);
      if (m) {
        try {
          const arr = JSON.parse(m[1].replace(/'/g, '"'));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const urls = arr
            .map((i: any) => amazonFullResUrl(i.hiRes || i.large || i.mainUrl || i.thumb || ""))
            .filter(Boolean);
          if (urls.length > 0) {
            product.images = urls.slice(0, 10);
            break;
          }
        } catch {
          /* continue */
        }
      }
    }
  }

  // Fallback: landingImage
  if (product.images.length === 0) {
    const mainImgPatterns = [
      /<img[^>]*id=["']landingImage["'][^>]*src=["']([^"']+)["']/i,
      /<img[^>]*id=["']imgBlkFront["'][^>]*src=["']([^"']+)["']/i,
      /<img[^>]*data-old-hires=["']([^"']+)["']/i,
    ];
    for (const p of mainImgPatterns) {
      const m = html.match(p);
      if (m) {
        const imgUrl = amazonFullResUrl(m[1]);
        if (imgUrl) {
          product.images.push(imgUrl);
          break;
        }
      }
    }
  }

  // Amazon media CDN URLs
  if (product.images.length === 0) {
    const amazonImgRegex = /["'](https?:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s]+\.(?:jpg|jpeg|png|webp))[^"']*/gi;
    let m;
    const seen = new Set<string>();
    while ((m = amazonImgRegex.exec(html)) !== null) {
      const imgUrl = amazonFullResUrl(m[1]);
      if (imgUrl && !seen.has(imgUrl)) {
        seen.add(imgUrl);
        product.images.push(imgUrl);
      }
      if (product.images.length >= 10) break;
    }
  }

  // 5) OG tags fallback
  if (!product.nameEn) product.nameEn = parseMetaTag(html, "og:title").replace(/\s*:\s*Amazon.*$/i, "").trim();
  if (!product.description) product.description = parseMetaTag(html, "og:description");
  if (product.images.length === 0) {
    const ogImage = parseMetaTag(html, "og:image");
    if (ogImage) product.images = [ogImage];
  }

  // 6) Description from feature bullets
  if (!product.description) {
    const bulletMatches = html.match(/<span[^>]*class=["']a-list-item["'][^>]*>\s*([^<]{10,})/gi);
    if (bulletMatches) {
      product.description = bulletMatches
        .slice(0, 5)
        .map((b) => b.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean)
        .join(" • ");
    }
  }

  // 7) Extract specs/features
  const specsMatch = html.match(/<table[^>]*id=["']productDetails[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  if (specsMatch) {
    const specRows = specsMatch[1].matchAll(/<tr[^>]*>[\s\S]*?<th[^>]*>([^<]+)<\/th>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi);
    for (const row of specRows) {
      if (row[1] && row[2]) {
        const key = decodeHtmlEntities(row[1].trim());
        const value = decodeHtmlEntities(row[2].trim());
        if (key && value && product.specs) {
          product.specs[key] = value;
        }
      }
    }
  }

  product.name = product.nameEn;
  return product;
}

function parseGeneric(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: url,
    supplierName: getSiteName(url),
  };

  // 1) JSON-LD
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    product.nameEn = jsonLd.name || "";
    product.description = jsonLd.description || "";
    if (jsonLd.image) {
      product.images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
    }
    if (jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      product.price = parseFloat(offer?.price) || parseFloat(offer?.lowPrice) || 0;
      product.supplierPrice = product.price;
    }
  }

  // 2) OG tags fallback
  if (!product.nameEn) product.nameEn = parseMetaTag(html, "og:title");
  if (!product.description) product.description = parseMetaTag(html, "og:description");
  if (product.images.length === 0) {
    const ogImage = parseMetaTag(html, "og:image");
    if (ogImage) product.images = [ogImage];
  }
  if (!product.price) {
    const priceStr = parseMetaTag(html, "product:price:amount");
    product.price = parseFloat(priceStr) || 0;
    product.supplierPrice = product.price;
  }

  // 3) Title tag fallback
  if (!product.nameEn) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) product.nameEn = titleMatch[1].trim();
  }

  product.name = product.nameEn;
  return product;
}

export const scrapeProductFromUrl = functions
  .runWith({ timeoutSeconds: 120, memory: "1GB" })
  .https.onCall(async (data, context) => {
    await verifyAdmin(context.auth ?? undefined);

    const { url } = data;

    if (!url) {
      throw new functions.https.HttpsError("invalid-argument", "رابط المنتج مطلوب");
    }

    try {
      console.log("[Scraper] Fetching URL:", url);

      const siteName = getSiteName(url);
      
      // استخدام السكرابر الاحترافي للأمازون
      if (siteName.includes("Amazon")) {
        console.log("[Scraper] Using professional Amazon scraper...");
        
        // محاولة أولى: السكرابر المحلي
        let result = await scrapeAmazonProduct(url);
        
        // إذا فشل، حاول مع ScraperAPI
        if (!result.name && !result.nameEn) {
          console.log("[Scraper] Local scraper failed, trying ScraperAPI...");
          const scraperApiKey = process.env.SCRAPER_API_KEY;
          if (scraperApiKey) {
            result = await scrapeAmazonWithApi(url, scraperApiKey);
          }
        }
        
        if (!result.name && !result.nameEn) {
          throw new Error("لم يتم العثور على بيانات المنتج من أمازون. قد يكون الرابط خاطئ أو المنتج غير متاح.");
        }
        
        console.log("[Scraper] Amazon Result:", {
          name: result.name?.substring(0, 50),
          price: result.price,
          images: result.images.length,
          brand: result.brand,
          asin: result.asin,
        });
        
        return result;
      }

      // للمواقع الأخرى، استخدم السكرابر العام
      const response = await fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log("[Scraper] Received HTML length:", html.length);

      if (html.length < 500) {
        throw new Error("الصفحة رجعت محتوى فارغ أو قصير جداً");
      }

      // Check for captcha/bot detection
      if (
        html.includes("captcha") ||
        html.includes("robot") ||
        html.includes("automated access")
      ) {
        console.log("[Scraper] Captcha/bot detection detected");
        throw new Error("الموقع يطلب التحقق البشري (Captcha). حاول لاحقاً.");
      }

      const result = parseGeneric(html, url);

      if (!result.name && !result.nameEn) {
        throw new Error(`لم يتم العثور على بيانات منتج من ${siteName}. الموقع قد يحظر الوصول التلقائي.`);
      }

      console.log("[Scraper] Result:", {
        name: result.name?.substring(0, 50),
        price: result.price,
        images: result.images.length,
        supplier: result.supplierName,
      });

      return result;
    } catch (error) {
      console.error("[Scraper] Error:", error);
      const msg = error instanceof Error ? error.message : "خطأ في جلب بيانات المنتج";
      throw new functions.https.HttpsError("internal", msg);
    }
  });
