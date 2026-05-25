"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.wcApi = void 0;
/**
 * WooCommerce-Compatible REST API for m5azn integration
 * ====================================================
 * m5azn uses the WooCommerce REST API v3 protocol to sync products,
 * stock, and orders. This function emulates the relevant endpoints
 * against our Firestore data.
 *
 * Public URL after deploy:
 *   https://<region>-<project>.cloudfunctions.net/wcApi/wp-json/wc/v3/...
 *
 * Also reachable via Firebase Hosting rewrite at:
 *   https://<your-domain>/wp-json/wc/v3/...
 *
 * Auth (WooCommerce standard):
 *   - HTTP Basic:   Authorization: Basic base64(consumer_key:consumer_secret)
 *   - Query string: ?consumer_key=ck_...&consumer_secret=cs_...
 *
 * Keys are generated from the dashboard and stored at:
 *   settings/wooKeys  { consumerKey, consumerSecretHash, enabled, ... }
 *
 * Implemented endpoints (subset m5azn needs):
 *   GET    /wp-json/wc/v3/                          - root (returns namespaces)
 *   GET    /wp-json/wc/v3/system_status             - returns minimal store info
 *   GET    /wp-json/wc/v3/products                  - list products
 *   GET    /wp-json/wc/v3/products/:id              - single product
 *   POST   /wp-json/wc/v3/products                  - create product
 *   PUT    /wp-json/wc/v3/products/:id              - update product
 *   DELETE /wp-json/wc/v3/products/:id              - delete product
 *   GET    /wp-json/wc/v3/products/categories       - list categories
 *   POST   /wp-json/wc/v3/products/categories       - create category
 *   GET    /wp-json/wc/v3/orders                    - list orders
 *   GET    /wp-json/wc/v3/orders/:id                - single order
 *   PUT    /wp-json/wc/v3/orders/:id                - update order (status/tracking)
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const KEYS_DOC = "settings/wooKeys";
// ---------- Helpers ----------
function sha256(s) {
    return (0, crypto_1.createHash)("sha256").update(s).digest("hex");
}
function safeEqual(a, b) {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(ba, bb);
}
function sendJson(res, status, body) {
    res.set("Content-Type", "application/json; charset=utf-8");
    res.set("Access-Control-Allow-Origin", "*");
    res.status(status).send(JSON.stringify(body));
}
function parseBody(req) {
    if (!req.body)
        return {};
    if (typeof req.body === "string") {
        try {
            return JSON.parse(req.body);
        }
        catch (_a) {
            return {};
        }
    }
    return req.body;
}
function extractCreds(req) {
    // 1) Basic Auth
    const authHeader = req.get("Authorization") || req.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("basic ")) {
        try {
            const decoded = Buffer.from(authHeader.slice(6).trim(), "base64").toString("utf8");
            const idx = decoded.indexOf(":");
            if (idx > 0) {
                return { key: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
            }
        }
        catch ( /* ignore */_a) { /* ignore */ }
    }
    // 2) Query params
    const qKey = req.query.consumer_key || "";
    const qSecret = req.query.consumer_secret || "";
    if (qKey && qSecret)
        return { key: qKey, secret: qSecret };
    return null;
}
async function authenticate(req) {
    const creds = extractCreds(req);
    if (!creds)
        return { ok: false, reason: "Missing consumer_key / consumer_secret" };
    const snap = await admin.firestore().doc(KEYS_DOC).get();
    if (!snap.exists)
        return { ok: false, reason: "Integration not configured" };
    const data = snap.data();
    if (data.enabled === false)
        return { ok: false, reason: "Integration disabled" };
    if (!data.consumerKey || !data.consumerSecretHash) {
        return { ok: false, reason: "Keys not generated yet" };
    }
    if (!safeEqual(creds.key, data.consumerKey)) {
        return { ok: false, reason: "Invalid consumer_key" };
    }
    if (!safeEqual(sha256(creds.secret), data.consumerSecretHash)) {
        return { ok: false, reason: "Invalid consumer_secret" };
    }
    return { ok: true };
}
// ---------- Field mappers ----------
function toIsoString(v) {
    if (!v)
        return new Date().toISOString();
    // Firestore Timestamp-like
    const anyV = v;
    if (typeof (anyV === null || anyV === void 0 ? void 0 : anyV.toDate) === "function")
        return anyV.toDate().toISOString();
    if (typeof (anyV === null || anyV === void 0 ? void 0 : anyV.seconds) === "number")
        return new Date(anyV.seconds * 1000).toISOString();
    if (v instanceof Date)
        return v.toISOString();
    if (typeof v === "string")
        return v;
    return new Date().toISOString();
}
function productToWoo(id, p) {
    var _a, _b, _c, _d, _e;
    const price = Number((_a = p.price) !== null && _a !== void 0 ? _a : 0);
    const regular = Number((_c = (_b = p.oldPrice) !== null && _b !== void 0 ? _b : p.price) !== null && _c !== void 0 ? _c : 0);
    const stock = Number((_d = p.stock) !== null && _d !== void 0 ? _d : 0);
    const images = (p.images || []).map((src, i) => ({
        id: i + 1,
        src,
        name: p.name || "",
        alt: p.nameEn || p.name || "",
    }));
    const categories = p.category
        ? [{ id: 0, name: String(p.category), slug: String(p.category) }]
        : [];
    return {
        id,
        name: p.name || p.nameEn || "",
        slug: (p.nameEn || p.name || "").toString().toLowerCase().replace(/\s+/g, "-"),
        permalink: "",
        date_created: toIsoString(p.createdAt),
        date_created_gmt: toIsoString(p.createdAt),
        date_modified: toIsoString(p.updatedAt),
        date_modified_gmt: toIsoString(p.updatedAt),
        type: "simple",
        status: "publish",
        featured: !!p.featured,
        catalog_visibility: "visible",
        description: p.description || "",
        short_description: p.description || "",
        sku: p.sku || id,
        price: String(price),
        regular_price: String(regular || price),
        sale_price: price < regular ? String(price) : "",
        on_sale: price < regular,
        purchasable: stock > 0,
        total_sales: 0,
        virtual: false,
        downloadable: false,
        tax_status: "taxable",
        tax_class: "",
        manage_stock: true,
        stock_quantity: stock,
        stock_status: stock > 0 ? "instock" : "outofstock",
        backorders: "no",
        weight: "",
        dimensions: { length: "", width: "", height: "" },
        shipping_required: true,
        shipping_taxable: true,
        shipping_class: "",
        shipping_class_id: 0,
        reviews_allowed: true,
        average_rating: "0",
        rating_count: 0,
        related_ids: [],
        upsell_ids: [],
        cross_sell_ids: [],
        parent_id: 0,
        purchase_note: "",
        categories,
        tags: [],
        images,
        attributes: [],
        default_attributes: [],
        variations: [],
        grouped_products: [],
        menu_order: 0,
        meta_data: [
            { id: 1, key: "supplier_price", value: (_e = p.supplierPrice) !== null && _e !== void 0 ? _e : null },
        ],
    };
}
function wooToProduct(body) {
    const out = {};
    if (typeof body.name === "string")
        out.name = body.name;
    if (typeof body.description === "string")
        out.description = body.description;
    if (typeof body.short_description === "string" && !out.description) {
        out.description = body.short_description;
    }
    if (body.regular_price != null)
        out.oldPrice = Number(body.regular_price);
    if (body.sale_price != null && body.sale_price !== "")
        out.price = Number(body.sale_price);
    else if (body.price != null)
        out.price = Number(body.price);
    if (body.stock_quantity != null)
        out.stock = Number(body.stock_quantity);
    if (typeof body.sku === "string")
        out.sku = body.sku;
    if (typeof body.featured === "boolean")
        out.featured = body.featured;
    if (Array.isArray(body.images)) {
        out.images = body.images
            .map((img) => (typeof img === "string" ? img : img.src || ""))
            .filter(Boolean);
    }
    if (Array.isArray(body.categories) && body.categories.length > 0) {
        const c = body.categories[0];
        out.category = c.name || c.slug || "";
    }
    return out;
}
function statusToWoo(s) {
    switch ((s || "").toLowerCase()) {
        case "pending": return "pending";
        case "processing": return "processing";
        case "shipped": return "on-hold"; // أقرب مكافئ
        case "delivered": return "completed";
        case "cancelled": return "cancelled";
        default: return s || "pending";
    }
}
function wooStatusToInternal(s) {
    if (!s)
        return undefined;
    switch (s.toLowerCase()) {
        case "pending": return "pending";
        case "processing": return "processing";
        case "on-hold": return "shipped";
        case "completed": return "delivered";
        case "cancelled": return "cancelled";
        case "refunded": return "cancelled";
        case "failed": return "cancelled";
        default: return s;
    }
}
function orderToWoo(id, o) {
    const addr = o.address || {};
    const nameParts = (addr.fullName || o.customer || "").split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ");
    const billing = {
        first_name: firstName,
        last_name: lastName,
        company: "",
        address_1: addr.street || o.shippingAddress || "",
        address_2: addr.district || "",
        city: addr.city || "",
        state: "",
        postcode: addr.postalCode || "",
        country: addr.country || "SA",
        email: o.email || "",
        phone: addr.phone || o.phone || "",
    };
    const lineItems = (o.items || []).map((it, i) => ({
        id: i + 1,
        name: it.name || "",
        product_id: it.productId || "",
        variation_id: 0,
        quantity: Number(it.quantity || 1),
        tax_class: "",
        subtotal: String(Number(it.price || 0) * Number(it.quantity || 1)),
        subtotal_tax: "0.00",
        total: String(Number(it.price || 0) * Number(it.quantity || 1)),
        total_tax: "0.00",
        taxes: [],
        meta_data: [],
        sku: it.sku || "",
        price: Number(it.price || 0),
    }));
    return {
        id,
        parent_id: 0,
        number: id,
        order_key: `wc_order_${id}`,
        created_via: "rest-api",
        version: "8.0.0",
        status: statusToWoo(o.status),
        currency: "SAR",
        date_created: toIsoString(o.createdAt),
        date_created_gmt: toIsoString(o.createdAt),
        date_modified: toIsoString(o.updatedAt),
        date_modified_gmt: toIsoString(o.updatedAt),
        discount_total: "0.00",
        discount_tax: "0.00",
        shipping_total: String(Number(o.shippingCost || 0)),
        shipping_tax: "0.00",
        cart_tax: "0.00",
        total: String(Number(o.total || 0)),
        total_tax: "0.00",
        prices_include_tax: false,
        customer_id: 0,
        customer_ip_address: "",
        customer_user_agent: "",
        customer_note: o.notes || "",
        billing,
        shipping: billing,
        payment_method: o.paymentMethod || "",
        payment_method_title: o.paymentMethod || "",
        transaction_id: "",
        date_paid: o.paymentStatus === "paid" ? toIsoString(o.updatedAt) : null,
        date_paid_gmt: o.paymentStatus === "paid" ? toIsoString(o.updatedAt) : null,
        date_completed: null,
        date_completed_gmt: null,
        cart_hash: "",
        meta_data: [
            { id: 1, key: "_tracking_number", value: o.trackingNumber || "" },
            { id: 2, key: "_tracking_url", value: o.trackingUrl || "" },
        ],
        line_items: lineItems,
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
        refunds: [],
    };
}
// ---------- Main handler ----------
exports.wcApi = functions.https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-WP-Nonce");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    try {
        // Normalize the path. Accept both:
        //   /wp-json/wc/v3/...
        //   /wc/v3/...
        let raw = (req.path || "/").replace(/\/+$/, "");
        if (!raw)
            raw = "/";
        raw = raw.replace(/^\/wp-json/, "");
        if (!raw.startsWith("/wc/v3")) {
            // Root namespace probe
            if (raw === "" || raw === "/") {
                sendJson(res, 200, {
                    name: "Jabouri Store",
                    namespaces: ["wc/v3"],
                });
                return;
            }
            sendJson(res, 404, { code: "rest_no_route", message: "No route", data: { status: 404 } });
            return;
        }
        const sub = raw.slice("/wc/v3".length) || "/";
        // Root WC namespace
        if (sub === "/" || sub === "") {
            sendJson(res, 200, {
                namespace: "wc/v3",
                routes: {},
            });
            return;
        }
        // Auth (all WC endpoints require it)
        const auth = await authenticate(req);
        if (!auth.ok) {
            sendJson(res, 401, {
                code: "woocommerce_rest_authentication_error",
                message: auth.reason,
                data: { status: 401 },
            });
            return;
        }
        const method = req.method.toUpperCase();
        const parts = sub.split("/").filter(Boolean); // e.g. ["products","123"]
        const db = admin.firestore();
        // GET /system_status
        if (parts[0] === "system_status" && method === "GET") {
            sendJson(res, 200, {
                environment: { home_url: "", site_url: "", version: "8.0.0", wp_version: "6.4", language: "ar" },
                settings: { currency: "SAR", currency_symbol: "ر.س", currency_position: "right" },
            });
            return;
        }
        // ===== Products =====
        if (parts[0] === "products") {
            // /products/categories
            if (parts[1] === "categories") {
                if (parts.length === 2 && method === "GET") {
                    const snap = await db.collection("categories").orderBy("order", "asc").get();
                    const cats = snap.docs.map((d) => {
                        const c = d.data();
                        return {
                            id: d.id,
                            name: c.name || c.nameEn || "",
                            slug: (c.nameEn || c.name || "").toString().toLowerCase().replace(/\s+/g, "-"),
                            parent: 0,
                            description: "",
                            display: "default",
                            image: null,
                            menu_order: 0,
                            count: 0,
                        };
                    });
                    sendJson(res, 200, cats);
                    return;
                }
                if (parts.length === 2 && method === "POST") {
                    const body = parseBody(req);
                    const ref = await db.collection("categories").add({
                        name: body.name || "",
                        nameEn: body.slug || "",
                        icon: "Tag",
                        order: 999,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    sendJson(res, 201, { id: ref.id, name: body.name, slug: body.slug });
                    return;
                }
            }
            // GET /products
            if (parts.length === 1 && method === "GET") {
                const perPage = Math.min(Number(req.query.per_page) || 50, 200);
                const page = Math.max(Number(req.query.page) || 1, 1);
                const search = req.query.search || "";
                const sku = req.query.sku || "";
                let q = db.collection("products");
                if (sku)
                    q = q.where("sku", "==", sku);
                // Pagination — naive offset (fine for moderate catalogs)
                const snap = await q.limit(perPage * page).get();
                let docs = snap.docs;
                // Apply offset
                docs = docs.slice((page - 1) * perPage, page * perPage);
                let items = docs.map((d) => productToWoo(d.id, d.data()));
                if (search) {
                    const s = search.toLowerCase();
                    items = items.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
                }
                res.set("X-WP-Total", String(items.length));
                res.set("X-WP-TotalPages", "1");
                sendJson(res, 200, items);
                return;
            }
            // POST /products
            if (parts.length === 1 && method === "POST") {
                const body = parseBody(req);
                const data = wooToProduct(body);
                const ref = await db.collection("products").add({
                    ...data,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: "m5azn",
                });
                const created = await ref.get();
                sendJson(res, 201, productToWoo(ref.id, created.data()));
                return;
            }
            // /products/:id
            if (parts.length === 2) {
                const id = parts[1];
                const ref = db.collection("products").doc(id);
                const doc = await ref.get();
                if (!doc.exists) {
                    sendJson(res, 404, {
                        code: "woocommerce_rest_product_invalid_id",
                        message: "Invalid product ID.",
                        data: { status: 404 },
                    });
                    return;
                }
                if (method === "GET") {
                    sendJson(res, 200, productToWoo(id, doc.data()));
                    return;
                }
                if (method === "PUT" || method === "PATCH") {
                    const body = parseBody(req);
                    const data = wooToProduct(body);
                    await ref.update({
                        ...data,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    const fresh = await ref.get();
                    sendJson(res, 200, productToWoo(id, fresh.data()));
                    return;
                }
                if (method === "DELETE") {
                    await ref.delete();
                    sendJson(res, 200, { id, deleted: true });
                    return;
                }
            }
        }
        // ===== Orders =====
        if (parts[0] === "orders") {
            // GET /orders
            if (parts.length === 1 && method === "GET") {
                const perPage = Math.min(Number(req.query.per_page) || 50, 200);
                const page = Math.max(Number(req.query.page) || 1, 1);
                const status = req.query.status;
                const after = req.query.after;
                let q = db.collection("orders").orderBy("createdAt", "desc");
                if (status) {
                    const internal = wooStatusToInternal(status);
                    if (internal)
                        q = q.where("status", "==", internal);
                }
                if (after) {
                    const d = new Date(after);
                    if (!isNaN(d.getTime())) {
                        q = q.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(d));
                    }
                }
                const snap = await q.limit(perPage * page).get();
                const docs = snap.docs.slice((page - 1) * perPage, page * perPage);
                const items = docs.map((d) => orderToWoo(d.id, d.data()));
                res.set("X-WP-Total", String(items.length));
                res.set("X-WP-TotalPages", "1");
                sendJson(res, 200, items);
                return;
            }
            // /orders/:id
            if (parts.length === 2) {
                const id = parts[1];
                const ref = db.collection("orders").doc(id);
                const doc = await ref.get();
                if (!doc.exists) {
                    sendJson(res, 404, {
                        code: "woocommerce_rest_shop_order_invalid_id",
                        message: "Invalid order ID.",
                        data: { status: 404 },
                    });
                    return;
                }
                if (method === "GET") {
                    sendJson(res, 200, orderToWoo(id, doc.data()));
                    return;
                }
                if (method === "PUT" || method === "PATCH") {
                    const body = parseBody(req);
                    const update = {
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        m5aznUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    };
                    if (typeof body.status === "string") {
                        const internal = wooStatusToInternal(body.status);
                        if (internal)
                            update.status = internal;
                    }
                    // tracking via meta_data array
                    if (Array.isArray(body.meta_data)) {
                        for (const m of body.meta_data) {
                            if ((m === null || m === void 0 ? void 0 : m.key) === "_tracking_number" && typeof m.value === "string") {
                                update.trackingNumber = m.value;
                            }
                            if ((m === null || m === void 0 ? void 0 : m.key) === "_tracking_url" && typeof m.value === "string") {
                                update.trackingUrl = m.value;
                            }
                            if ((m === null || m === void 0 ? void 0 : m.key) === "_carrier" && typeof m.value === "string") {
                                update.carrier = m.value;
                            }
                        }
                    }
                    await ref.update(update);
                    const fresh = await ref.get();
                    sendJson(res, 200, orderToWoo(id, fresh.data()));
                    return;
                }
            }
        }
        sendJson(res, 404, {
            code: "rest_no_route",
            message: `No route for ${method} ${sub}`,
            data: { status: 404 },
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error("wcApi error:", err);
        sendJson(res, 500, {
            code: "woocommerce_rest_internal_error",
            message: msg,
            data: { status: 500 },
        });
    }
});
//# sourceMappingURL=wooCommerceApi.js.map