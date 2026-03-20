"use strict";
/**
 * Amazon Product Scraper - Professional Edition
 * سكرابر احترافي لأمازون يدعم:
 * - Amazon.sa, Amazon.ae, Amazon.com, Amazon.co.uk وغيرها
 * - استخراج من JavaScript embedded data
 * - Headers متقدمة تحاكي المتصفح
 * - عدة محاولات مع domains مختلفة
 * - استخدام خدمات scraping خارجية كـ fallback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeAmazonProduct = scrapeAmazonProduct;
exports.scrapeAmazonWithApi = scrapeAmazonWithApi;
// ==================== Helper Functions ====================
function decodeHtmlEntities(text) {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, "/")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\/g, "");
}
function cleanText(text) {
    return decodeHtmlEntities(text)
        .replace(/\s+/g, " ")
        .trim();
}
function extractAsin(url) {
    // Match /dp/ASIN or /gp/product/ASIN or /gp/aw/d/ASIN
    const patterns = [
        /\/dp\/([A-Z0-9]{10})/i,
        /\/gp\/product\/([A-Z0-9]{10})/i,
        /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
        /\/product\/([A-Z0-9]{10})/i,
        /[?&]ASIN=([A-Z0-9]{10})/i,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m)
            return m[1];
    }
    return null;
}
function detectAmazonDomain(url) {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes(".sa"))
        return { domain: "amazon.sa", region: "Saudi Arabia", currency: "SAR" };
    if (host.includes(".ae"))
        return { domain: "amazon.ae", region: "UAE", currency: "AED" };
    if (host.includes(".eg"))
        return { domain: "amazon.eg", region: "Egypt", currency: "EGP" };
    if (host.includes(".co.uk"))
        return { domain: "amazon.co.uk", region: "UK", currency: "GBP" };
    if (host.includes(".de"))
        return { domain: "amazon.de", region: "Germany", currency: "EUR" };
    if (host.includes(".fr"))
        return { domain: "amazon.fr", region: "France", currency: "EUR" };
    if (host.includes(".es"))
        return { domain: "amazon.es", region: "Spain", currency: "EUR" };
    if (host.includes(".it"))
        return { domain: "amazon.it", region: "Italy", currency: "EUR" };
    if (host.includes(".co.jp"))
        return { domain: "amazon.co.jp", region: "Japan", currency: "JPY" };
    if (host.includes(".in"))
        return { domain: "amazon.in", region: "India", currency: "INR" };
    if (host.includes(".com.au"))
        return { domain: "amazon.com.au", region: "Australia", currency: "AUD" };
    if (host.includes(".com.br"))
        return { domain: "amazon.com.br", region: "Brazil", currency: "BRL" };
    if (host.includes(".com.mx"))
        return { domain: "amazon.com.mx", region: "Mexico", currency: "MXN" };
    if (host.includes(".ca"))
        return { domain: "amazon.ca", region: "Canada", currency: "CAD" };
    return { domain: "amazon.com", region: "USA", currency: "USD" };
}
function amazonFullResUrl(url) {
    if (!url)
        return "";
    // Remove Amazon sizing suffixes to get full resolution
    // ._AC_SX300_.jpg → ._AC_SL1500_.jpg
    return url
        .replace(/\._[A-Z]{2}_[A-Z]{2}\d+_\./, "._AC_SL1500_.")
        .replace(/\._[A-Z]{2}_\d+_\./, "._AC_SL1500_.")
        .replace(/\._S[XYL]\d+_\./, "._AC_SL1500_.")
        .replace(/\._U[LSXFY]\d+[_,]?\d*_\./, "._AC_SL1500_.");
}
// ==================== Advanced Headers ====================
function getAmazonHeaders(domain) {
    // Real Chrome browser headers
    const acceptLanguage = domain.includes(".sa") || domain.includes(".ae") || domain.includes(".eg")
        ? "ar,en-US;q=0.9,en;q=0.8"
        : "en-US,en;q=0.9";
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": acceptLanguage,
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Connection": "keep-alive",
        "DNT": "1",
    };
}
// ==================== Data Extraction Functions ====================
/**
 * Extract product title from multiple sources
 */
