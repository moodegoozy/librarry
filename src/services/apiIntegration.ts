/**
 * خدمة تكامل API للدروبشيبينج
 *
 * هذه الخدمة تتيح جلب المنتجات من متاجر خارجية عبر API
 * وتزامنها مع Firestore الخاص بمتجرك
 *
 * الاستخدام:
 * 1. أضف مزود API في لوحة التحكم (الإعدادات)
 * 2. حدد رابط API ومفتاح الوصول
 * 3. حدد دالة التحويل (mapping) لتتناسب مع هيكل منتجاتك
 */

import { addProduct, updateProduct } from "./firestore";
import type { Product } from "../types";

// ==================== أنواع البيانات ====================

export interface APIProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  type: "custom" | "aliexpress" | "cjdropshipping" | "printful" | "spocket";
  headers?: Record<string, string>;
  isActive: boolean;
  lastSync?: Date;
  productMapping?: ProductMapping;
}

/**
 * خريطة تحويل حقول المنتج من API الخارجي إلى هيكل منتجات المتجر
 * كل حقل يحتوي على مسار الحقل في ردّ API (مثال: "data.product.title")
 */
export interface ProductMapping {
  id: string; // مسار الحقل: المعرف
  name: string; // مسار الحقل: اسم المنتج
  nameEn?: string; // مسار الحقل: الاسم بالإنجليزي
  description: string; // مسار الحقل: الوصف
  price: string; // مسار الحقل: السعر
  images: string; // مسار الحقل: قائمة الصور
  stock: string; // مسار الحقل: المخزون
  category?: string; // مسار الحقل: التصنيف
}

export interface APIProduct {
  externalId: string;
  name: string;
  nameEn: string;
  description: string;
  supplierPrice: number; // سعر المورد
  sellingPrice: number; // سعرك بعد هامش الربح
  images: string[];
  stock: number;
  category: string;
  supplierName: string;
  supplierUrl?: string;
  specs?: Record<string, string>;
}

export interface SyncResult {
  success: boolean;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
}

// ==================== الإعدادات الافتراضية ====================

const DEFAULT_MARKUP_PERCENTAGE = 30; // هامش ربح 30%

// ==================== دوال مساعدة ====================

/**
 * الوصول لحقل متداخل في كائن باستخدام مسار نقطي
 * مثال: getNestedValue(obj, "data.product.title")
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (
      current &&
      typeof current === "object" &&
      key in (current as Record<string, unknown>)
    ) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * حساب سعر البيع بناءً على سعر المورد وهامش الربح
 */
export function calculateSellingPrice(
  supplierPrice: number,
  markupPercentage: number = DEFAULT_MARKUP_PERCENTAGE,
): number {
  return Math.ceil(supplierPrice * (1 + markupPercentage / 100));
}

// ==================== جلب المنتجات من API ====================

/**
 * جلب المنتجات من API خارجي
 */
