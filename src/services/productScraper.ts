/**
 * Product Scraper Service
 * Extracts product data from URLs using CORS proxies + HTML parsing.
 * Supports AliExpress-specific parsing and generic Open Graph / JSON-LD.
 */

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
}

// ==================== URL Cleaning ====================

/**
 * Strip tracking / unnecessary query params from AliExpress URLs.
 * AliExpress product pages only need the path: /item/{ITEM_ID}.html
 */
function cleanAliExpressUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Keep only the pathname (e.g. /item/1005010416545886.html)
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

/**
 * Generic URL cleanup – strip tracking params for shorter proxy requests.
 */
function cleanUrl(raw: string): string {
  if (isAliExpressUrl(raw)) return cleanAliExpressUrl(raw);
  return raw;
}

// ==================== CORS Proxy Helpers ====================

const CORS_PROXIES: Array<{
  make: (url: string) => string;
  parse: (res: Response) => Promise<string>;
}> = [
  {
    // corsproxy.io – usually the most reliable
    make: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    parse: (res) => res.text(),
  },
  {
    // allorigins – returns JSON with { contents }
    make: (url) =>
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parse: async (res) => {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        return data.contents || "";
      }
      return res.text();
    },
  },
  {
    // api.codetabs.com
    make: (url) =>
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    parse: (res) => res.text(),
  },
];

async function fetchWithProxy(url: string): Promise<string> {
  // Clean the URL first to avoid bloated proxy requests
  const cleaned = cleanUrl(url);

  for (const { make, parse } of CORS_PROXIES) {
    try {
      const proxyUrl = make(cleaned);
      const res = await fetch(proxyUrl);
      if (!res.ok) continue;
      const html = await parse(res);
      if (html && html.length > 200) return html;
    } catch {
      continue;
    }
  }

  // Last resort: direct fetch (only works if target allows CORS)
  const directRes = await fetch(cleaned);
  return await directRes.text();
}

// ==================== HTML Parsing Helpers ====================

function parseMetaTag(html: string, property: string): string {
  // property="X" content="Y"
  const r1 = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const m1 = html.match(r1);
  if (m1) return decodeHtmlEntities(m1[1]);
  // content="Y" property="X"  (reversed order)
  const r2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    "i",
  );
  const m2 = html.match(r2);
  return m2 ? decodeHtmlEntities(m2[1]) : "";
}

function decodeHtmlEntities(text: string): string {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.documentElement.textContent || text;
}

function parseJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const regex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
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

function getTitleFromHtml(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : "";
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

// ==================== AliExpress ====================

// Declared early so cleanUrl() can reference it
function isAliExpressUrl(url: string): boolean {
  return /aliexpress\.(com|us|ru)/i.test(url);
}

function parseAliExpress(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: url,
    supplierName: "AliExpress",
  };

  // 1) Try JSON-LD structured data
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    product.nameEn = jsonLd.name || "";
    product.description = jsonLd.description || "";
    if (jsonLd.image) {
      product.images = Array.isArray(jsonLd.image)
        ? jsonLd.image
        : [jsonLd.image];
    }
    if (jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers)
        ? jsonLd.offers[0]
        : jsonLd.offers;
      product.price = parseFloat(offer?.price) || 0;
      product.supplierPrice = product.price;
      if (offer?.highPrice) product.oldPrice = parseFloat(offer.highPrice);
    }
  }

  // 2) Fallback to Open Graph meta tags
  if (!product.nameEn) product.nameEn = parseMetaTag(html, "og:title");
  if (!product.description)
    product.description = parseMetaTag(html, "og:description");
  if (product.images.length === 0) {
    const ogImage = parseMetaTag(html, "og:image");
    if (ogImage) product.images = [ogImage];
  }
  if (!product.price) {
    const priceStr = parseMetaTag(html, "product:price:amount");
    product.price = parseFloat(priceStr) || 0;
    product.supplierPrice = product.price;
  }

  // 3) Try to extract multiple images from alicdn URLs in page data
  const imgRegex =
    /["'](https?:\/\/[^"']*(?:ae01|alicdn)[^"']*\.(?:jpg|jpeg|png|webp))[^"']*/gi;
  const uniqueImages = new Set<string>();
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    // Remove thumbnail size suffix to get full-size image
    const fullUrl = imgMatch[1].replace(/_\d+x\d+\./, ".");
    uniqueImages.add(fullUrl);
    if (uniqueImages.size >= 8) break;
  }
  if (uniqueImages.size > product.images.length) {
    product.images = Array.from(uniqueImages);
  }

  product.name = product.nameEn;
  return product;
}

// ==================== Generic Site ====================

function parseGeneric(html: string, url: string): ScrapedProduct {
  const hostname = new URL(url).hostname.replace("www.", "");
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: url,
    supplierName: hostname,
  };

  // 1) JSON-LD
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    product.nameEn = jsonLd.name || "";
    product.description = jsonLd.description || "";
    if (jsonLd.image) {
      const imgs = Array.isArray(jsonLd.image)
        ? jsonLd.image
        : [jsonLd.image];
      product.images = imgs.map((i: unknown) =>
        typeof i === "string" ? i : (i as { url?: string })?.url || "",
      ).filter(Boolean);
    }
    if (jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers)
        ? jsonLd.offers[0]
        : jsonLd.offers;
      product.price =
        parseFloat(offer?.price) || parseFloat(offer?.lowPrice) || 0;
      product.supplierPrice = product.price;
    }
  }

  // 2) Open Graph meta tags fallback
  if (!product.nameEn) product.nameEn = parseMetaTag(html, "og:title");
  if (!product.description)
    product.description = parseMetaTag(html, "og:description");
  if (product.images.length === 0) {
    const ogImage = parseMetaTag(html, "og:image");
    if (ogImage) product.images = [ogImage];
  }
  if (!product.price) {
    const priceStr =
      parseMetaTag(html, "product:price:amount") ||
      parseMetaTag(html, "og:price:amount");
    product.price = parseFloat(priceStr) || 0;
    product.supplierPrice = product.price;
  }

  // 3) Fallback to <title>
  if (!product.nameEn) product.nameEn = getTitleFromHtml(html);

  product.name = product.nameEn;
  return product;
}

// ==================== Public API ====================

export async function scrapeProduct(url: string): Promise<ScrapedProduct> {
  const html = await fetchWithProxy(url);
  if (!html || html.length < 100) {
    throw new Error("تعذّر جلب بيانات المنتج من هذا الرابط");
  }

  const result = isAliExpressUrl(url)
    ? parseAliExpress(html, url)
    : parseGeneric(html, url);

  if (!result.name && !result.nameEn) {
    throw new Error("لم يتم العثور على بيانات منتج في هذا الرابط");
  }

  return result;
}
