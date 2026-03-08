/**
 * Product Scraper Service
 * Extracts product data from URLs using CORS proxies + HTML parsing.
 * Supports: AliExpress, Amazon, SHEIN, Noon, Temu, eBay, Alibaba,
 * and generic Open Graph / JSON-LD sites.
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

// ==================== Site Detection ====================

function isAliExpressUrl(url: string): boolean {
  return /aliexpress\.(com|us|ru)/i.test(url);
}

function isSheinUrl(url: string): boolean {
  return /shein\.(com|co\.\w+|sa|ae)/i.test(url) || /sheingsp\.com/i.test(url);
}

function isAlibabaUrl(url: string): boolean {
  return /alibaba\.com|1688\.com/i.test(url);
}

function isAmazonUrl(url: string): boolean {
  return /amazon\.(com|sa|ae|co\.uk|de|fr|es|it|co\.jp|in|com\.br|com\.au|nl|pl|se|sg|com\.mx|com\.tr|eg)/i.test(url);
}

function isNoonUrl(url: string): boolean {
  return /noon\.(com|sa|ae|com\.eg)/i.test(url);
}

function isTemuUrl(url: string): boolean {
  return /temu\.com/i.test(url);
}

function isEbayUrl(url: string): boolean {
  return /ebay\.(com|co\.uk|de|fr|es|it|com\.au|ca|at|ch|ie|ph|pl|nl|be|sg)/i.test(url);
}

function getSiteName(url: string): string {
  if (isAliExpressUrl(url)) return "AliExpress";
  if (isAmazonUrl(url)) return "Amazon";
  if (isSheinUrl(url)) return "SHEIN";
  if (isNoonUrl(url)) return "Noon";
  if (isTemuUrl(url)) return "Temu";
  if (isEbayUrl(url)) return "eBay";
  if (isAlibabaUrl(url)) return "Alibaba";
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "Unknown";
  }
}

// ==================== URL Cleaning ====================

/**
 * Strip tracking / unnecessary query params from AliExpress URLs.
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
 * Clean SHEIN URLs – keep only the product path.
 */
function cleanSheinUrl(raw: string): string {
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

function cleanAmazonUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // Keep only /dp/ASIN or /gp/product/ASIN path
    const dpMatch = u.pathname.match(/(\/dp\/[A-Z0-9]{10})/);
    if (dpMatch) return `${u.origin}${dpMatch[1]}`;
    const gpMatch = u.pathname.match(/(\/gp\/product\/[A-Z0-9]{10})/);
    if (gpMatch) return `${u.origin}${gpMatch[1]}`;
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

function cleanTemuUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw;
  }
}