function extractTitle(html) {
    const patterns = [
        // Standard product title
        /<span[^>]*id=["']productTitle["'][^>]*>\s*([^<]+)/i,
        // Title in h1
        /<h1[^>]*id=["']title["'][^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)/i,
        // Title wrapper
        /<div[^>]*id=["']titleSection["'][^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)/i,
        // Mobile title
        /<h1[^>]*class=["'][^"']*a-size-large[^"']*["'][^>]*>\s*([^<]+)/i,
        // Embedded JSON title
        /"title"\s*:\s*"([^"]{15,300})"/,
        // Product name in data
        /"productName"\s*:\s*"([^"]+)"/,
        // Title attribute
        /<a[^>]*id=["']title["'][^>]*title=["']([^"']+)["']/i,
    ];
    for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1]) {
            const title = cleanText(m[1]);
            if (title.length > 10 && !title.includes("Amazon") && !title.includes("<!")) {
                return title;
            }
        }
    }
    // OG title fallback
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch) {
        return cleanText(ogMatch[1]).replace(/\s*[-:|]\s*Amazon.*$/i, "").trim();
    }
    // Title tag fallback
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        return cleanText(titleMatch[1]).replace(/\s*[-:|:]\s*Amazon.*$/i, "").trim();
    }
    return "";
}
/**
 * Extract price from multiple sources
 */