export async function fetchProductsFromAPI(
  provider: APIProvider,
  endpoint: string = "/products",
): Promise<APIProduct[]> {
  try {
    const url = `${provider.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...provider.headers,
    };

    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // تحويل البيانات حسب نوع المزود
    return mapAPIResponse(data, provider);
  } catch (error) {
    console.error(`Error fetching from ${provider.name}:`, error);
    throw error;
  }
}

/**
 * تحويل ردّ API إلى هيكل المنتجات المحلي
 */
function mapAPIResponse(
  data: Record<string, unknown>,
  provider: APIProvider,
): APIProduct[] {
  const mapping = provider.productMapping;

  if (!mapping) {
    throw new Error("Product mapping not configured for this provider");
  }

  // تحديد مصفوفة المنتجات (قد تكون في data.products أو data.items أو المصفوفة نفسها)
  let productsArray: Record<string, unknown>[];
  if (Array.isArray(data)) {
    productsArray = data as Record<string, unknown>[];
  } else if (Array.isArray((data as Record<string, unknown>).products)) {
    productsArray = (data as Record<string, unknown>).products as Record<
      string,
      unknown
    >[];
  } else if (Array.isArray((data as Record<string, unknown>).items)) {
    productsArray = (data as Record<string, unknown>).items as Record<
      string,
      unknown
    >[];
  } else if (Array.isArray((data as Record<string, unknown>).data)) {
    productsArray = (data as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];
  } else {
    throw new Error("Could not find products array in API response");
  }

  return productsArray.map((item) => {
    const supplierPrice = Number(getNestedValue(item, mapping.price)) || 0;
    const images = getNestedValue(item, mapping.images);

    return {
      externalId: String(getNestedValue(item, mapping.id) || ""),
      name: String(getNestedValue(item, mapping.name) || ""),
      nameEn: mapping.nameEn
        ? String(getNestedValue(item, mapping.nameEn) || "")
        : "",
      description: String(getNestedValue(item, mapping.description) || ""),
      supplierPrice,
      sellingPrice: calculateSellingPrice(supplierPrice),
      images: Array.isArray(images)
        ? (images as string[])
        : typeof images === "string"
          ? [images]
          : [],
      stock: Number(getNestedValue(item, mapping.stock)) || 0,
      category: mapping.category
        ? String(getNestedValue(item, mapping.category) || "")
        : "غير مصنف",
      supplierName: provider.name,
    };
  });
}

// ==================== مزامنة المنتجات مع Firestore ====================

/**
 * مزامنة المنتجات من API خارجي مع Firestore
 * تضيف المنتجات الجديدة وتحدث الموجودة
 */
export async function syncProductsToFirestore(
  apiProducts: APIProduct[],
  existingProducts: Product[],
  markupPercentage: number = DEFAULT_MARKUP_PERCENTAGE,
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    added: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const apiProduct of apiProducts) {
    try {
      // البحث عن المنتج في Firestore باستخدام externalId
      const existing = existingProducts.find(
        (p) => p.nameEn === apiProduct.externalId || p.name === apiProduct.name,
      );

      const sellingPrice = calculateSellingPrice(
        apiProduct.supplierPrice,
        markupPercentage,
      );

      if (existing) {
        // تحديث المنتج الموجود
        await updateProduct(existing.id, {
          price: sellingPrice,
          stock: apiProduct.stock,
          images:
            apiProduct.images.length > 0 ? apiProduct.images : existing.images,
          description: apiProduct.description || existing.description,
        });
        result.updated++;
      } else {
        // إضافة منتج جديد
        await addProduct({
          name: apiProduct.name,
          nameEn: apiProduct.nameEn || apiProduct.externalId,
          description: apiProduct.description,
          price: sellingPrice,
          oldPrice:
            sellingPrice > apiProduct.supplierPrice * 1.5
              ? Math.ceil(apiProduct.supplierPrice * 1.8)
              : undefined,
          category: apiProduct.category,
          images:
            apiProduct.images.length > 0
              ? apiProduct.images
              : ["https://via.placeholder.com/300"],
          stock: apiProduct.stock,
          featured: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        result.added++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`Failed to sync: ${apiProduct.name} - ${error}`);
    }
  }

  result.success = result.failed === 0;
  return result;
}

// ==================== جلب المنتجات من مزود واحد ====================

/**
 * جلب ومزامنة المنتجات من مزود API واحد
 */
export async function fetchAndSyncFromProvider(
  provider: APIProvider,
  existingProducts: Product[],
  markupPercentage?: number,
): Promise<SyncResult> {
  try {
    const apiProducts = await fetchProductsFromAPI(provider);
    return await syncProductsToFirestore(
      apiProducts,
      existingProducts,
      markupPercentage,
    );
  } catch (error) {
    return {
      success: false,
      added: 0,
      updated: 0,
      failed: 0,
      errors: [String(error)],
    };
  }
}

// ==================== إعدادات مزودين جاهزة ====================

/**
 * قالب مزود API مخصص (للمتاجر التي تمتلك API خاص)
 */
export function createCustomProvider(config: {
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  mapping: ProductMapping;
}): APIProvider {
  return {
    id: `custom_${Date.now()}`,
    name: config.name,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    type: "custom",
    headers: config.headers,
    isActive: true,
    productMapping: config.mapping,
  };
}

/**
 * قالب جاهز لـ Fake Store API (للتجربة والتطوير)
 */
export function createFakeStoreProvider(): APIProvider {
  return {
    id: "fakestore",
    name: "Fake Store API (تجريبي)",
    baseUrl: "https://fakestoreapi.com",
    type: "custom",
    isActive: true,
    productMapping: {
      id: "id",
      name: "title",
      description: "description",
      price: "price",
      images: "image",
      stock: "rating.count",
      category: "category",
    },
  };
}