function cleanUrl(raw: string): string {
  if (isAliExpressUrl(raw)) return cleanAliExpressUrl(raw);
  if (isSheinUrl(raw)) return cleanSheinUrl(raw);
  if (isAmazonUrl(raw)) return cleanAmazonUrl(raw);
  if (isTemuUrl(raw)) return cleanTemuUrl(raw);
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

  // For Amazon, try alternate domains (mobile, regional) which return smaller pages
  if (isAmazonUrl(cleaned)) {
    const asinMatch = cleaned.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      const asin = asinMatch[1];
      // Detect the base domain from the original URL
      let baseDomain = "www.amazon.com";
      try {
        baseDomain = new URL(cleaned).hostname;
      } catch { /* */ }
      const altUrls = [
        // Minimal DP page (no referral extras)
        `https://${baseDomain}/dp/${asin}`,
        // English amazon.com fallback if using a regional domain
        `https://www.amazon.com/dp/${asin}`,
      ].filter((u, i, arr) => u !== cleaned && arr.indexOf(u) === i);

      for (const altUrl of altUrls) {
        console.log(`[Scraper] Trying alternate Amazon URL: ${altUrl}`);
        for (const proxy of CORS_PROXIES) {
          try {
            const res = await fetch(proxy.make(altUrl));
            if (!res.ok) continue;
            const html = await proxy.parse(res);
            if (html && html.length > 200) {
              console.log(
                `[Scraper] ${proxy.name} + Amazon alt success (${html.length} chars)`,
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

/**
 * For SHEIN, try multiple domain variants since regional domains may block differently.
 */
async function fetchSheinWithFallback(url: string): Promise<string> {
  // First try the normal proxy flow
  try {
    return await fetchWithProxy(url);
  } catch {
    // Try alternate SHEIN domains
    const cleaned = cleanSheinUrl(url);
    const path = new URL(cleaned).pathname;
    const altDomains = [
      "https://ar.shein.com",
      "https://www.shein.com",
      "https://m.shein.com",
      "https://www.shein.sa",
    ];

    for (const domain of altDomains) {
      const altUrl = `${domain}${path}`;
      if (altUrl === cleaned) continue;
      console.log(`[Scraper] Trying alternate SHEIN domain: ${altUrl}`);
      for (const proxy of CORS_PROXIES) {
        try {
          const res = await fetch(proxy.make(altUrl));
          if (!res.ok) continue;
          const html = await proxy.parse(res);
          if (html && html.length > 500) {
            console.log(
              `[Scraper] ${proxy.name} + SHEIN alt domain success (${html.length} chars)`,
            );
            return html;
          }
        } catch {
          continue;
        }
      }
    }

    throw new Error("تعذّر جلب بيانات المنتج من SHEIN. حاول مرة أخرى لاحقاً.");
  }
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

// ==================== SHEIN Data Extraction ====================

/**
 * SHEIN embeds product data in various inline script patterns.
 * Common patterns:
 * - productIntroData: { detail: { ... } }
/**
 * SHEIN embeds product data in various inline script patterns.
 * Since SHEIN is heavily JS-rendered, we also:
 * - Extract the product name from the URL slug (reliable)
 * - Extract the product ID (p-XXXXX) and try SHEIN's goods detail API
 * - Parse any embedded SSR data
 */

/**
 * Extract a human-readable product name from SHEIN URL slug.
 * e.g., "PlayStation-PS5-DualSense-Wireless-Controller-..." → "PlayStation PS5 DualSense Wireless Controller ..."
 */
function extractSheinNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    // Match: /PRODUCT-NAME-p-12345.html
    const m = pathname.match(/\/([^/]+)-p-\d+\.html/i);
    if (m) {
      return m[1].replace(/-/g, " ").trim();
    }
    return "";
  } catch {
    return "";
  }
}

function parseShein(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: cleanSheinUrl(url),
    supplierName: "SHEIN",
  };

  console.log("[Scraper] Parsing SHEIN HTML, length:", html.length);

  // 1) Try JSON-LD (SHEIN sometimes includes it)
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    console.log("[Scraper] SHEIN: Found JSON-LD data");
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

  // 2) Try extracting product data from embedded script data
  if (!product.nameEn) {
    const namePatterns = [
      /"goods_name"\s*:\s*"([^"]+)"/,
      /"productName"\s*:\s*"([^"]+)"/,
      /"goods_name_en"\s*:\s*"([^"]+)"/,
      /"detail_name"\s*:\s*"([^"]+)"/,
      /"product_name"\s*:\s*"([^"]+)"/,
    ];
    for (const pattern of namePatterns) {
      const match = html.match(pattern);
      if (match) {
        product.nameEn = match[1];
        console.log(
          "[Scraper] SHEIN: Found name from embedded data:",
          match[1].substring(0, 50),
        );
        break;
      }
    }
  }

  // 3) Try extracting prices from embedded data
  if (!product.price) {
    const pricePatterns = [
      /"salePrice"\s*:\s*\{[^}]*"amount"\s*:\s*"?([\d.]+)"?/,
      /"retailPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"?([\d.]+)"?/,
      /"sale_price"\s*:\s*"?([\d.]+)"?/,
      /"salePrice"\s*:\s*"?([\d.]+)"?/,
      /"price"\s*:\s*"?([\d.]+)"?\s*[,}]/,
    ];
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        product.price = parseFloat(match[1]) || 0;
        product.supplierPrice = product.price;
        console.log("[Scraper] SHEIN: Found price:", product.price);
        break;
      }
    }

    const oldPricePatterns = [
      /"retailPrice"\s*:\s*\{[^}]*"amount"\s*:\s*"?([\d.]+)"?/,
      /"retail_price"\s*:\s*"?([\d.]+)"?/,
      /"retailPrice"\s*:\s*"?([\d.]+)"?/,
    ];
    for (const pattern of oldPricePatterns) {
      const match = html.match(pattern);
      if (match) {
        const v = parseFloat(match[1]);
        if (v > product.price) {
          product.oldPrice = v;
          break;
        }
      }
    }
  }

  // 4) Extract images – prioritize product-specific images
  const sheinImages: string[] = [];
  const seen = new Set<string>();

  // First: look for product-specific images (containing product ID or "/goods/" path)
  const productImgRegex =
    /["']((?:https?:)?\/\/img\.(?:ltwebstatic|shein)\.com[^"'\s)]*(?:\/goods\/|\/images\/)[^"'\s)]*\.(?:jpg|jpeg|png|webp))[^"']*/gi;
  let imgMatch;
  while ((imgMatch = productImgRegex.exec(html)) !== null) {
    let imgUrl = imgMatch[1];
    if (!imgUrl.startsWith("http")) imgUrl = `https:${imgUrl}`;
    imgUrl = imgUrl.replace(/_thumbnail_\d+x\d*/, "");
    if (!seen.has(imgUrl)) {
      seen.add(imgUrl);
      sheinImages.push(imgUrl);
    }
    if (sheinImages.length >= 10) break;
  }

  // Second: broader CDN search if no product-specific images found
  if (sheinImages.length === 0) {
    const sheinImgRegex =
      /["']((?:https?:)?\/\/img\.(?:ltwebstatic|shein)\.com[^"'\s)]*\.(?:jpg|jpeg|png|webp))[^"']*/gi;
    while ((imgMatch = sheinImgRegex.exec(html)) !== null) {
      let imgUrl = imgMatch[1];
      if (!imgUrl.startsWith("http")) imgUrl = `https:${imgUrl}`;
      imgUrl = imgUrl.replace(/_thumbnail_\d+x\d*/, "");
      if (!seen.has(imgUrl)) {
        seen.add(imgUrl);
        sheinImages.push(imgUrl);
      }
      if (sheinImages.length >= 10) break;
    }
  }

  if (sheinImages.length > product.images.length) {
    product.images = sheinImages;
    console.log(
      "[Scraper] SHEIN: Found images from CDN:",
      product.images.length,
    );
  }

  // 5) Try "goods_imgs" pattern
  if (product.images.length === 0) {
    const goodsImgsMatch = html.match(
      /"goods_imgs"\s*:\s*\{[^}]*"detail_image"\s*:\s*\[([\s\S]*?)\]/,
    );
    if (goodsImgsMatch) {
      const urls = goodsImgsMatch[1].match(/"(https?:\/\/[^"]+)"/g);
      if (urls) {
        product.images = urls.map((u) => u.replace(/"/g, "")).slice(0, 10);
        console.log(
          "[Scraper] SHEIN: Found images from goods_imgs:",
          product.images.length,
        );
      }
    }
  }

  // 6) Description from meta tag
  if (!product.description) {
    product.description =
      parseMetaTag(html, "og:description") || parseMetaTag(html, "description");
  }

  // 7) OG image fallback (only if no images found from CDN)
  if (product.images.length === 0) {
    const ogImage = parseMetaTag(html, "og:image");
    if (ogImage) product.images = [ogImage];
  }

  // 8) Extract product name from URL slug as reliable fallback
  //    This always works since the URL contains the product name
  if (!product.nameEn || isGenericSheinTitle(product.nameEn)) {
    const urlName = extractSheinNameFromUrl(url);
    if (urlName) {
      product.nameEn = urlName;
      console.log(
        "[Scraper] SHEIN: Using name from URL:",
        urlName.substring(0, 50),
      );
    }
  }

  // Clean SHEIN title suffixes
  if (product.nameEn) {
    product.nameEn = product.nameEn
      .replace(/\s*[-|–]\s*SHEIN[^]*$/i, "")
      .replace(/\s*[-|–]\s*شي\s*إن[^]*$/i, "")
      .trim();
  }

  product.name = product.nameEn;

  console.log("[Scraper] Final SHEIN result:", {
    name: product.name?.substring(0, 50),
    price: product.price,
    images: product.images.length,
  });

  return product;
}

/**
 * Check if the title is just the generic SHEIN site title (not product-specific).
 */
function isGenericSheinTitle(title: string): boolean {
  const generic = [
    "ملابس نسائية",
    "women's clothing",
    "shein",
    "شي إن",
    "تسوق الموضة",
    "shop fashion",
  ];
  const lower = title.toLowerCase();
  return generic.some((g) => lower.includes(g.toLowerCase()));
}

// ==================== Amazon Parser ====================

/**
 * Convert any Amazon image URL to full-resolution.
 * Amazon encodes sizing in a suffix like:
 *   ._AC_SX300_.jpg  ._AC_SL1500_.jpg  ._SS40_.jpg
 *   ._AC_UF1000,1000_QL80_.jpg  ._SY355_.jpg
 * Stripping everything between the last ._ and _. gives the original full-res image.
 * We then request ._AC_SL1500_. which is the largest standard Amazon size.
 */
function amazonFullResUrl(url: string): string {
  if (!url) return "";
  // Strip all Amazon sizing/quality suffixes: ._ANYTHING_.ext → ._AC_SL1500_.ext
  return url.replace(/\._[^.]+_\./, "._AC_SL1500_.");
}

function parseAmazon(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: cleanAmazonUrl(url),
    supplierName: "Amazon",
  };

  console.log("[Scraper] Parsing Amazon HTML, length:", html.length);

  // 1) JSON-LD structured data
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    console.log("[Scraper] Amazon: Found JSON-LD data");
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
      product.price =
        parseFloat(offer?.price) || parseFloat(offer?.lowPrice) || 0;
      product.supplierPrice = product.price;
      if (offer?.highPrice) product.oldPrice = parseFloat(offer.highPrice);
    }
  }

  // 2) Product title from <span id="productTitle">
  if (!product.nameEn) {
    const titlePatterns = [
      /<span[^>]*id=["']productTitle["'][^>]*>\s*([^<]+)/i,
      /<h1[^>]*id=["']title["'][^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)/i,
      /"title"\s*:\s*"([^"]{10,300})"/,
    ];
    for (const p of titlePatterns) {
      const m = html.match(p);
      if (m) {
        product.nameEn = decodeHtmlEntities(m[1].trim());
        break;
      }
    }
  }

  // 3) Price extraction — Amazon uses many patterns
  if (!product.price) {
    const pricePatterns = [
      /"priceAmount"\s*:\s*"?([\d,.]+)"?/,
      /"price"\s*:\s*"?([\d,.]+)"?\s*[,}]/,
      /class=["']a-price-whole["'][^>]*>([\d,]+)/,
      /id=["']priceblock_(?:dealprice|ourprice|saleprice)["'][^>]*>[^<]*?([\d,.]+)/i,
      /class=["']apexPriceToPay["'][^>]*>[\s\S]*?<span[^>]*>([\d,.]+)/i,
      /class=["']a-offscreen["'][^>]*>([\d,.]+)/,
    ];
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ""));
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
      /class=["']a-text-price["'][^>]*>[\s\S]*?<span[^>]*>([\d,.]+)/i,
      /id=["']listPrice["'][^>]*>([\d,.]+)/i,
      /"listPrice"\s*:\s*"?([\d,.]+)"?/,
    ];
    for (const p of oldPricePatterns) {
      const m = html.match(p);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (val > product.price) {
          product.oldPrice = val;
          break;
        }
      }
    }
  }

  // 4) Images from colorImages JS or Amazon media CDN
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
            .map((i: any) => {
              // Prefer hiRes (full quality), then large, then thumb
              const raw = i.hiRes || i.large || i.thumb || "";
              return amazonFullResUrl(raw);
            })
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

  // Fallback: Amazon media CDN URLs
  if (product.images.length === 0) {
    const amazonImgRegex =
      /["'](https?:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s]+\.(?:jpg|jpeg|png|webp))[^"']*/gi;
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
  if (!product.nameEn)
    product.nameEn = parseMetaTag(html, "og:title")
      .replace(/\s*:\s*Amazon.*$/i, "")
      .trim();
  if (!product.description)
    product.description = parseMetaTag(html, "og:description");
  if (product.images.length === 0) {
    const ogImage = parseMetaTag(html, "og:image");
    if (ogImage) product.images = [ogImage];
  }

  // 6) Description from feature bullets
  if (!product.description) {
    const bulletMatches = html.match(
      /<span[^>]*class=["']a-list-item["'][^>]*>\s*([^<]{10,})/gi,
    );
    if (bulletMatches) {
      product.description = bulletMatches
        .slice(0, 5)
        .map((b) => b.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean)
        .join(" • ");
    }
  }

  // Detect Amazon regional domain
  try {
    const domain = new URL(url).hostname;
    if (domain.includes(".sa")) product.supplierName = "Amazon.sa";
    else if (domain.includes(".ae")) product.supplierName = "Amazon.ae";
    else if (domain.includes(".co.uk")) product.supplierName = "Amazon.co.uk";
    else if (domain.includes(".de")) product.supplierName = "Amazon.de";
  } catch {
    /* keep default */
  }

  // Title tag fallback
  if (!product.nameEn) {
    const t = getTitleFromHtml(html)
      .replace(/\s*[-:|]\s*Amazon.*$/i, "")
      .trim();
    if (t) product.nameEn = t;
  }

  product.name = product.nameEn;

  console.log("[Scraper] Final Amazon result:", {
    name: product.name?.substring(0, 50),
    price: product.price,
    images: product.images.length,
  });

  return product;
}

// ==================== Noon Parser ====================

function parseNoon(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: url,
    supplierName: "Noon",
  };

  console.log("[Scraper] Parsing Noon HTML, length:", html.length);

  // 1) Noon often uses Next.js — try __NEXT_DATA__
  const nextDataMatch = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const pageProps = nextData?.props?.pageProps;
      const catalog =
        pageProps?.catalog ||
        pageProps?.product ||
        pageProps?.initialState?.catalog;

      if (catalog) {
        const name =
          catalog.product_title || catalog.name || catalog.title || "";
        if (name) {
          product.nameEn = name;
          product.name = name;
        }

        const price =
          catalog.sale_price ||
          catalog.price ||
          catalog.special_price ||
          0;
        if (price) {
          product.price = parseFloat(String(price)) || 0;
          product.supplierPrice = product.price;
        }
        const oldPrice =
          catalog.was_price ||
          catalog.old_price ||
          catalog.regular_price ||
          0;
        if (oldPrice) {
          const v = parseFloat(String(oldPrice));
          if (v > product.price) product.oldPrice = v;
        }

        if (catalog.image_keys && Array.isArray(catalog.image_keys)) {
          product.images = catalog.image_keys.map((key: string) =>
            key.startsWith("http") ? key : `https://f.nooncdn.com/p/${key}.jpg`,
          );
        } else if (catalog.images && Array.isArray(catalog.images)) {
          product.images = catalog.images.map((img: string) =>
            img.startsWith("http") ? img : `https://f.nooncdn.com/p/${img}`,
          );
        }
        console.log("[Scraper] Noon: Found data in __NEXT_DATA__");
      }
    } catch {
      console.log("[Scraper] Noon: Failed to parse __NEXT_DATA__");
    }
  }

  // 2) JSON-LD fallback
  if (!product.nameEn || !product.price) {
    const jsonLd = findProductInJsonLd(parseJsonLd(html));
    if (jsonLd) {
      if (!product.nameEn) product.nameEn = jsonLd.name || "";
      if (!product.description) product.description = jsonLd.description || "";
      if (jsonLd.image && product.images.length === 0) {
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
      }
    }
  }

  // 3) Embedded JS data patterns
  if (!product.nameEn) {
    const namePatterns = [
      /"product_title"\s*:\s*"([^"]+)"/,
      /"name"\s*:\s*"([^"]{10,200})"/,
      /"productName"\s*:\s*"([^"]+)"/,
    ];
    for (const p of namePatterns) {
      const m = html.match(p);
      if (m) {
        product.nameEn = m[1];
        break;
      }
    }
  }

  if (!product.price) {
    const pricePatterns = [
      /"sale_price"\s*:\s*"?([\d.]+)"?/,
      /"price"\s*:\s*"?([\d.]+)"?\s*[,}]/,
      /"special_price"\s*:\s*"?([\d.]+)"?/,
    ];
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        product.price = parseFloat(m[1]) || 0;
        product.supplierPrice = product.price;
        break;
      }
    }
  }

  // 4) Noon CDN images
  if (product.images.length === 0) {
    const noonImgRegex =
      /["'](https?:\/\/f\.nooncdn\.com\/[^"'\s]+\.(?:jpg|jpeg|png|webp))[^"']*/gi;
    let m;
    const seen = new Set<string>();
    while ((m = noonImgRegex.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        product.images.push(m[1]);
      }
      if (product.images.length >= 10) break;
    }
  }

  // 5) OG tags / title fallback
  if (!product.nameEn)
    product.nameEn = parseMetaTag(html, "og:title")
      .replace(/\s*[-|]\s*(?:noon|نون).*$/i, "")
      .trim();
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
  if (!product.nameEn) {
    product.nameEn = getTitleFromHtml(html)
      .replace(/\s*[-|]\s*(?:noon|نون).*$/i, "")
      .trim();
  }

  // Detect Noon region
  try {
    const domain = new URL(url).hostname;
    const path = new URL(url).pathname;
    if (domain.includes(".sa") || path.includes("/saudi"))
      product.supplierName = "Noon.sa";
    else if (domain.includes(".ae") || path.includes("/uae"))
      product.supplierName = "Noon.ae";
    else if (domain.includes(".eg") || path.includes("/egypt"))
      product.supplierName = "Noon.eg";
  } catch {
    /* keep default */
  }

  product.name = product.nameEn;

  console.log("[Scraper] Final Noon result:", {
    name: product.name?.substring(0, 50),
    price: product.price,
    images: product.images.length,
  });

  return product;
}