function extractPrice(html) {
    let price = 0;
    let oldPrice;
    // Price patterns (order by reliability)
    const pricePatterns = [
        // Core price display - most reliable
        /class=["']a-price[^"']*["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*([^<]+)/gi,
        // Apex price (deal page)
        /class=["']apexPriceToPay["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*([^<]+)/i,
        // Price in JSON data
        /"priceAmount"\s*:\s*"?([\d,.]+)"?/,
        /"price"\s*:\s*"?([\d,.]+)"?\s*[,}]/,
        // Deal price
        /id=["']priceblock_dealprice["'][^>]*>\s*([^<]+)/i,
        /id=["']priceblock_ourprice["'][^>]*>\s*([^<]+)/i,
        /id=["']priceblock_saleprice["'][^>]*>\s*([^<]+)/i,
        // Core price with currency
        /class=["']priceToPay["'][^>]*>[\s\S]*?<span[^>]*class=["']a-price-whole["'][^>]*>\s*([^<]+)/i,
        // Whole + fraction
        /class=["']a-price-whole["'][^>]*>([\d,]+)[^<]*<[\s\S]*?class=["']a-price-fraction["'][^>]*>(\d+)/i,
        // With currency symbols
        /(?:SAR|AED|USD|EUR|GBP|EGP|ر\.س|د\.إ|جنيه)\s*([\d,]+(?:\.\d{2})?)/i,
        />\s*([\d,]+(?:\.\d{2})?)\s*(?:SAR|AED|USD|EUR|GBP|EGP|ر\.س|د\.إ|جنيه)/i,
    ];
    // Find all prices and take the first valid one
    for (const p of pricePatterns) {
        const matches = html.matchAll(p);
        for (const m of matches) {
            let priceStr = m[1];
            // Handle whole + fraction pattern
            if (m[2])
                priceStr = m[1].replace(/,/g, "") + "." + m[2];
            // Clean and parse
            const cleanPrice = priceStr.replace(/[^\d.,]/g, "").replace(/,/g, "");
            const val = parseFloat(cleanPrice);
            if (val > 0 && val < 1000000) { // Sanity check
                price = val;
                break;
            }
        }
        if (price > 0)
            break;
    }
    // Old price patterns
    if (price > 0) {
        const oldPricePatterns = [
            /class=["']a-text-price["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*([^<]+)/i,
            /class=["']basisPrice["'][^>]*>[\s\S]*?<span[^>]*class=["']a-offscreen["'][^>]*>\s*([^<]+)/i,
            /class=["']a-price\s+a-text-price["'][^>]*>[\s\S]*?<span[^>]*>\s*([^<]+)/i,
            /"listPrice"\s*:\s*"?([^"]+)"?/,
            /id=["']listPrice["'][^>]*>\s*([^<]+)/i,
        ];
        for (const p of oldPricePatterns) {
            const m = html.match(p);
            if (m) {
                const cleanPrice = m[1].replace(/[^\d.,]/g, "").replace(/,/g, "");
                const val = parseFloat(cleanPrice);
                if (val > price) {
                    oldPrice = val;
                    break;
                }
            }
        }
    }
    return { price, oldPrice };
}
/**
 * Extract images from multiple sources
 */
function extractImages(html) {
    const images = [];
    const seen = new Set();
    const addImage = (url) => {
        if (!url || url.includes("sprite") || url.includes("icon") || url.includes("transparent"))
            return;
        const fullUrl = amazonFullResUrl(url);
        if (fullUrl && !seen.has(fullUrl) && fullUrl.includes("media-amazon.com")) {
            seen.add(fullUrl);
            images.push(fullUrl);
        }
    };
    // 1) colorImages JSON (most reliable for galleries)
    const colorImagesPatterns = [
        /'colorImages'\s*:\s*\{[^}]*'initial'\s*:\s*(\[[\s\S]*?\])\s*\}/,
        /"colorImages"\s*:\s*\{[^}]*"initial"\s*:\s*(\[[\s\S]*?\])\s*\}/,
    ];
    for (const p of colorImagesPatterns) {
        const m = html.match(p);
        if (m) {
            try {
                const arr = JSON.parse(m[1].replace(/'/g, '"'));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                arr.forEach((img) => {
                    addImage(img.hiRes || img.large || img.mainUrl || img.thumb || "");
                });
                if (images.length > 0)
                    break;
            }
            catch ( /* continue */_a) { /* continue */ }
        }
    }
    // 2) imageGalleryData
    if (images.length === 0) {
        const galleryMatch = html.match(/"imageGalleryData"\s*:\s*(\[[\s\S]*?\])/);
        if (galleryMatch) {
            try {
                const arr = JSON.parse(galleryMatch[1]);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                arr.forEach((img) => {
                    addImage(img.mainUrl || img.thumbUrl || "");
                });
            }
            catch ( /* continue */_b) { /* continue */ }
        }
    }
    // 3) Main landing image
    if (images.length === 0) {
        const mainImgPatterns = [
            /<img[^>]*id=["']landingImage["'][^>]*(?:src|data-old-hires|data-a-dynamic-image)=["']([^"']+)["']/i,
            /<img[^>]*id=["']imgBlkFront["'][^>]*src=["']([^"']+)["']/i,
            /<img[^>]*class=["'][^"']*a-dynamic-image[^"']*["'][^>]*src=["']([^"']+)["']/i,
        ];
        for (const p of mainImgPatterns) {
            const m = html.match(p);
            if (m) {
                // Handle data-a-dynamic-image JSON
                if (m[1].startsWith("{")) {
                    try {
                        const imgObj = JSON.parse(m[1].replace(/&quot;/g, '"'));
                        const urls = Object.keys(imgObj);
                        urls.forEach(addImage);
                    }
                    catch ( /* continue */_c) { /* continue */ }
                }
                else {
                    addImage(m[1]);
                }
                if (images.length > 0)
                    break;
            }
        }
    }
    // 4) Search for all Amazon CDN images
    if (images.length === 0) {
        const cdnRegex = /["'](https?:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9+_.-]+\.(?:jpg|jpeg|png|webp))["']/gi;
        let m;
        while ((m = cdnRegex.exec(html)) !== null && images.length < 10) {
            addImage(m[1]);
        }
    }
    // 5) OG image fallback
    if (images.length === 0) {
        const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        if (ogMatch)
            addImage(ogMatch[1]);
    }
    return images.slice(0, 10);
}
/**
 * Extract description and features
 */
function extractDescription(html) {
    const features = [];
    let description = "";
    // Feature bullets
    const featureRegex = /<span[^>]*class=["']a-list-item["'][^>]*>\s*([^<]+(?:<[^>]+>[^<]*)*)/gi;
    const bulletSection = html.match(/<div[^>]*id=["']feature-bullets["'][^>]*>([\s\S]*?)<\/div>/i);
    if (bulletSection) {
        let m;
        while ((m = featureRegex.exec(bulletSection[1])) !== null && features.length < 8) {
            const text = cleanText(m[1].replace(/<[^>]+>/g, ""));
            if (text.length > 10 && !text.includes("Make sure") && !text.includes("Click here")) {
                features.push(text);
            }
        }
    }
    // Product description
    const descPatterns = [
        /<div[^>]*id=["']productDescription["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
        /<div[^>]*id=["']productDescription_feature_div["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
        /<meta[^>]*(?:property|name)=["'](?:og:description|description)["'][^>]*content=["']([^"']+)["']/i,
    ];
    for (const p of descPatterns) {
        const m = html.match(p);
        if (m) {
            const text = cleanText(m[1].replace(/<[^>]+>/g, ""));
            if (text.length > 30) {
                description = text;
                break;
            }
        }
    }
    // Fallback: use features as description
    if (!description && features.length > 0) {
        description = features.join(" • ");
    }
    return { description, features };
}
/**
 * Extract brand and other details
 */
function extractBrand(html) {
    const patterns = [
        /id=["']bylineInfo["'][^>]*>[\s\S]*?([^<>]+)<\/a>/i,
        /"brand"\s*:\s*"([^"]+)"/i,
        /class=["']author[^"']*["'][^>]*>[\s\S]*?([^<>]+)<\/a>/i,
        /<a[^>]*id=["']brand["'][^>]*>\s*([^<]+)/i,
    ];
    for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1]) {
            const brand = cleanText(m[1]).replace(/^Visit the /, "").replace(/ Store$/, "");
            if (brand.length > 1 && brand.length < 100) {
                return brand;
            }
        }
    }
    return "";
}
/**
 * Extract rating
 */
function extractRating(html) {
    let rating = 0;
    let reviewCount = 0;
    // Rating
    const ratingPatterns = [
        /class=["']a-icon-alt["'][^>]*>\s*([\d.]+)\s*out of\s*5/i,
        /class=["']a-icon-alt["'][^>]*>\s*([\d.]+)\s*من\s*5/i,
        /"ratingValue"\s*:\s*"?([\d.]+)"?/,
    ];
    for (const p of ratingPatterns) {
        const m = html.match(p);
        if (m) {
            rating = parseFloat(m[1]) || 0;
            break;
        }
    }
    // Review count
    const countPatterns = [
        /id=["']acrCustomerReviewText["'][^>]*>\s*([\d,]+)/,
        /"reviewCount"\s*:\s*"?([\d,]+)"?/,
        /(\d[\d,]*)\s*(?:ratings|reviews|تقييم)/i,
    ];
    for (const p of countPatterns) {
        const m = html.match(p);
        if (m) {
            reviewCount = parseInt(m[1].replace(/,/g, ""), 10) || 0;
            break;
        }
    }
    return { rating, reviewCount };
}
/**
 * Extract product specifications
 */
function extractSpecs(html) {
    const specs = {};
    // Product details table
    const tablePatterns = [
        /<table[^>]*id=["']productDetails[^"']*["'][^>]*>([\s\S]*?)<\/table>/i,
        /<table[^>]*class=["'][^"']*prodDetTable[^"']*["'][^>]*>([\s\S]*?)<\/table>/i,
    ];
    for (const tp of tablePatterns) {
        const tableMatch = html.match(tp);
        if (tableMatch) {
            const rowRegex = /<tr[^>]*>[\s\S]*?<t[hd][^>]*>([^<]+)<\/t[hd]>[\s\S]*?<t[hd][^>]*>([^<]+)<\/t[hd]>/gi;
            let m;
            while ((m = rowRegex.exec(tableMatch[1])) !== null) {
                const key = cleanText(m[1]);
                const value = cleanText(m[2]);
                if (key && value && key.length < 100 && value.length < 500) {
                    specs[key] = value;
                }
            }
        }
    }
    // Technical details
    const techMatch = html.match(/<div[^>]*id=["']tech[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (techMatch) {
        const itemRegex = /<span[^>]*class=["'][^"']*a-text-bold[^"']*["'][^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi;
        let m;
        while ((m = itemRegex.exec(techMatch[1])) !== null) {
            const key = cleanText(m[1]);
            const value = cleanText(m[2]);
            if (key && value) {
                specs[key] = value;
            }
        }
    }
    return specs;
}
// ==================== Main Scraping Function ====================
/**
 * Fetch Amazon page with retries and different strategies
 */
async function fetchAmazonPage(url) {
    const asin = extractAsin(url);
    const { domain } = detectAmazonDomain(url);
    // URLs to try (in order of preference)
    const urlsToTry = [];
    // Original URL
    urlsToTry.push(url);
    // Clean DP URL
    if (asin) {
        urlsToTry.push(`https://www.${domain}/dp/${asin}`);
        // Mobile version (sometimes less protected)
        urlsToTry.push(`https://www.${domain}/gp/aw/d/${asin}`);
    }
    // US Amazon fallback for international ASINs
    if (asin && !domain.includes("amazon.com")) {
        urlsToTry.push(`https://www.amazon.com/dp/${asin}`);
    }
    // Remove duplicates
    const uniqueUrls = [...new Set(urlsToTry)];
    for (const tryUrl of uniqueUrls) {
        try {
            console.log(`[Amazon Scraper] Trying: ${tryUrl}`);
            const headers = getAmazonHeaders(domain);
            const response = await fetch(tryUrl, {
                headers,
                redirect: "follow",
            });
            if (!response.ok) {
                console.log(`[Amazon Scraper] HTTP ${response.status} from ${tryUrl}`);
                continue;
            }
            const html = await response.text();
            console.log(`[Amazon Scraper] Got ${html.length} chars from ${tryUrl}`);
            // Check for blocking/captcha
            if (html.includes("api-services-support@amazon.com") ||
                html.includes("Enter the characters you see below") ||
                html.includes("Type the characters you see in this image") ||
                html.length < 5000) {
                console.log(`[Amazon Scraper] Blocked or captcha at ${tryUrl}`);
                continue;
            }
            // Verify it's a product page
            if (!html.includes("productTitle") && !html.includes("dp/") && !html.includes("a-price")) {
                console.log(`[Amazon Scraper] Not a product page at ${tryUrl}`);
                continue;
            }
            return html;
        }
        catch (error) {
            console.log(`[Amazon Scraper] Error fetching ${tryUrl}:`, error);
            continue;
        }
    }
    throw new Error("تعذر الوصول لصفحة المنتج في أمازون. حاول مرة أخرى أو استخدم رابط آخر.");
}
/**
 * Main function to scrape Amazon product
 */
async function scrapeAmazonProduct(url) {
    const asin = extractAsin(url);
    const { domain, region, currency } = detectAmazonDomain(url);
    console.log(`[Amazon Scraper] Starting scrape for ASIN: ${asin}, Domain: ${domain}`);
    // Fetch the page
    const html = await fetchAmazonPage(url);
    // Extract all data
    const title = extractTitle(html);
    const { price, oldPrice } = extractPrice(html);
    const images = extractImages(html);
    const { description, features } = extractDescription(html);
    const brand = extractBrand(html);
    const { rating, reviewCount } = extractRating(html);
    const specs = extractSpecs(html);
    console.log(`[Amazon Scraper] Extracted:`, {
        title: title === null || title === void 0 ? void 0 : title.substring(0, 50),
        price,
        images: images.length,
        brand,
        features: features.length,
    });
    // Validate minimum data
    if (!title && images.length === 0) {
        throw new Error("لم يتم العثور على بيانات المنتج. قد يكون الرابط غير صحيح أو المنتج غير متوفر.");
    }
    // Build supplier name
    let supplierName = `Amazon.${domain.split(".").pop()}`;
    if (region === "Saudi Arabia")
        supplierName = "Amazon.sa";
    else if (region === "UAE")
        supplierName = "Amazon.ae";
    else if (region === "USA")
        supplierName = "Amazon.com";
    // Build clean URL
    const cleanUrl = asin ? `https://www.${domain}/dp/${asin}` : url;
    return {
        name: title,
        nameEn: title,
        description: description || features.join(" • "),
        price,
        oldPrice,
        images,
        supplierUrl: cleanUrl,
        supplierName,
        supplierPrice: price,
        asin: asin || undefined,
        brand,
        rating,
        reviewCount,
        specs: Object.keys(specs).length > 0 ? specs : undefined,
        features: features.length > 0 ? features : undefined,
    };
}
/**
 * Alternative: Use ScraperAPI for better success rate (requires API key)
 * This is a fallback if direct scraping fails
 */
async function scrapeAmazonWithApi(url, apiKey) {
    if (!apiKey) {
        // If no API key, just try direct scraping
        return scrapeAmazonProduct(url);
    }
    try {
        // Try ScraperAPI
        const scraperApiUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true&country_code=us`;
        console.log(`[Amazon Scraper] Using ScraperAPI for: ${url}`);
        const response = await fetch(scraperApiUrl);
        if (!response.ok) {
            throw new Error(`ScraperAPI returned ${response.status}`);
        }
        const html = await response.text();
        // Parse the HTML same as before
        const title = extractTitle(html);
        const { price, oldPrice } = extractPrice(html);
        const images = extractImages(html);
        const { description, features } = extractDescription(html);
        const brand = extractBrand(html);
        const { rating, reviewCount } = extractRating(html);
        const specs = extractSpecs(html);
        const asin = extractAsin(url);
        const { domain } = detectAmazonDomain(url);
        return {
            name: title,
            nameEn: title,
            description: description || features.join(" • "),
            price,
            oldPrice,
            images,
            supplierUrl: asin ? `https://www.${domain}/dp/${asin}` : url,
            supplierName: `Amazon.${domain.split(".").pop()}`,
            supplierPrice: price,
            asin: asin || undefined,
            brand,
            rating,
            reviewCount,
            specs: Object.keys(specs).length > 0 ? specs : undefined,
            features: features.length > 0 ? features : undefined,
        };
    }
    catch (error) {
        console.log(`[Amazon Scraper] ScraperAPI failed, falling back to direct:`, error);
        return scrapeAmazonProduct(url);
    }
}
//# sourceMappingURL=amazonScraper.js.map