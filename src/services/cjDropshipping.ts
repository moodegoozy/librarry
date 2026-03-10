import { getFunctions, httpsCallable } from "firebase/functions";
import app from "../config/firebase";
import type { CJSettings } from "../types";
import { getCJSettings, updateCJSettings } from "./firestore";

const functions = getFunctions(app);

// ==================== أنواع الاستجابة ====================

export interface CJProductResult {
  pid: string;
  productNameEn: string;
  productSku: string;
  productImage: string;
  sellPrice: number;
  categoryId: string;
  categoryName: string;
  productWeight: number;
  productType: string;
  sourceFrom: number;
}

export interface CJProductDetail {
  pid: string;
  productNameEn: string;
  productSku: string;
  productImage: string;
  sellPrice: number;
  categoryId: string;
  categoryName: string;
  description: string;
  productWeight: number;
  productType: string;
  variants: {
    vid: string;
    variantNameEn: string;
    variantSku: string;
    variantImage: string;
    variantPrice: number;
    variantWeight: number;
    variantKey: string;
  }[];
}

export interface CJApiResponse<T = unknown> {
  result: boolean;
  code: number;
  message: string;
  data: T;
}

export interface CJPaginatedData<T> {
  pageNum: number;
  pageSize: number;
  total: number;
  list: T[];
}

// ==================== الإعدادات ====================

export async function loadCJSettings(): Promise<CJSettings | null> {
  return getCJSettings();
}

export async function saveCJSettings(
  settings: Partial<CJSettings>,
): Promise<void> {
  return updateCJSettings(settings);
}

// ==================== اختبار الاتصال ====================

export async function testCJConnection(
  email: string,
  apiKey?: string,
): Promise<{ success: boolean; message: string }> {
  const fn = httpsCallable(functions, "cjTestConnection");
  const result = await fn({ email, apiKey });
  return result.data as { success: boolean; message: string };
}

// ==================== المنتجات ====================

export async function searchCJProducts(params: {
  keyword?: string;
  categoryId?: string;
  pageNum?: number;
  pageSize?: number;
}): Promise<CJApiResponse<CJPaginatedData<CJProductResult>>> {
  const fn = httpsCallable(functions, "cjSearchProducts");
  const result = await fn(params);
  return result.data as CJApiResponse<CJPaginatedData<CJProductResult>>;
}

export async function getCJProductDetail(
  pid: string,
): Promise<CJApiResponse<CJProductDetail>> {
  const fn = httpsCallable(functions, "cjGetProductDetail");
  const result = await fn({ pid });
  return result.data as CJApiResponse<CJProductDetail>;
}

export async function getCJProductVariants(
  pid: string,
): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjGetProductVariants");
  const result = await fn({ pid });
  return result.data as CJApiResponse<unknown>;
}

export async function getCJProductInventory(
  vid: string,
): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjGetProductInventory");
  const result = await fn({ vid });
  return result.data as CJApiResponse<unknown>;
}

// ==================== التصنيفات ====================

export async function getCJCategories(): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjGetCategories");
  const result = await fn({});
  return result.data as CJApiResponse<unknown>;
}

// ==================== الطلبات ====================

export async function createCJOrder(
  firestoreOrderId: string,
  orderData: {
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
  },
): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjCreateOrder");
  const result = await fn({ firestoreOrderId, orderData });
  return result.data as CJApiResponse<unknown>;
}

export async function confirmCJOrder(
  orderId: string,
): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjConfirmOrder");
  const result = await fn({ orderId });
  return result.data as CJApiResponse<unknown>;
}

export async function listCJOrders(params: {
  pageNum?: number;
  pageSize?: number;
  orderStatus?: string;
}): Promise<CJApiResponse<CJPaginatedData<unknown>>> {
  const fn = httpsCallable(functions, "cjListOrders");
  const result = await fn(params);
  return result.data as CJApiResponse<CJPaginatedData<unknown>>;
}

export async function getCJTracking(
  trackNumber: string,
): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjGetTracking");
  const result = await fn({ trackNumber });
  return result.data as CJApiResponse<unknown>;
}

// ==================== الشحن ====================

export async function calculateCJFreight(params: {
  startCountryCode?: string;
  endCountryCode?: string;
  products: { vid: string; quantity: number }[];
}): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjCalculateFreight");
  const result = await fn(params);
  return result.data as CJApiResponse<unknown>;
}

// ==================== الرصيد ====================

export async function getCJBalance(): Promise<CJApiResponse<unknown>> {
  const fn = httpsCallable(functions, "cjGetBalance");
  const result = await fn({});
  return result.data as CJApiResponse<unknown>;
}

// ==================== مزامنة حالات الطلبات ====================

export async function syncCJOrderStatuses(): Promise<{
  synced: number;
  results: { orderId: string; status: string; error?: string }[];
}> {
  const fn = httpsCallable(functions, "cjSyncOrderStatuses");
  const result = await fn({});
  return result.data as {
    synced: number;
    results: { orderId: string; status: string; error?: string }[];
  };
}

// ==================== مساعدات التسعير ====================

export function calculateSellingPrice(
  costUSD: number | string,
  usdToSar: number = 3.75,
  markupPercent: number = 30,
): number {
  const cost = Number(costUSD) || 0;
  const costSAR = cost * usdToSar;
  const sellingPrice = costSAR * (1 + markupPercent / 100);
  return Math.ceil(sellingPrice);
}

export function calculateProfit(
  sellingPriceSAR: number,
  costUSD: number,
  usdToSar: number = 3.75,
): { profitSAR: number; profitPercent: number } {
  const costSAR = costUSD * usdToSar;
  const profitSAR = sellingPriceSAR - costSAR;
  const profitPercent = costSAR > 0 ? (profitSAR / costSAR) * 100 : 0;
  return {
    profitSAR: Math.round(profitSAR * 100) / 100,
    profitPercent: Math.round(profitPercent),
  };
}
