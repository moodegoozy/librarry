/**
 * Product Scraping Service
 * خدمة جلب بيانات المنتجات من الروابط
 * تستخدم Cloud Function للسحب من الخادم (أكثر موثوقية)
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { scrapeProduct as clientScrape } from "./productScraper";
import type { ProductVariantType, ProductVariant } from "../types";

const functions = getFunctions();

// متغيرات المنتج من أمازون
export interface ScrapedVariantOption {
  name: string;
  value: string;
  asin?: string;
  image?: string;
  selected?: boolean;
}

export interface ScrapedVariantType {
  name: string;
  nameEn: string;
  options: ScrapedVariantOption[];
}

export interface ScrapedVariant {
  asin: string;
  options: Record<string, string>;
  price?: number;
  images: string[];
  available: boolean;
}

export interface ScrapedProduct {
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
  // حقول إضافية من أمازون
  asin?: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  features?: string[];
  // المتغيرات
  hasVariants?: boolean;
  variantTypes?: ScrapedVariantType[];
  variants?: ScrapedVariant[];
}

// تحويل المتغيرات من صيغة السكرابر لصيغة المتجر
export function convertToProductVariants(scraped: ScrapedProduct): {
  variantTypes?: ProductVariantType[];
  variants?: ProductVariant[];
} {
  if (!scraped.hasVariants || !scraped.variantTypes) {
    return {};
  }

  const variantTypes: ProductVariantType[] = scraped.variantTypes.map(vt => ({
    name: vt.name,
    nameEn: vt.nameEn,
    options: vt.options.map(opt => ({
      name: opt.name,
      value: opt.value,
      image: opt.image,
    })),
  }));

  const variants: ProductVariant[] = (scraped.variants || []).map((v, index) => ({
    id: `var_${index}_${v.asin || Date.now()}`,
    sku: v.asin,
    options: v.options,
    price: v.price,
    stock: 10, // افتراضي
    images: v.images,
    supplierVariantId: v.asin,
  }));

  return { variantTypes, variants };
}

/**
 * تحديد إذا كان الرابط يحتاج سحب من الخادم
 * Amazon و المواقع المحمية تحتاج خادم
 */
function needsServerScrape(url: string): boolean {
  const domain = url.toLowerCase();
  return (
    domain.includes("amazon") ||
    domain.includes("alibaba") ||
    domain.includes("1688")
  );
}

/**
 * سحب بيانات المنتج من الخادم (Cloud Function)
 */
async function serverScrape(url: string): Promise<ScrapedProduct> {
  console.log("[Scraper] Using server-side scrape for:", url);
  
  const scrapeFunction = httpsCallable<{ url: string }, ScrapedProduct>(
    functions,
    "scrapeProductFromUrl"
  );

  const result = await scrapeFunction({ url });
  return result.data;
}

/**
 * سحب بيانات المنتج - تلقائياً يختار الطريقة المناسبة
 * 
 * @param url رابط المنتج
 * @param forceServer إجبار استخدام الخادم
 */
export async function scrapeProductByUrl(
  url: string,
  forceServer = false
): Promise<ScrapedProduct> {
  const trimmedUrl = url.trim();

  // استخدام الخادم للمواقع المحمية أو عند الطلب
  if (forceServer || needsServerScrape(trimmedUrl)) {
    try {
      return await serverScrape(trimmedUrl);
    } catch (serverError) {
      console.error("[Scraper] Server scrape failed:", serverError);
      // إذا فشل الخادم، حاول العميل كاحتياط
      console.log("[Scraper] Trying client-side as fallback...");
      try {
        return await clientScrape(trimmedUrl);
      } catch (clientError) {
        // أعد رسالة خطأ الخادم لأنها أكثر دقة
        throw serverError;
      }
    }
  }

  // استخدام العميل للمواقع الأخرى
  try {
    return await clientScrape(trimmedUrl);
  } catch (clientError) {
    console.log("[Scraper] Client scrape failed, trying server...");
    // إذا فشل العميل، حاول الخادم
    try {
      return await serverScrape(trimmedUrl);
    } catch (serverError) {
      // أعد رسالة خطأ العميل لأنها عادة أكثر وضوحاً
      throw clientError;
    }
  }
}

/**
 * سحب بيانات المنتج من الخادم فقط
 */
export async function scrapeProductFromServer(url: string): Promise<ScrapedProduct> {
  return serverScrape(url.trim());
}

/**
 * سحب بيانات المنتج من العميل فقط (CORS proxies)
 */
export async function scrapeProductFromClient(url: string): Promise<ScrapedProduct> {
  return clientScrape(url.trim());
}
