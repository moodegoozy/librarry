import React, { useState, useEffect } from "react";
import {
  Search,
  Package,
  Plus,
  Loader,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Zap,
  DollarSign,
  Tag,
} from "lucide-react";
import {
  searchYakkyofyProducts,
  getYakkyofyProductDetail,
  loadYakkyofySettings,
  calculateYakkyofySellingPrice,
  type YakkyofySettings,
  type YakkyofyProduct,
  type YakkyofyVariant,
} from "../../services/yakkyofy";
import { addProduct } from "../../services/firestore";
import { useStore } from "../../store/useStore";
import "./YakkyofyProducts.css";

const YakkyofyProducts: React.FC = () => {
  const { categories } = useStore();

  const [products, setProducts] = useState<YakkyofyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [settings, setSettings] = useState<YakkyofySettings | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modal state
  const [detailModal, setDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [productDetail, setProductDetail] = useState<YakkyofyProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [importName, setImportName] = useState("");
  const [importNameAr, setImportNameAr] = useState("");
  const [importPrice, setImportPrice] = useState(0);
  const [importCategory, setImportCategory] = useState("");
  const [importing, setImporting] = useState(false);

  const perPage = 20;

  useEffect(() => {
    loadYakkyofySettings().then((s) => {
      if (s) setSettings(s);
    });
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const extractList = (payload: any): YakkyofyProduct[] => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    const candidates = [
      payload.data,
      payload.items,
      payload.products,
      payload.results,
      payload.rows,
      payload.docs,
      payload.list,
      payload.records,
      payload.raw,
    ];

    for (const c of candidates) {
      if (Array.isArray(c)) return c;
      if (c && typeof c === "object") {
        const nested = extractList(c);
        if (nested.length) return nested;
      }
    }

    return [];
  };

  const handleSearch = async (newPage?: number) => {
    if (!keyword.trim()) return;
    const targetPage = newPage ?? page;
    setLoading(true);
    try {
      const result = await searchYakkyofyProducts({
        keyword: keyword.trim(),
        page: targetPage,
        per_page: perPage,
      });

      const data = result?.data || result;
      const list: YakkyofyProduct[] = extractList(data);
      const total: number = data?.total || data?.meta?.total || data?.count || list.length;

      setProducts(list);
      setTotalProducts(total);
      setTotalPages(Math.max(1, Math.ceil(total / perPage)));
      if (newPage !== undefined) setPage(newPage);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في البحث";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setPage(1);
      handleSearch(1);
    }
  };

  const handleViewDetail = async (product: YakkyofyProduct) => {
    // اعرض بيانات المنتج فوراً من قائمة البحث (تحتوي السعر والصورة)
    setDetailModal(true);
    setProductDetail(product);
    setImportName(product.name || "");
    setImportNameAr("");
    setImportCategory("");

    const markup = settings?.defaultMarkup ?? 30;
    const rate = settings?.usdToSar ?? 3.75;
    const initPrice = product.sale_price ?? product.price ?? 0;
    setImportPrice(calculateYakkyofySellingPrice(initPrice, rate, markup));

    if (product.variants?.length) {
      setSelectedVariant(String(product.variants[0].id));
    } else {
      setSelectedVariant("");
    }

    if (!product.id) return;

    // حاول جلب تفاصيل أعمق في الخلفية (صور إضافية، وصف، متغيرات)
    setDetailLoading(true);
    try {
      const result = await getYakkyofyProductDetail(String(product.id));
      const detail: YakkyofyProduct = result?.data || result;
      if (detail && (detail.id || detail.name)) {
        // دمج البيانات: التفاصيل تغلب، لكن نحافظ على السعر والصورة إن فقدا في التفاصيل
        const merged: YakkyofyProduct = {
          ...product,
          ...detail,
          images:
            (detail.images && detail.images.length ? detail.images : product.images) || [],
          image: detail.image || product.image,
          price: detail.price || product.price,
          sale_price: detail.sale_price || product.sale_price,
          name: detail.name || product.name,
          description: detail.description || product.description,
        };
        setProductDetail(merged);
        setImportName(merged.name || "");
        const finalPrice = merged.sale_price ?? merged.price ?? initPrice;
        setImportPrice(calculateYakkyofySellingPrice(finalPrice, rate, markup));
        if (merged.variants?.length && !selectedVariant) {
          setSelectedVariant(String(merged.variants[0].id));
        }
      }
    } catch {
      // لا بأس — بيانات قائمة البحث كافية للاستيراد
    } finally {
      setDetailLoading(false);
    }
  };

  const getProductImage = (product: YakkyofyProduct): string => {
    if (product.images?.length) return product.images[0];
    return product.image || "";
  };

  const getVariantImage = (variant: YakkyofyVariant): string => {
    return variant.image || "";
  };

  const handleImport = async () => {
    if (!productDetail) return;
    setImporting(true);
    try {
      const markup = settings?.defaultMarkup ?? 30;
      const rate = settings?.usdToSar ?? 3.75;
      const sourcePrice = productDetail.sale_price ?? productDetail.price ?? 0;

      const variant = productDetail.variants?.find(
        (v) => String(v.id) === selectedVariant,
      );

      const images: string[] = [];
      const variantImg = variant ? getVariantImage(variant) : "";
      const mainImg = getProductImage(productDetail);
      if (variantImg) images.push(variantImg);
      if (mainImg && mainImg !== variantImg) images.push(mainImg);
      if (productDetail.images?.length) {
        for (const img of productDetail.images) {
          if (!images.includes(img)) images.push(img);
          if (images.length >= 5) break;
        }
      }

      const newProduct = {
        name: importNameAr || importName || productDetail.name,
        nameEn: importName || productDetail.name,
        description: productDetail.description || productDetail.name,
        price: importPrice,
        oldPrice: null,
        category: importCategory || productDetail.category || "عام",
        images: images.filter(Boolean),
        stock: productDetail.stock ?? 999,
        featured: false,
        specs: {},
        // حقول Yakkyofy
        isYakkyofyProduct: true,
        yakkyofyProductId: String(productDetail.id),
        yakkyofyVariantId: selectedVariant || String(variant?.id || ""),
        yakkyofySku: variant?.sku || productDetail.sku || "",
        yakkyofySourcePrice: sourcePrice,
        supplierName: "Yakkyofy",
        supplierPrice: sourcePrice * rate,
        supplierUrl: `https://app.yakkyofy.com/products/${productDetail.id}`,
        externalId: String(productDetail.id),
        profitMargin: markup,
        autoSync: true,
        lastSyncAt: new Date(),
      };

      await addProduct(newProduct as any);
      showToast("تم استيراد المنتج إلى المتجر بنجاح! ✓");
      setDetailModal(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في الاستيراد";
      showToast(msg, "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="yak-products-page">
      {toast && (
        <div className={`yak-toast ${toast.type}`}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}

      <div className="page-header">
        <h2>
          <Zap size={24} />
          منتجات Yakkyofy
        </h2>
      </div>

      {/* شريط البحث */}
      <div className="yak-search-bar">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="ابحث عن منتج بالإنجليزية..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            dir="ltr"
          />
        </div>
        <button
          className="btn-search"
          onClick={() => { setPage(1); handleSearch(1); }}
          disabled={loading || !keyword.trim()}
        >
          {loading ? <Loader size={16} className="spinner" /> : <Search size={16} />}
          بحث
        </button>
      </div>

      {/* نتائج البحث */}
      {totalProducts > 0 && (
        <div className="results-info">
          وُجد <strong>{totalProducts.toLocaleString("ar-SA")}</strong> منتج
        </div>
      )}

      {loading ? (
        <div className="yak-loading">
          <Loader size={40} className="spinner" />
          <p>جاري البحث...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="yak-empty">
          <Package size={60} />
          <h3>ابحث عن منتجات Yakkyofy</h3>
          <p>أدخل كلمة مفتاحية للبحث في كتالوج Yakkyofy واستيراد المنتجات إلى متجرك</p>
        </div>
      ) : (
        <>
          <div className="yak-products-grid">
            {products.map((product) => {
              const img = getProductImage(product);
              const price = product.sale_price ?? product.price ?? 0;
              const markup = settings?.defaultMarkup ?? 30;
              const rate = settings?.usdToSar ?? 3.75;
              const sellingPrice = calculateYakkyofySellingPrice(price, rate, markup);

              return (
                <div
                  key={product.id}
                  className="yak-product-card"
                  onClick={() => handleViewDetail(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleViewDetail(product);
                    }
                  }}
                >
                  <div className="yak-product-image">
                    {img ? (
                      <img
                        src={img}
                        alt={product.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget;
                          // جرب باقي الصور المتاحة قبل الإستسلام
                          const all = Array.isArray(product.images) ? product.images : [];
                          const tried = Number(el.dataset.tried || "0");
                          const next = all[tried + 1];
                          if (next && next !== el.src) {
                            el.dataset.tried = String(tried + 1);
                            el.src = next;
                          } else {
                            el.style.display = "none";
                            const parent = el.parentElement;
                            if (parent && !parent.querySelector(".no-image")) {
                              const ph = document.createElement("div");
                              ph.className = "no-image";
                              ph.innerHTML =
                                '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
                              parent.appendChild(ph);
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="no-image">
                        <Package size={40} />
                      </div>
                    )}
                  </div>
                  <div className="yak-product-info">
                    <h4 title={product.name}>{product.name}</h4>
                    {product.category && (
                      <span className="yak-category">
                        <Tag size={12} />
                        {product.category}
                      </span>
                    )}
                    <div className="yak-prices">
                      <span className="cost-price">
                        <DollarSign size={12} />
                        {price.toFixed(2)} USD
                      </span>
                      <span className="selling-price">
                        {sellingPrice.toLocaleString("ar-SA")} ر.س
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn-view-detail"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetail(product);
                    }}
                  >
                    <Plus size={16} />
                    استيراد
                  </button>
                </div>
              );
            })}
          </div>

          {/* التنقل بين الصفحات */}
          {totalPages > 1 && (
            <div className="yak-pagination">
              <button
                className="btn-page"
                onClick={() => { const p = page - 1; setPage(p); handleSearch(p); }}
                disabled={page <= 1}
              >
                <ChevronRight size={18} />
              </button>
              <span className="page-info">
                صفحة {page} من {totalPages}
              </span>
              <button
                className="btn-page"
                onClick={() => { const p = page + 1; setPage(p); handleSearch(p); }}
                disabled={page >= totalPages}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal تفاصيل المنتج */}
      {detailModal && (
        <div className="yak-modal-overlay" onClick={() => setDetailModal(false)}>
          <div className="yak-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>استيراد منتج Yakkyofy</h3>
              <button className="modal-close" onClick={() => setDetailModal(false)}>
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div className="modal-loading">
                <Loader size={40} className="spinner" />
                <p>جاري تحميل التفاصيل...</p>
              </div>
            ) : productDetail ? (
              <div className="modal-body">
                <div className="modal-product-preview">
                  {getProductImage(productDetail) ? (
                    <img
                      src={getProductImage(productDetail)}
                      alt={productDetail.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const el = e.currentTarget;
                        const all = Array.isArray(productDetail.images) ? productDetail.images : [];
                        const tried = Number(el.dataset.tried || "0");
                        const next = all[tried + 1];
                        if (next && next !== el.src) {
                          el.dataset.tried = String(tried + 1);
                          el.src = next;
                        } else {
                          el.style.display = "none";
                        }
                      }}
                    />
                  ) : (
                    <div className="no-image-lg">
                      <Package size={60} />
                    </div>
                  )}
                  <div className="modal-product-meta">
                    <h4>{productDetail.name}</h4>
                    {productDetail.sku && (
                      <span className="sku-badge">SKU: {productDetail.sku}</span>
                    )}
                    {(() => {
                      const supplierUsd =
                        productDetail.sale_price ?? productDetail.price ?? 0;
                      const rate = settings?.usdToSar ?? 3.75;
                      const markup = settings?.defaultMarkup ?? 30;
                      const supplierSar = supplierUsd * rate;
                      const sellingSar = calculateYakkyofySellingPrice(
                        supplierUsd,
                        rate,
                        markup,
                      );
                      const profitSar = sellingSar - supplierSar;
                      return (
                        <div className="modal-prices">
                          <div className="price-row supplier">
                            <span className="label">سعر المورد:</span>
                            <strong>${supplierUsd.toFixed(2)}</strong>
                            <span className="muted">
                              ≈ {supplierSar.toLocaleString("ar-SA", {
                                maximumFractionDigits: 2,
                              })} ر.س
                            </span>
                          </div>
                          <div className="price-row markup">
                            <span className="label">هامش الربح:</span>
                            <strong>{markup}%</strong>
                            <span className="muted">
                              (+{profitSar.toLocaleString("ar-SA", {
                                maximumFractionDigits: 2,
                              })} ر.س)
                            </span>
                          </div>
                          <div className="price-row selling">
                            <span className="label">سعر البيع المقترح:</span>
                            <strong>
                              {sellingSar.toLocaleString("ar-SA")} ر.س
                            </strong>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* المتغيرات */}
                {productDetail.variants && productDetail.variants.length > 0 && (
                  <div className="modal-variants">
                    <label>اختر المتغير:</label>
                    <div className="variants-list">
                      {productDetail.variants.map((v) => (
                        <button
                          key={v.id}
                          className={`variant-btn ${selectedVariant === String(v.id) ? "selected" : ""}`}
                          onClick={() => setSelectedVariant(String(v.id))}
                        >
                          {v.image && (
                            <img src={v.image} alt={v.name || ""} width={30} height={30} />
                          )}
                          {v.name || String(v.id)}
                          {v.price && (
                            <span className="v-price">${v.price.toFixed(2)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* بيانات الاستيراد */}
                <div className="modal-import-fields">
                  <div className="field-group">
                    <label>اسم المنتج (عربي)</label>
                    <input
                      type="text"
                      value={importNameAr}
                      onChange={(e) => setImportNameAr(e.target.value)}
                      placeholder="أدخل الاسم العربي للمنتج"
                    />
                  </div>

                  <div className="field-group">
                    <label>اسم المنتج (إنجليزي)</label>
                    <input
                      type="text"
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      dir="ltr"
                    />
                  </div>

                  <div className="field-group">
                    <label>سعر البيع (ر.س)</label>
                    <input
                      type="number"
                      min={0}
                      value={importPrice}
                      onChange={(e) => setImportPrice(Number(e.target.value))}
                    />
                  </div>

                  <div className="field-group">
                    <label>التصنيف</label>
                    <select
                      value={importCategory}
                      onChange={(e) => setImportCategory(e.target.value)}
                    >
                      <option value="">— تصنيف تلقائي —</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setDetailModal(false)}>
                إلغاء
              </button>
              <button
                className="btn-import"
                onClick={handleImport}
                disabled={importing || !productDetail}
              >
                {importing ? (
                  <Loader size={16} className="spinner" />
                ) : (
                  <Plus size={16} />
                )}
                {importing ? "جاري الاستيراد..." : "استيراد إلى المتجر"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YakkyofyProducts;
