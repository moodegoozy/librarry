import React, { useState, useEffect } from "react";
import {
  Search,
  Package,
  Download,
  Eye,
  Loader,
  X,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Check,
} from "lucide-react";
import {
  searchCJProducts,
  getCJProductDetail,
  calculateSellingPrice,
  calculateProfit,
  type CJProductResult,
  type CJProductDetail,
} from "../../services/cjDropshipping";
import { addProduct } from "../../services/firestore";
import { getCJSettings } from "../../services/firestore";
import type { CJSettings } from "../../types";
import "./CJProducts.css";

// تحويل HTML إلى نص عادي
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Replace <br> and block elements with newlines
  const body = doc.body;
  body.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  body.querySelectorAll("p, div, li").forEach((el) => {
    el.prepend(document.createTextNode("\n"));
    el.append(document.createTextNode("\n"));
  });
  // Get text and clean up multiple newlines
  return (body.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// CJ API may return image in different field names
const getProductImage = (product: Record<string, unknown>): string => {
  return (
    (product.productImage as string) ||
    (product.productImageUrl as string) ||
    (product.bigImage as string) ||
    (product.productImg as string) ||
    ""
  );
};

const CJProducts: React.FC = () => {
  const [products, setProducts] = useState<CJProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [cjSettings, setCjSettings] = useState<CJSettings | null>(null);

  // Modal state
  const [detailModal, setDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [productDetail, setProductDetail] = useState<CJProductDetail | null>(
    null,
  );
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [importName, setImportName] = useState("");
  const [importPrice, setImportPrice] = useState(0);
  const [importCategory, setImportCategory] = useState("");
  const [importing, setImporting] = useState(false);

  const pageSize = 20;

  // تحميل إعدادات CJ
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getCJSettings();
      setCjSettings(settings);
    };
    loadSettings();
  }, []);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // بحث المنتجات
  const handleSearch = async (page?: number) => {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const result = await searchCJProducts({
        keyword: keyword.trim(),
        pageNum: page || pageNum,
        pageSize,
      });

      if (result.result && result.data) {
        const list = result.data.list || [];
        // Debug: log first product keys and image-related fields
        if (list.length > 0) {
          const sample = list[0] as any;
          console.log("CJ Product ALL KEYS:", Object.keys(sample));
          const imageFields = Object.entries(sample).filter(
            ([k, v]) =>
              k.toLowerCase().includes("image") ||
              k.toLowerCase().includes("img") ||
              k.toLowerCase().includes("photo") ||
              k.toLowerCase().includes("pic") ||
              (typeof v === "string" && (v as string).match(/\.(jpg|jpeg|png|webp)/i))
          );
          console.log("CJ Image fields:", JSON.stringify(imageFields));
          console.log("CJ productImage value:", sample.productImage);
        }
        // Normalize image field
        const normalized = list.map((p: any) => ({
          ...p,
          productImage: getProductImage(p),
        })) as CJProductResult[];
        setProducts(normalized);
        setTotalProducts(result.data.total || 0);
        if (page) setPageNum(page);
      } else {
        showToast(result.message || "فشل البحث", "error");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في البحث";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // عرض التفاصيل
  const handleViewDetail = async (pid: string) => {
    setDetailLoading(true);
    setDetailModal(true);
    try {
      const result = await getCJProductDetail(pid);
      if (result.result && result.data) {
        const detail = result.data;
        // Normalize image field name
        if (!detail.productImage) {
          const raw = detail as any;
          (detail as any).productImage = getProductImage(raw);
        }
        console.log("CJ Product detail:", JSON.stringify({ pid: detail.pid, productImage: detail.productImage }));
        setProductDetail(detail);
        setImportName(detail.productNameEn);
        const markup = cjSettings?.defaultMarkup || 30;
        const rate = cjSettings?.usdToSar || 3.75;
        setImportPrice(calculateSellingPrice(detail.sellPrice, rate, markup));
        if (detail.variants?.length > 0) {
          setSelectedVariant(detail.variants[0].vid);
        }
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "خطأ في جلب التفاصيل";
      showToast(msg, "error");
      setDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // استيراد منتج إلى المتجر
  const handleImport = async () => {
    if (!productDetail) return;
    setImporting(true);

    try {
      const variant = productDetail.variants?.find(
        (v) => v.vid === selectedVariant,
      );
      const rate = cjSettings?.usdToSar || 3.75;

      const newProduct = {
        name: importName || productDetail.productNameEn,
        nameEn: productDetail.productNameEn,
        description: productDetail.description
          ? stripHtml(productDetail.description)
          : productDetail.productNameEn,
        price: importPrice,
        oldPrice: null,
        category: importCategory || productDetail.categoryName || "عام",
        images: [
          variant?.variantImage || productDetail.productImage,
          productDetail.productImage,
        ].filter(Boolean),
        stock: 999,
        featured: false,
        specs: {},
        // حقول CJ
        isCJProduct: true,
        cjProductId: productDetail.pid,
        cjVariantId: selectedVariant || variant?.vid || "",
        cjSku: variant?.variantSku || productDetail.productSku,
        cjCategoryId: productDetail.categoryId,
        cjSourcePrice: variant?.variantPrice || productDetail.sellPrice,
        cjImageUrl: productDetail.productImage,
        supplierName: "CJ Dropshipping",
        supplierPrice:
          (variant?.variantPrice || productDetail.sellPrice) * rate,
        supplierUrl: `https://cjdropshipping.com/product/${productDetail.pid}`,
        externalId: productDetail.pid,
        profitMargin: cjSettings?.defaultMarkup || 30,
        autoSync: true,
        lastSyncAt: new Date(),
      };

      await addProduct(newProduct as any);
      showToast("تم استيراد المنتج بنجاح! ✓");
      setDetailModal(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ في الاستيراد";
      showToast(msg, "error");
    } finally {
      setImporting(false);
    }
  };

  // استيراد سريع بدون فتح التفاصيل
  const handleQuickImport = async (product: CJProductResult) => {
    const rate = cjSettings?.usdToSar || 3.75;
    const markup = cjSettings?.defaultMarkup || 30;

    try {
      const newProduct = {
        name: product.productNameEn,
        nameEn: product.productNameEn,
        description: product.productNameEn,
        price: calculateSellingPrice(product.sellPrice, rate, markup),
        category: product.categoryName || "عام",
        images: [product.productImage].filter(Boolean),
        stock: 999,
        featured: false,
        specs: {},
        isCJProduct: true,
        cjProductId: product.pid,
        cjSku: product.productSku,
        cjCategoryId: product.categoryId,
        cjSourcePrice: product.sellPrice,
        cjImageUrl: product.productImage,
        supplierName: "CJ Dropshipping",
        supplierPrice: product.sellPrice * rate,
        supplierUrl: `https://cjdropshipping.com/product/${product.pid}`,
        externalId: product.pid,
        profitMargin: markup,
        autoSync: true,
        lastSyncAt: new Date(),
      };

      await addProduct(newProduct as any);
      showToast(`تم استيراد: ${product.productNameEn.substring(0, 40)}...`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "خطأ";
      showToast(msg, "error");
    }
  };

  const totalPages = Math.ceil(totalProducts / pageSize);

  return (
    <div className="cj-products-page">
      {/* Header */}
      <div className="page-header">
        <h2>
          <Package size={24} />
          منتجات CJ Dropshipping
        </h2>
      </div>

      {/* شريط البحث */}
      <div className="cj-search-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="ابحث عن منتجات في CJ (بالإنجليزية)..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPageNum(1);
                handleSearch(1);
              }
            }}
          />
        </div>
        <button
          className="btn-search"
          onClick={() => {
            setPageNum(1);
            handleSearch(1);
          }}
          disabled={loading || !keyword.trim()}
        >
          <Search size={16} />
          بحث
        </button>
      </div>

      {/* المحتوى */}
      {loading ? (
        <div className="cj-loading">
          <Loader size={40} className="spinner" />
        </div>
      ) : products.length === 0 ? (
        <div className="cj-empty-state">
          <PackageSearch size={64} />
          <h3>ابحث عن منتجات CJ</h3>
          <p>
            اكتب اسم المنتج بالإنجليزية وابدأ البحث لاستيراد المنتجات إلى متجرك
          </p>
        </div>
      ) : (
        <>
          {/* شبكة المنتجات */}
          <div className="cj-products-grid">
            {products.map((product) => {
              const rate = cjSettings?.usdToSar || 3.75;
              const markup = cjSettings?.defaultMarkup || 30;
              const sellPrice = calculateSellingPrice(
                product.sellPrice,
                rate,
                markup,
              );

              return (
                <div key={product.pid} className="cj-product-card">
                  {(() => {
                    let imgSrc = product.productImage || "";
                    // Fix protocol-relative URLs
                    if (imgSrc.startsWith("//")) imgSrc = "https:" + imgSrc;
                    return imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={product.productNameEn}
                        className="product-image"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.dataset.retried) {
                            target.dataset.retried = "1";
                            // Try without referrer policy
                            target.src = imgSrc;
                          } else {
                            target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23f0f0f0' width='300' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
                          }
                        }}
                      />
                    ) : (
                      <div className="product-image" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", color: "#999", fontSize: "12px" }}>
                        لا توجد صورة
                      </div>
                    );
                  })()}
                  <div className="product-info">
                    <div className="product-name">{product.productNameEn}</div>
                    <div className="product-sku">SKU: {product.productSku}</div>
                    {product.categoryName && (
                      <div className="product-category">
                        {product.categoryName}
                      </div>
                    )}
                    <div className="product-price-row">
                      <span className="cj-price">
                        ${Number(product.sellPrice).toFixed(2)}
                      </span>
                      <span className="sell-price">{sellPrice} ر.س</span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn-import"
                        onClick={() => handleQuickImport(product)}
                      >
                        <Download size={14} />
                        استيراد
                      </button>
                      <button
                        className="btn-detail"
                        onClick={() => handleViewDetail(product.pid)}
                      >
                        <Eye size={14} />
                        تفاصيل
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* الترقيم */}
          {totalPages > 1 && (
            <div className="cj-pagination">
              <button
                onClick={() => handleSearch(pageNum - 1)}
                disabled={pageNum <= 1}
              >
                <ChevronRight size={16} />
                السابق
              </button>
              <span className="page-info">
                صفحة {pageNum} من {totalPages} ({totalProducts} منتج)
              </span>
              <button
                onClick={() => handleSearch(pageNum + 1)}
                disabled={pageNum >= totalPages}
              >
                التالي
                <ChevronLeft size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* نافذة التفاصيل */}
      {detailModal && (
        <div
          className="cj-modal-overlay"
          onClick={() => !detailLoading && setDetailModal(false)}
        >
          <div className="cj-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تفاصيل المنتج</h3>
              <button
                className="close-btn"
                onClick={() => setDetailModal(false)}
              >
                <X size={24} />
              </button>
            </div>

            {detailLoading ? (
              <div className="cj-loading">
                <Loader size={32} className="spinner" />
              </div>
            ) : productDetail ? (
              <>
                <img
                  src={productDetail.productImage?.startsWith("//") ? "https:" + productDetail.productImage : productDetail.productImage}
                  alt={productDetail.productNameEn}
                  className="detail-image"
                  referrerPolicy="no-referrer"
                />

                <div className="detail-info">
                  <div className="info-item">
                    <label>الاسم</label>
                    <span>{productDetail.productNameEn}</span>
                  </div>
                  <div className="info-item">
                    <label>SKU</label>
                    <span>{productDetail.productSku}</span>
                  </div>
                  <div className="info-item">
                    <label>سعر CJ</label>
                    <span>${Number(productDetail.sellPrice).toFixed(2)}</span>
                  </div>
                  <div className="info-item">
                    <label>التصنيف</label>
                    <span>{productDetail.categoryName || "-"}</span>
                  </div>
                  <div className="info-item">
                    <label>الوزن</label>
                    <span>{productDetail.productWeight}g</span>
                  </div>
                  <div className="info-item">
                    <label>النوع</label>
                    <span>{productDetail.productType || "-"}</span>
                  </div>
                </div>

                {/* المتغيرات */}
                {productDetail.variants?.length > 0 && (
                  <div className="cj-variants-list">
                    <h4>المتغيرات ({productDetail.variants.length})</h4>
                    {productDetail.variants.map((variant) => (
                      <div
                        key={variant.vid}
                        className={`variant-item ${selectedVariant === variant.vid ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedVariant(variant.vid);
                          const rate = cjSettings?.usdToSar || 3.75;
                          const markup = cjSettings?.defaultMarkup || 30;
                          setImportPrice(
                            calculateSellingPrice(
                              variant.variantPrice,
                              rate,
                              markup,
                            ),
                          );
                        }}
                      >
                        {variant.variantImage && (
                          <img
                            src={variant.variantImage}
                            alt={variant.variantNameEn}
                          />
                        )}
                        <div className="variant-info">
                          <div className="variant-name">
                            {variant.variantNameEn}
                          </div>
                          <div className="variant-sku">
                            {variant.variantSku}
                          </div>
                        </div>
                        <div className="variant-price">
                          ${Number(variant.variantPrice).toFixed(2)}
                        </div>
                        {selectedVariant === variant.vid && (
                          <Check size={16} color="var(--primary)" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* إعدادات الاستيراد */}
                <div className="import-settings">
                  <h4>إعدادات الاستيراد</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>اسم المنتج (عربي)</label>
                      <input
                        type="text"
                        value={importName}
                        onChange={(e) => setImportName(e.target.value)}
                        placeholder="أدخل اسم المنتج بالعربي"
                        dir="rtl"
                      />
                    </div>
                    <div className="form-group">
                      <label>سعر البيع (ر.س)</label>
                      <input
                        type="number"
                        value={importPrice}
                        onChange={(e) => setImportPrice(Number(e.target.value))}
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>التصنيف</label>
                      <input
                        type="text"
                        value={importCategory}
                        onChange={(e) => setImportCategory(e.target.value)}
                        placeholder={productDetail.categoryName || "عام"}
                      />
                    </div>
                    <div className="form-group">
                      <label>الربح المتوقع</label>
                      <input
                        type="text"
                        readOnly
                        value={(() => {
                          const rate = cjSettings?.usdToSar || 3.75;
                          const variant = productDetail.variants?.find(
                            (v) => v.vid === selectedVariant,
                          );
                          const cost =
                            variant?.variantPrice || productDetail.sellPrice;
                          const { profitSAR, profitPercent } = calculateProfit(
                            importPrice,
                            cost,
                            rate,
                          );
                          return `${profitSAR} ر.س (${profitPercent}%)`;
                        })()}
                      />
                    </div>
                  </div>

                  <button
                    className="btn-import-confirm"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? (
                      <>
                        <Loader size={18} className="spinner" />
                        جاري الاستيراد...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        استيراد إلى المتجر
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`cj-toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
};

export default CJProducts;
