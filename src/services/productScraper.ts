/**
 * Product Scraper Service
 * Extracts product data from URLs using CORS proxies + HTML parsing.
 * Supports AliExpress-specific parsing (embedded JS data + meta tags) and generic Open Graph / JSON-LD.
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

function isAliExpressUrl(url: string): boolean {
  return /aliexpress\.(com|us|ru)/i.test(url);
}

/**
 * Strip tracking / unnecessary query params from AliExpress URLs.
 * AliExpress product pages only need the path: /item/{ITEM_ID}.html
 */
function cleanAliExpressUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

/**
 * Extract numeric product ID from an AliExpress URL.
 */
function extractAliExpressItemId(url: string): string | null {
  const m =
    url.match(/\/item\/(\d+)\.html/i) || url.match(/\/(\d{10,})\.html/i);
  return m ? m[1] : null;
}

function cleanUrl(raw: string): string {
  if (isAliExpressUrl(raw)) return cleanAliExpressUrl(raw);
  return raw;
}

// ==================== CORS Proxy Helpers ====================

interface ProxyConfig {
  name: string;
  make: (url: string) => string;
  parse: (res: Response) => Promise<string>;
}

const CORS_PROXIES: ProxyConfig[] = [
  {
    name: "corsproxy.io",
    make: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    parse: (res) => res.text(),
  },
  {
    name: "allorigins-raw",
    make: (url) =>
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    parse: (res) => res.text(),
  },
  {
    name: "allorigins-json",
    make: (url) =>
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parse: async (res) => {
      const data = await res.json();
      return data.contents || "";
    },
  },
  {
    name: "codetabs",
    make: (url) =>
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    parse: (res) => res.text(),
  },
];

