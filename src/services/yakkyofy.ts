import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import app from "../config/firebase";
import { db } from "../config/firebase";

const functions = getFunctions(app);

// ==================== أنواع ====================

export interface YakkyofySettings {
  email: string;
  apiKey: string;
  defaultMarkup: number;
  usdToSar: number;
  autoForwardOrders: boolean;
}

export interface YakkyofyProduct {
  id: number | string;
  name: string;
  image?: string;
  images?: string[];
  price?: number;
  sale_price?: number;
  category?: string;
  sku?: string;
  description?: string;
  variants?: YakkyofyVariant[];
  weight?: number;
  stock?: number;
}

export interface YakkyofyVariant {
  id: number | string;
  name?: string;
  sku?: string;
  price?: number;
  weight?: number;
  image?: string;
  options?: Record<string, string>;
}

// ==================== الإعدادات ====================

export async function loadYakkyofySettings(): Promise<YakkyofySettings | null> {
  try {
    const snap = await getDoc(doc(db, "settings", "yakkyofy"));
    if (!snap.exists()) return null;
    return snap.data() as YakkyofySettings;
  } catch {
    return null;
  }
}

export async function saveYakkyofySettings(
  settings: Partial<YakkyofySettings>,
): Promise<void> {
  await setDoc(
    doc(db, "settings", "yakkyofy"),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ==================== اختبار الاتصال ====================

export async function testYakkyofyConnection(
  email: string,
  apiKey: string,
): Promise<{ success: boolean; message: string }> {
  const fn = httpsCallable(functions, "yakkyofyTestConnection");
  const result = await fn({ email, apiKey });
  return result.data as { success: boolean; message: string };
}

// ==================== المنتجات ====================

export async function searchYakkyofyProducts(params: {
  keyword?: string;
  category?: string;
  page?: number;
  per_page?: number;
}): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofySearchProducts");
  const result = await fn({
    keyword: params.keyword,
    category: params.category,
    page: params.page || 1,
    per_page: params.per_page || 20,
  });
  return result.data;
}

export async function getYakkyofyProductDetail(
  productId: string,
): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyGetProductDetail");
  const result = await fn({ productId });
  return result.data;
}

export async function getYakkyofyProductVariants(
  productId: string,
): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyGetProductVariants");
  const result = await fn({ productId });
  return result.data;
}

export async function getYakkyofyCategories(): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyGetCategories");
  const result = await fn({});
  return result.data;
}

// ==================== الطلبات ====================

export async function createYakkyofyOrder(
  firestoreOrderId: string,
  orderData: object,
): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyCreateOrder");
  const result = await fn({ firestoreOrderId, orderData });
  return result.data;
}

export async function getYakkyofyOrder(orderId: string): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyGetOrder");
  const result = await fn({ orderId });
  return result.data;
}

export async function listYakkyofyOrders(params: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyListOrders");
  const result = await fn(params);
  return result.data;
}

export async function getYakkyofyTracking(orderId: string): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyGetTracking");
  const result = await fn({ orderId });
  return result.data;
}

export async function getYakkyofyBalance(): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofyGetBalance");
  const result = await fn({});
  return result.data;
}

export async function syncYakkyofyOrderStatuses(): Promise<any> {
  const fn = httpsCallable(functions, "yakkyofySyncOrderStatuses");
  const result = await fn({});
  return result.data;
}

// ==================== أدوات مساعدة ====================

export function calculateYakkyofySellingPrice(
  usdPrice: number,
  usdToSar: number,
  markupPercent: number,
): number {
  const sarPrice = usdPrice * usdToSar;
  return Math.ceil(sarPrice * (1 + markupPercent / 100));
}

export function calculateYakkyofyProfit(
  sellingPrice: number,
  costUsd: number,
  usdToSar: number,
): number {
  return sellingPrice - costUsd * usdToSar;
}
