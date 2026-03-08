import React, { useState, useRef } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Filter,
  Download,
  Upload,
  Image,
  X,
  Loader,
  Link2,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import {
  addProduct as addProductToFirestore,
  updateProduct as updateProductInFirestore,
  deleteProduct as deleteProductFromFirestore,
} from "../../services/firestore";
import { uploadImages } from "../../services/storage";
import { scrapeProduct } from "../../services/productScraper";
import type { Product } from "../../types";
import "./Products.css";

const Products: React.FC = () => {
  const { products, categories } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    nameEn: "",
    description: "",
    price: "",
    oldPrice: "",
    category: "",
    stock: "",
    featured: false,
    images: [] as string[],
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [productUrl, setProductUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const itemsPerPage = 10;

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.includes(searchQuery) ||
      p.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    const matchesStock =
      !stockFilter ||
      (stockFilter === "in-stock" && p.stock > 0) ||
      (stockFilter === "out-of-stock" && p.stock === 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        nameEn: product.nameEn,
        description: product.description,
        price: product.price.toString(),
        oldPrice: product.oldPrice?.toString() || "",
        category: product.category,
        stock: product.stock.toString(),
        featured: product.featured,
        images: product.images,
      });
    } else {
      setEditingProduct(null);
      setPendingFiles([]);
      setFormData({
        name: "",
        nameEn: "",
        description: "",
        price: "",
        oldPrice: "",
        category: "",
        stock: "",
        featured: false,
        images: [],
      });
    }
    setShowModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setPendingFiles((prev) => [...prev, ...newFiles]);
      // Create temporary preview URLs for display
      newFiles.forEach((file) => {
        const previewUrl = URL.createObjectURL(file);
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, previewUrl],
        }));
      });
    }
  };

  const removeImage = (index: number) => {
    const removedUrl = formData.images[index];
    // Revoke object URL if it's a blob preview
    if (removedUrl.startsWith("blob:")) {
      URL.revokeObjectURL(removedUrl);
      // Also remove from pending files - find the corresponding pending file index
      const blobImages = formData.images
        .slice(0, index + 1)
        .filter((img) => img.startsWith("blob:"));
      const pendingIndex = blobImages.length - 1;
      setPendingFiles((prev) => prev.filter((_, i) => i !== pendingIndex));
    }
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upload new files to Firebase Storage
      let uploadedUrls: string[] = [];
      if (pendingFiles.length > 0) {
        uploadedUrls = await uploadImages(pendingFiles, "products");
      }

      // Combine existing (non-blob) URLs with newly uploaded URLs
      const existingUrls = formData.images.filter(
        (img) => !img.startsWith("blob:"),
      );
      const allImages = [...existingUrls, ...uploadedUrls];

      // Clean up blob preview URLs
      formData.images
        .filter((img) => img.startsWith("blob:"))
        .forEach((url) => URL.revokeObjectURL(url));

      const productData = {
        name: formData.name,
        nameEn: formData.nameEn,
        description: formData.description,
        price: parseFloat(formData.price),
        oldPrice: formData.oldPrice ? parseFloat(formData.oldPrice) : undefined,
        category: formData.category,
        images: allImages.length
          ? allImages
          : ["https://via.placeholder.com/300"],
        stock: parseInt(formData.stock),
        featured: formData.featured,
        createdAt: editingProduct?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      if (editingProduct) {
        await updateProductInFirestore(editingProduct.id, productData);
      } else {
        await addProductToFirestore(productData);
      }

      setShowModal(false);
      setPendingFiles([]);
    } catch (error) {
      console.error("Error saving product:", error);
      alert("حدث خطأ أثناء حفظ المنتج");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
      try {
        await deleteProductFromFirestore(id);
      } catch (error) {
        console.error("Error deleting product:", error);
        alert("حدث خطأ أثناء حذف المنتج");
      }
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-SA").format(price);
  };

  // تصدير المنتجات كملف CSV
  const handleExportProducts = () => {
    const headers = [
      "الاسم",
      "الاسم بالإنجليزي",
      "السعر",
      "السعر القديم",
      "التصنيف",
      "المخزون",
      "مميز",
      "الوصف",
    ];
    const rows = products.map((p) => [
      p.name,
      p.nameEn,
      p.price,
      p.oldPrice || "",
      categories.find((c) => c.id === p.category)?.name || p.category,
      p.stock,
      p.featured ? "نعم" : "لا",
      p.description?.replace(/,/g, "،") || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `منتجات_${new Date().toLocaleDateString("ar-SA")}.csv`;
    link.click();
  };

  // استيراد منتجات من ملف JSON
  const handleImportProducts = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : [data];
      let count = 0;
      for (const item of items) {
        if (!item.name || !item.price) continue;
        await addProductToFirestore({
          name: item.name,
          nameEn: item.nameEn || "",
          description: item.description || "",
          price: Number(item.price),
          oldPrice: item.oldPrice ? Number(item.oldPrice) : undefined,
          category: item.category || "",
          images: item.images || ["https://via.placeholder.com/300"],
          stock: Number(item.stock) || 0,
          featured: Boolean(item.featured),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        count++;
      }
      alert(`تم استيراد ${count} منتج بنجاح`);
    } catch (err) {
      console.error("Import error:", err);
      alert("خطأ في قراءة الملف. تأكد من أن الملف بصيغة JSON صحيحة.");
    }
    if (importFileRef.current) importFileRef.current.value = "";
  };

  // حذف المنتجات المحددة
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} منتج؟`)) return;
    try {
      for (const id of selectedIds) {
        await deleteProductFromFirestore(id);
      }
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error bulk deleting:", error);
      alert("حدث خطأ أثناء حذف المنتجات");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProducts.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // جلب بيانات منتج من رابط URL
  const handleFetchFromUrl = async () => {
    if (!productUrl.trim()) return;
    setUrlLoading(true);
    try {
      const scraped = await scrapeProduct(productUrl.trim());
      // تعبئة نموذج المنتج بالبيانات المجلوبة
      setFormData({
        name: scraped.name || "",
        nameEn: scraped.nameEn || "",
        description: scraped.description || "",
        price: scraped.price ? scraped.price.toString() : "",
        oldPrice: scraped.oldPrice ? scraped.oldPrice.toString() : "",
        category: "",
        stock: "10",
        featured: false,
        images: scraped.images || [],
      });
      setEditingProduct(null);
      setPendingFiles([]);
      setShowUrlModal(false);
      setShowModal(true);
    } catch (error) {
      console.error("Scrape error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء جلب بيانات المنتج",
      );
    } finally {
      setUrlLoading(false);
    }
  };

  // إضافة منتج مباشرة من رابط (بدون مراجعة)
  const handleAddDirectFromUrl = async () => {
    if (!productUrl.trim()) return;
    setUrlLoading(true);
    try {
      const scraped = await scrapeProduct(productUrl.trim());
      if (!scraped.name || !scraped.price) {
        // إذا البيانات ناقصة، افتح النموذج للمراجعة
        setFormData({
          name: scraped.name || "",
          nameEn: scraped.nameEn || "",
          description: scraped.description || "",
          price: scraped.price ? scraped.price.toString() : "",
          oldPrice: scraped.oldPrice ? scraped.oldPrice.toString() : "",
          category: "",
          stock: "10",
          featured: false,
          images: scraped.images || [],
        });
        setEditingProduct(null);
        setPendingFiles([]);
        setShowUrlModal(false);
        setShowModal(true);
        alert("البيانات غير مكتملة. يرجى مراجعة وإكمال المعلومات.");
        return;
      }
      await addProductToFirestore({
        name: scraped.name,
        nameEn: scraped.nameEn || "",
        description: scraped.description || "",
        price: scraped.price,
        oldPrice: scraped.oldPrice,
        category: "",
        images:
          scraped.images.length > 0
            ? scraped.images
            : ["https://via.placeholder.com/300"],
        stock: 10,
        featured: false,
        supplierUrl: scraped.supplierUrl,
        supplierName: scraped.supplierName,
        supplierPrice: scraped.supplierPrice,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      alert("تمت إضافة المنتج بنجاح!");
      setShowUrlModal(false);
      setProductUrl("");
    } catch (error) {
      console.error("Direct add error:", error);
      alert(
        error instanceof Error ? error.message : "حدث خطأ أثناء إضافة المنتج",
      );
    } finally {
      setUrlLoading(false);
    }
  };

  return (
    <div className="products-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            إضافة منتج
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "#8b5cf6" }}
            onClick={() => {
              setProductUrl("");
              setShowUrlModal(true);
            }}
          >
            <Link2 size={18} />
            إضافة من رابط
          </button>
          <input
            type="file"
            ref={importFileRef}
            onChange={handleImportProducts}
            accept=".json"
            style={{ display: "none" }}
          />
          <button
            className="btn btn-outline"
            onClick={() => importFileRef.current?.click()}
          >
            <Upload size={18} />
            استيراد
          </button>
          <button className="btn btn-outline" onClick={handleExportProducts}>
            <Download size={18} />
            تصدير
          </button>
          {selectedIds.size > 0 && (
            <button
              className="btn btn-outline"
              style={{ color: "#ef4444", borderColor: "#ef4444" }}
              onClick={handleBulkDelete}
            >
              <Trash2 size={18} />
              حذف ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="ابحث عن منتج..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">كل التصنيفات</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">الحالة</option>
            <option value="in-stock">متوفر</option>
            <option value="out-of-stock">نفذت الكمية</option>
          </select>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCategoryFilter("");
              setStockFilter("");
              setSearchQuery("");
              setCurrentPage(1);
            }}
          >
            <Filter size={16} />
            إعادة تعيين
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="table-card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === paginatedProducts.length &&
                      paginatedProducts.length > 0
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>المنتج</th>
                <th>التصنيف</th>
                <th>السعر</th>
                <th>المخزون</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelectOne(product.id)}
                    />
                  </td>
                  <td>
                    <div className="product-cell">
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="product-thumb"
                      />
                      <div>
                        <span className="product-name">{product.name}</span>
                        <span className="product-id">#{product.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {categories.find((c) => c.id === product.category)?.name ||
                      product.category}
                  </td>
                  <td>
                    <div className="price-cell">
                      <span className="current-price">
                        {formatPrice(product.price)} ر.س
                      </span>
                      {product.oldPrice && (
                        <span className="old-price">
                          {formatPrice(product.oldPrice)} ر.س
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`stock-badge ${product.stock > 0 ? "in-stock" : "out-of-stock"}`}
                    >
                      {product.stock > 0 ? `${product.stock} وحدة` : "نفذت"}
                    </span>
                  </td>
                  <td>
                    {product.featured && (
                      <span className="badge badge-primary">مميز</span>
                    )}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button
                        className="action-btn"
                        title="عرض"
                        onClick={() =>
                          window.open(`/product/${product.id}`, "_blank")
                        }
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="action-btn"
                        title="تعديل"
                        onClick={() => handleOpenModal(product)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="action-btn delete"
                        title="حذف"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span className="pagination-info">
            عرض {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, filteredProducts.length)} من{" "}
            {filteredProducts.length} منتج
          </span>
          <div className="pagination-buttons">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              السابق
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              className="pagination-btn"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              التالي
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">اسم المنتج (عربي)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">اسم المنتج (إنجليزي)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.nameEn}
                      onChange={(e) =>
                        setFormData({ ...formData, nameEn: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">الوصف</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">السعر (ر.س)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">السعر القديم (ر.س)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.oldPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, oldPrice: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">التصنيف</label>
                    <select
                      className="form-select"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      required
                    >
                      <option value="">اختر التصنيف</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">المخزون</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) =>
                        setFormData({ ...formData, featured: e.target.checked })
                      }
                    />
                    <span>منتج مميز</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">صور المنتج</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                  />
                  <div
                    className="image-upload"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {formData.images.length > 0 ? (
                      <div className="uploaded-images">
                        {formData.images.map((img, index) => (
                          <div key={index} className="uploaded-image">
                            <img src={img} alt={`صورة ${index + 1}`} />
                            <button
                              type="button"
                              className="remove-image"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(index);
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <div className="add-more">
                          <Image size={24} />
                          <span>إضافة المزيد</span>
                        </div>
                      </div>
                    ) : (
                      <div className="upload-placeholder">
                        <Image size={32} />
                        <span>اضغط هنا لرفع الصور</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader className="spinner" size={18} />
                  ) : editingProduct ? (
                    "حفظ التغييرات"
                  ) : (
                    "إضافة المنتج"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* URL Import Modal */}
      {showUrlModal && (
        <div
          className="modal-overlay"
          onClick={() => !urlLoading && setShowUrlModal(false)}
        >
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>إضافة منتج من رابط</h2>
              <button
                className="close-btn"
                onClick={() => !urlLoading && setShowUrlModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p
                style={{
                  color: "#64748b",
                  fontSize: "14px",
                  marginBottom: "16px",
                }}
              >
                الصق رابط المنتج وسيتم جلب البيانات تلقائياً
              </p>
              <p
                style={{
                  color: "#8b5cf6",
                  fontSize: "12px",
                  marginBottom: "12px",
                  background: "#f5f3ff",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  lineHeight: "1.8",
                }}
              >
                المتاجر المدعومة: Amazon • AliExpress • Noon • SHEIN • Temu • eBay • Alibaba • أي موقع آخر
              </p>
              <div className="form-group">
                <label className="form-label">رابط المنتج</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://www.amazon.sa/dp/... أو أي رابط منتج"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  disabled={urlLoading}
                  dir="ltr"
                  style={{ textAlign: "left" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDirectFromUrl();
                    }
                  }}
                />
              </div>
              {urlLoading && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "#8b5cf6",
                    fontSize: "14px",
                    marginTop: "8px",
                  }}
                >
                  <Loader className="spinner" size={16} />
                  <span>جاري جلب بيانات المنتج...</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => !urlLoading && setShowUrlModal(false)}
                disabled={urlLoading}
              >
                إلغاء
              </button>
              <button
                className="btn btn-outline"
                onClick={handleFetchFromUrl}
                disabled={urlLoading || !productUrl.trim()}
              >
                {urlLoading ? (
                  <Loader className="spinner" size={16} />
                ) : (
                  <Eye size={16} />
                )}
                جلب ومراجعة
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddDirectFromUrl}
                disabled={urlLoading || !productUrl.trim()}
                style={{ background: "#8b5cf6" }}
              >
                {urlLoading ? (
                  <Loader className="spinner" size={16} />
                ) : (
                  <Link2 size={16} />
                )}
                إضافة مباشرة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
