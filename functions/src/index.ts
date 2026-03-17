import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as cj from "./cjClient";

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
  const url = req.query.url as string;

  if (
    !url ||
    typeof url !== "string" ||
    !url.startsWith("https://cf.cjdropshipping.com/")
  ) {
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