async function fetchWithProxy(url: string): Promise<string> {
  const cleaned = cleanUrl(url);
  console.log("[Scraper] Fetching:", cleaned);

  for (const proxy of CORS_PROXIES) {
    try {
      console.log(`[Scraper] Trying proxy: ${proxy.name}`);
      const proxyUrl = proxy.make(cleaned);
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        console.log(`[Scraper] ${proxy.name} returned ${res.status}`);
        continue;
      }
      const html = await proxy.parse(res);
      if (html && html.length > 200) {
        console.log(`[Scraper] ${proxy.name} success (${html.length} chars)`);
        return html;
      }
      console.log(
        `[Scraper] ${proxy.name} returned too short response (${html?.length || 0} chars)`,
      );
    } catch (err) {
      console.log(`[Scraper] ${proxy.name} failed:`, err);
      continue;
    }
  }

  // For AliExpress, also try the English version and mobile URLs
  if (isAliExpressUrl(cleaned)) {
    const itemId = extractAliExpressItemId(cleaned);
    if (itemId) {
      const altUrls = [
        `https://www.aliexpress.com/item/${itemId}.html`,
        `https://m.aliexpress.com/item/${itemId}.html`,
      ].filter((u) => u !== cleaned);

      for (const altUrl of altUrls) {
        console.log(`[Scraper] Trying alternate AliExpress URL: ${altUrl}`);
        for (const proxy of CORS_PROXIES) {
          try {
            const res = await fetch(proxy.make(altUrl));
            if (!res.ok) continue;
            const html = await proxy.parse(res);
            if (html && html.length > 200) {
              console.log(
                `[Scraper] ${proxy.name} + altUrl success (${html.length} chars)`,
              );
              return html;
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  throw new Error(
    "تعذّر الاتصال بالموقع. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.",
  );
}

// ==================== HTML Parsing Helpers ====================

function parseMetaTag(html: string, property: string): string {
  const r1 = new RegExp(
    `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const m1 = html.match(r1);
  if (m1) return decodeHtmlEntities(m1[1]);
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

// ==================== AliExpress Data Extraction ====================

/**
 * AliExpress embeds product data in inline scripts as JSON objects.
 * Common patterns:
 * - window.runParams = { data: ... }
 * - data: { ... actionModule, titleModule, priceModule, imageModule ... }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAliExpressRunParams(html: string): any | null {
  const patterns = [
    /window\.runParams\s*=\s*(\{[\s\S]*?\});\s*<\/script>/i,
    /data:\s*(\{[\s\S]*?"titleModule"[\s\S]*?\})\s*[,;}\n]/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Extract product title from various AliExpress page patterns.
 */
function extractAliExpressTitle(html: string): string {
  // pattern: "subject":"Product Title Here"
  const subjectMatch = html.match(/"subject"\s*:\s*"([^"]+)"/);
  if (subjectMatch) return subjectMatch[1];

  // pattern: "title":"Product Title" (at least 10 chars to avoid false positives)
  const titleDataMatch = html.match(/"title"\s*:\s*"([^"]{10,200})"/);
  if (titleDataMatch) return titleDataMatch[1];

  return "";
}

/**
 * Extract prices from embedded AliExpress data.
 */
function extractAliExpressPrices(html: string): {
  price: number;
  oldPrice?: number;
} {
  let price = 0;
  let oldPrice: number | undefined;

  // Try minActivityAmount (sale price)
  const activityMatch = html.match(
    /"minActivityAmount"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)/,
  );
  if (activityMatch) price = parseFloat(activityMatch[1]);

  // Try minAmount (regular/original price)
  const amountMatch = html.match(
    /"minAmount"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)/,
  );
  if (amountMatch) {
    const v = parseFloat(amountMatch[1]);
    if (price && v > price) {
      oldPrice = v;
    } else if (!price) {
      price = v;
    }
  }

  // Try formatedActivityPrice / formatedPrice
  if (!price) {
    const fmtMatch = html.match(
      /"formatedActivityPrice"\s*:\s*"[A-Z]{3}\s*([\d,.]+)"/,
    );
    if (fmtMatch) price = parseFloat(fmtMatch[1].replace(/,/g, ""));
  }
  if (!price) {
    const fmtMatch = html.match(/"formatedPrice"\s*:\s*"[A-Z]{3}\s*([\d,.]+)"/);
    if (fmtMatch) price = parseFloat(fmtMatch[1].replace(/,/g, ""));
  }

  // Try discountPrice
  if (!price) {
    const discountMatch = html.match(/"discountPrice"\s*:\s*"?([\d.]+)"?/);
    if (discountMatch) price = parseFloat(discountMatch[1]);
  }

  // Fallback: product:price:amount meta tag
  if (!price) {
    const metaMatch = html.match(
      /product:price:amount["'][^>]*content=["']([\d.]+)["']/i,
    );
    if (metaMatch) price = parseFloat(metaMatch[1]);
  }

  return { price, oldPrice };
}

/**
 * Extract images from AliExpress page – both embedded data and alicdn URLs.
 */
function extractAliExpressImages(html: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  const addImage = (url: string) => {
    let clean = url.replace(/\\\//g, "/");
    clean = clean.replace(/_\d+x\d+\./, ".");
    if (!clean.startsWith("http")) clean = `https:${clean}`;
    if (!seen.has(clean)) {
      seen.add(clean);
      images.push(clean);
    }
  };

  // Pattern 1: "imagePathList":["//ae01.alicdn.com/..."]
  const imgListMatch = html.match(/"imagePathList"\s*:\s*\[([\s\S]*?)\]/);
  if (imgListMatch) {
    const urls = imgListMatch[1].match(/"([^"]+)"/g);
    if (urls) {
      urls.forEach((u) => addImage(u.replace(/"/g, "")));
    }
  }

  // Pattern 2: OG image meta tag
  const ogImage = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  );
  if (ogImage) addImage(ogImage[1]);

  // Pattern 3: Search for alicdn image URLs in the page
  const alicdnRegex =
    /["']((?:https?:)?\/\/[^"']*(?:ae01|alicdn|ae04)[^"']*\.(?:jpg|jpeg|png|webp))[^"']*/gi;
  let match;
  while ((match = alicdnRegex.exec(html)) !== null) {
    addImage(match[1]);
    if (images.length >= 10) break;
  }

  return images;
}

// ==================== AliExpress Parser ====================

function parseAliExpress(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: cleanAliExpressUrl(url),
    supplierName: "AliExpress",
  };

  console.log("[Scraper] Parsing AliExpress HTML, length:", html.length);

  // 1) Try extracting from embedded JavaScript data
  const title = extractAliExpressTitle(html);
  if (title) {
    product.nameEn = title;
    product.name = title;
    console.log("[Scraper] Found title from embedded data:", title);
  }

  const prices = extractAliExpressPrices(html);
  if (prices.price) {
    product.price = prices.price;
    product.supplierPrice = prices.price;
    if (prices.oldPrice) product.oldPrice = prices.oldPrice;
    console.log("[Scraper] Found price from embedded data:", prices);
  }

  const images = extractAliExpressImages(html);
  if (images.length > 0) {
    product.images = images;
    console.log("[Scraper] Found images:", images.length);
  }

  // 2) Try JSON-LD structured data
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    console.log("[Scraper] Found JSON-LD data");
    if (!product.nameEn && jsonLd.name) {
      product.nameEn = jsonLd.name;
      product.name = jsonLd.name;
    }
    if (!product.description && jsonLd.description) {
      product.description = jsonLd.description;
    }
    if (product.images.length === 0 && jsonLd.image) {
      product.images = Array.isArray(jsonLd.image)
        ? jsonLd.image
        : [jsonLd.image];
    }
    if (!product.price && jsonLd.offers) {
      const offer = Array.isArray(jsonLd.offers)
        ? jsonLd.offers[0]
        : jsonLd.offers;
      product.price = parseFloat(offer?.price) || 0;
      product.supplierPrice = product.price;
      if (offer?.highPrice) product.oldPrice = parseFloat(offer.highPrice);
    }
  }

  // 3) Fallback to Open Graph meta tags
  if (!product.nameEn) {
    product.nameEn = parseMetaTag(html, "og:title");
    product.name = product.nameEn;
  }
  if (!product.description) {
    product.description = parseMetaTag(html, "og:description");
  }
  if (!product.price) {
    const priceStr = parseMetaTag(html, "product:price:amount");
    product.price = parseFloat(priceStr) || 0;
    product.supplierPrice = product.price;
  }

  // 4) Last resort: <title> tag
  if (!product.nameEn) {
    const titleTag = getTitleFromHtml(html);
    if (titleTag) {
      product.nameEn = titleTag
        .replace(/\s*[-|]\s*(ali\s*express|aliexpress)[^]*$/i, "")
        .trim();
      product.name = product.nameEn;
    }
  }

  // 5) runParams data (full JSON structure)
  if (!product.price || !product.nameEn) {
    const runParams = extractAliExpressRunParams(html);
    if (runParams) {
      const data = runParams.data || runParams;
      if (!product.nameEn && data.titleModule?.subject) {
        product.nameEn = data.titleModule.subject;
        product.name = product.nameEn;
      }
      if (!product.price && data.priceModule) {
        const pm = data.priceModule;
        product.price = pm.minActivityAmount?.value || pm.minAmount?.value || 0;
        product.supplierPrice = product.price;
        if (pm.minAmount?.value && pm.minAmount.value > product.price) {
          product.oldPrice = pm.minAmount.value;
        }
      }
      if (product.images.length === 0 && data.imageModule?.imagePathList) {
        product.images = data.imageModule.imagePathList.map((img: string) =>
          img.startsWith("http") ? img : `https:${img}`,
        );
      }
    }
  }

  console.log("[Scraper] Final AliExpress result:", {
    name: product.name?.substring(0, 50),
    price: product.price,
    images: product.images.length,
  });

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
      const imgs = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
      product.images = imgs
        .map((i: unknown) =>
          typeof i === "string" ? i : (i as { url?: string })?.url || "",
        )
        .filter(Boolean);
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
  console.log("[Scraper] Starting scrape for:", url);

  const html = await fetchWithProxy(url);
  if (!html || html.length < 100) {
    throw new Error("تعذّر جلب بيانات المنتج من هذا الرابط");
  }

  const result = isAliExpressUrl(url)
    ? parseAliExpress(html, url)
    : parseGeneric(html, url);

  if (!result.name && !result.nameEn) {
    throw new Error(
      "لم يتم العثور على بيانات منتج في هذا الرابط. تأكد من صحة الرابط.",
    );
  }

  return result;
}