// ==================== Temu Parser ====================

function extractTemuNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/\/([^/]+?)(?:-g-\d+)?\.html$/i);
    if (m) return m[1].replace(/-/g, " ").trim();
    return "";
  } catch {
    return "";
  }
}

function parseTemu(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: cleanTemuUrl(url),
    supplierName: "Temu",
  };

  console.log("[Scraper] Parsing Temu HTML, length:", html.length);

  // 1) JSON-LD
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    console.log("[Scraper] Temu: Found JSON-LD data");
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
      product.price =
        parseFloat(offer?.price) || parseFloat(offer?.lowPrice) || 0;
      product.supplierPrice = product.price;
      if (offer?.highPrice) {
        const v = parseFloat(offer.highPrice);
        if (v > product.price) product.oldPrice = v;
      }
    }
  }

  // 2) Temu embedded data
  if (!product.nameEn) {
    const namePatterns = [
      /"goodsName"\s*:\s*"([^"]+)"/,
      /"goods_name"\s*:\s*"([^"]+)"/,
    ];
    for (const p of namePatterns) {
      const m = html.match(p);
      if (m) {
        product.nameEn = m[1];
        break;
      }
    }
  }

  // 3) Price from embedded patterns
  if (!product.price) {
    const pricePatterns = [
      /"minGroupPrice"\s*:\s*"?([\d.]+)"?/,
      /"salePrice"\s*:\s*"?([\d.]+)"?/,
      /"price"\s*:\s*"?([\d.]+)"?\s*[,}]/,
      /"groupPrice"\s*:\s*"?([\d.]+)"?/,
    ];
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        product.price = parseFloat(m[1]) || 0;
        product.supplierPrice = product.price;
        break;
      }
    }
  }

  // 4) Temu CDN images
  if (product.images.length === 0) {
    const temuImgRegex =
      /["'](https?:\/\/img\.kwcdn\.com[^"'\s]+\.(?:jpg|jpeg|png|webp))[^"']*/gi;
    let m;
    const seen = new Set<string>();
    while ((m = temuImgRegex.exec(html)) !== null) {
      const imgUrl = m[1].replace(/_thumbnail_\d+x\d*/, "");
      if (!seen.has(imgUrl)) {
        seen.add(imgUrl);
        product.images.push(imgUrl);
      }
      if (product.images.length >= 10) break;
    }
  }

  // 5) OG tags
  if (!product.nameEn)
    product.nameEn = parseMetaTag(html, "og:title")
      .replace(/\s*[-|]\s*Temu.*$/i, "")
      .trim();
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

  // 6) Name from URL slug fallback
  if (!product.nameEn) {
    const urlName = extractTemuNameFromUrl(url);
    if (urlName) {
      product.nameEn = urlName;
      console.log(
        "[Scraper] Temu: Using name from URL:",
        urlName.substring(0, 50),
      );
    }
  }
  if (!product.nameEn) {
    product.nameEn = getTitleFromHtml(html)
      .replace(/\s*[-|]\s*Temu.*$/i, "")
      .trim();
  }

  product.name = product.nameEn;

  console.log("[Scraper] Final Temu result:", {
    name: product.name?.substring(0, 50),
    price: product.price,
    images: product.images.length,
  });

  return product;
}

