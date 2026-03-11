import fetch from "node-fetch";
import * as admin from "firebase-admin";

const CJ_BASE_URL = "https://developers.cjdropshipping.com/api2.0/v1";

interface CJTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiryDate: string;
  refreshTokenExpiryDate: string;
}

// الحصول على التوكن من Firestore أو إنشاء واحد جديد
async function getValidAccessToken(): Promise<string> {
  const db = admin.firestore();
  const settingsDoc = await db.doc("settings/cjDropshipping").get();
  const settings = settingsDoc.data();

  if (!settings?.email || !settings?.apiKey) {
    throw new Error(
      "بيانات CJ غير مُعدة. يرجى إدخال البريد ومفتاح API في إعدادات CJ.",
    );
  }

  // التحقق من صلاحية التوكن الحالي
  if (settings.accessToken && settings.tokenExpiresAt) {
    const expiryDate = settings.tokenExpiresAt.toDate
      ? settings.tokenExpiresAt.toDate()
      : new Date(settings.tokenExpiresAt);
    if (expiryDate > new Date()) {
      return settings.accessToken;
    }
  }

  // محاولة تجديد التوكن
  if (settings.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(settings.refreshToken);
      await db.doc("settings/cjDropshipping").update({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        tokenExpiresAt: new Date(refreshed.accessTokenExpiryDate),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return refreshed.accessToken;
    } catch {
      // فشل التجديد، نحصل على توكن جديد
    }
  }

  // الحصول على توكن جديد
  const tokens = await getNewAccessToken(settings.email, settings.apiKey);
  await db.doc("settings/cjDropshipping").update({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: new Date(tokens.accessTokenExpiryDate),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return tokens.accessToken;
}

// الحصول على توكن جديد من CJ باستخدام البريد ومفتاح API
async function getNewAccessToken(
  email: string,
  password: string,
): Promise<CJTokens> {
  console.log("CJ Auth: requesting new access token with email:", email);

  const response = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  console.log(
    "CJ Auth response:",
    JSON.stringify({
      result: data.result,
      code: data.code,
      message: data.message,
      hasData: !!data.data,
    }),
  );
  if (!data.result || data.code !== 200) {
    throw new Error(
      `فشل الحصول على توكن CJ: ${data.message || "خطأ غير معروف"} (code: ${data.code})`,
    );
  }
  return data.data;
}

// تجديد التوكن
async function refreshAccessToken(refreshToken: string): Promise<CJTokens> {
  const response = await fetch(
    `${CJ_BASE_URL}/authentication/refreshAccessToken`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    },
  );

  const data = await response.json();
  if (!data.result || data.code !== 200) {
    throw new Error("فشل تجديد توكن CJ");
  }
  return data.data;
}

// طلب عام مع التوكن
async function cjRequest(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>,
): Promise<unknown> {
  const token = await getValidAccessToken();

  let url = `${CJ_BASE_URL}${endpoint}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": token,
    },
  };

  if (body && (method === "POST" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();
  return data;
}

// ==================== Products ====================

export async function searchProducts(params: {
  categoryKeyword?: string;
  pageNum?: number;
  pageSize?: number;
  productNameEn?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<unknown> {
  return cjRequest("/product/list", "GET", undefined, {
    pageNum: String(params.pageNum || 1),
    pageSize: String(params.pageSize || 20),
    ...(params.productNameEn && { productNameEn: params.productNameEn }),
    ...(params.categoryKeyword && { categoryKeyword: params.categoryKeyword }),
    ...(params.categoryId && { categoryId: params.categoryId }),
  });
}

export async function getProductDetail(pid: string): Promise<unknown> {
  return cjRequest("/product/query", "GET", undefined, { pid });
}

export async function getProductVariants(pid: string): Promise<unknown> {
  return cjRequest("/product/variant/query", "GET", undefined, { pid });
}

export async function getProductInventory(vid: string): Promise<unknown> {
  return cjRequest("/product/stock/queryByVid", "GET", undefined, { vid });
}

export async function getCJCategories(): Promise<unknown> {
  return cjRequest("/product/getCategory", "GET");
}

// ==================== Orders ====================

export async function createCJOrder(orderData: {
  orderNumber: string;
  shippingZip: string;
  shippingCountryCode: string;
  shippingCountry: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string;
  shippingCustomerName: string;
  shippingPhone: string;
  remark: string;
  fromCountryCode: string;
  logisticName: string;
  products: { vid: string; quantity: number }[];
}): Promise<unknown> {
  return cjRequest("/shopping/order/createOrderV2", "POST", {
    ...orderData,
    payType: 2, // Balance payment
  });
}

export async function confirmCJOrder(orderId: string): Promise<unknown> {
  return cjRequest("/shopping/order/confirmOrder", "PATCH", { orderId });
}

export async function listCJOrders(params: {
  pageNum?: number;
  pageSize?: number;
  orderStatus?: string;
}): Promise<unknown> {
  return cjRequest("/shopping/order/list", "GET", undefined, {
    pageNum: String(params.pageNum || 1),
    pageSize: String(params.pageSize || 20),
    ...(params.orderStatus && { orderStatus: params.orderStatus }),
  });
}

export async function queryCJOrder(orderId: string): Promise<unknown> {
  return cjRequest("/shopping/order/getOrderDetail", "GET", undefined, {
    orderId,
  });
}

// ==================== Logistics ====================

export async function calculateFreight(params: {
  startCountryCode: string;
  endCountryCode: string;
  products: { vid: string; quantity: number }[];
}): Promise<unknown> {
  return cjRequest("/logistic/freightCalculate", "POST", params);
}

export async function getTrackingInfo(trackNumber: string): Promise<unknown> {
  return cjRequest("/logistic/getTrackInfo", "GET", undefined, { trackNumber });
}

// ==================== Payment ====================

export async function getCJBalance(): Promise<unknown> {
  return cjRequest("/shopping/pay/getBalance", "GET");
}

// ==================== Test Connection ====================

export async function testConnection(
  email: string,
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  try {
    console.log("Testing CJ connection with email:", email);
    const tokens = await getNewAccessToken(email, apiKey);
    if (tokens.accessToken) {
      // حفظ التوكن في Firestore بعد النجاح
      const db = admin.firestore();
      await db.doc("settings/cjDropshipping").set(
        {
          email,
          ...(apiKey && { apiKey }),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt: new Date(tokens.accessTokenExpiryDate),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      console.log("CJ connection test SUCCESS - tokens saved to Firestore");
      return { success: true, message: "تم الاتصال بنجاح مع CJ Dropshipping!" };
    }
    console.log("CJ connection test FAILED - no access token in response");
    return { success: false, message: "فشل الاتصال - لم يتم استلام توكن" };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ غير متوقع";
    console.error("CJ connection test ERROR:", msg);
    return { success: false, message: msg };
  }
}