// ==================== eBay Parser ====================

function parseEbay(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: url,
    supplierName: "eBay",
  };

  console.log("[Scraper] Parsing eBay HTML, length:", html.length);

  // 1) JSON-LD — eBay usually provides good structured data
  const jsonLd = findProductInJsonLd(parseJsonLd(html));
  if (jsonLd) {
    console.log("[Scraper] eBay: Found JSON-LD data");
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
      product.price =
        parseFloat(offer?.price) || parseFloat(offer?.lowPrice) || 0;
      product.supplierPrice = product.price;
      if (offer?.highPrice) {
        const v = parseFloat(offer.highPrice);
        if (v > product.price) product.oldPrice = v;
      }
    }
  }

  // 2) eBay-specific title
  if (!product.nameEn) {
    const titlePatterns = [
      /<h1[^>]*class=["'][^"']*x-item-title__mainTitle[^"']*["'][^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)/i,
      /<h1[^>]*id=["']itemTitle["'][^>]*>[\s\S]*?([^<]{10,})/i,
      /<span[^>]*class=["']ux-textspanner--BOLD["'][^>]*>\s*([^<]+)/i,
    ];
    for (const p of titlePatterns) {
      const m = html.match(p);
      if (m) {
        product.nameEn = decodeHtmlEntities(m[1].trim());
        break;
      }
    }
  }

  // 3) eBay price
  if (!product.price) {
    const pricePatterns = [
      /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,
      /"price"\s*:\s*"?([\d,.]+)"?\s*[,}]/,
      /class=["'][^"']*x-price-primary[^"']*["'][^>]*>[\s\S]*?([\d,.]+)/i,
      /id=["']prcIsum["'][^>]*>[^<]*?([\d,.]+)/i,
    ];
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        product.price = parseFloat(m[1].replace(/,/g, "")) || 0;
        product.supplierPrice = product.price;
        break;
      }
    }
  }

  // 4) eBay images from CDN
  if (product.images.length === 0) {
    const ebayImgRegex =
      /["'](https?:\/\/i\.ebayimg\.com\/images\/g\/[^"'\s]+\.(?:jpg|jpeg|png|webp))[^"']*/gi;
    let m;
    const seen = new Set<string>();
    while ((m = ebayImgRegex.exec(html)) !== null) {
      const imgUrl = m[1].replace(/\/s-l\d+\./, "/s-l1600."); // Full-res
      if (!seen.has(imgUrl)) {
        seen.add(imgUrl);
        product.images.push(imgUrl);
      }
      if (product.images.length >= 10) break;
    }
  }

  // 5) OG tags
  if (!product.nameEn)
    product.nameEn = parseMetaTag(html, "og:title")
      .replace(/\s*[-|]\s*eBay.*$/i, "")
      .trim();
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
  if (!product.nameEn) {
    product.nameEn = getTitleFromHtml(html)
      .replace(/\s*[-|]\s*eBay.*$/i, "")
      .trim();
  }

  product.name = product.nameEn;

  console.log("[Scraper] Final eBay result:", {
    name: product.name?.substring(0, 50),
    price: product.price,
    images: product.images.length,
  });

  return product;
}

// ==================== Alibaba Parser ====================

function parseAlibaba(html: string, url: string): ScrapedProduct {
  const product: ScrapedProduct = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    images: [],
    supplierUrl: url,
    supplierName: "Alibaba",
  };

  console.log("[Scraper] Parsing Alibaba HTML, length:", html.length);

  // 1) JSON-LD
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
      product.price =
        parseFloat(offer?.price) || parseFloat(offer?.lowPrice) || 0;
      product.supplierPrice = product.price;
      if (offer?.highPrice) {
        const v = parseFloat(offer.highPrice);
        if (v > product.price) product.oldPrice = v;
      }
    }
  }

  // 2) Embedded data
  if (!product.nameEn) {
    const namePatterns = [
      /"subject"\s*:\s*"([^"]+)"/,
      /"productTitle"\s*:\s*"([^"]+)"/,
      /"title"\s*:\s*"([^"]{10,200})"/,
    ];
    for (const p of namePatterns) {
      const m = html.match(p);
      if (m) {
        product.nameEn = m[1];
        break;
      }
    }
  }

  if (!product.price) {
    const pricePatterns = [
      /"price"\s*:\s*"?([\d.]+)"?\s*[,}]/,
      /"tradePrice"\s*:\s*"?([\d.]+)"?/,
      /"ladderPrice"\s*:\s*"?([\d.]+)"?/,
      /"originalPrice"\s*:\s*"?([\d.]+)"?/,
      /US\s*\$\s*([\d,.]+)/i,
    ];
    for (const p of pricePatterns) {
      const m = html.match(p);
      if (m) {
        product.price = parseFloat(m[1].replace(/,/g, "")) || 0;
        product.supplierPrice = product.price;
        break;
      }
    }
  }

  // 3) Alibaba CDN images
  if (product.images.length === 0) {
    const alibabaImgRegex =
      /["'](https?:\/\/[^"'\s]*(?:sc04|sc01|s\.alicdn)\.com[^"'\s]*\.(?:jpg|jpeg|png|webp))[^"']*/gi;
    let m;
    const seen = new Set<string>();
    while ((m = alibabaImgRegex.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        product.images.push(m[1]);
      }
      if (product.images.length >= 10) break;
    }
  }

  // 4) OG tags
  if (!product.nameEn)
    product.nameEn = parseMetaTag(html, "og:title")
      .replace(/\s*[-|]\s*Alibaba.*$/i, "")
      .trim();
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
  if (!product.nameEn) {
    product.nameEn = getTitleFromHtml(html)
      .replace(/\s*[-|]\s*Alibaba.*$/i, "")
      .trim();
  }

  // Detect 1688.com
  if (/1688\.com/i.test(url)) product.supplierName = "1688";

  product.name = product.nameEn;

  console.log("[Scraper] Final Alibaba result:", {
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
  const site = getSiteName(url);
  console.log(`[Scraper] Starting scrape for ${site}:`, url);

  let html: string;

  // Use site-specific fetching strategies
  if (isSheinUrl(url)) {
    html = await fetchSheinWithFallback(url);
  } else {
    html = await fetchWithProxy(url);
  }

  if (!html || html.length < 100) {
    throw new Error("تعذّر جلب بيانات المنتج من هذا الرابط");
  }

  let result: ScrapedProduct;

  if (isAliExpressUrl(url)) {
    result = parseAliExpress(html, url);
  } else if (isAmazonUrl(url)) {
    result = parseAmazon(html, url);
  } else if (isSheinUrl(url)) {
    result = parseShein(html, url);

    // SHEIN pages are JS-rendered so price extraction from HTML is unreliable.
    // The form will open for manual review when price is missing.
    if (!result.price) {
      console.log(
        "[Scraper] SHEIN: Could not extract price automatically. Will open form for manual entry.",
      );
    }
  } else if (isNoonUrl(url)) {
    result = parseNoon(html, url);
  } else if (isTemuUrl(url)) {
    result = parseTemu(html, url);
  } else if (isEbayUrl(url)) {
    result = parseEbay(html, url);
  } else if (isAlibabaUrl(url)) {
    result = parseAlibaba(html, url);
  } else {
    result = parseGeneric(html, url);
  }

  if (!result.name && !result.nameEn) {
    throw new Error(
      `لم يتم العثور على بيانات منتج من ${site}. قد يكون الموقع يحظر الوصول التلقائي.`,
    );
  }

  return result;
}
