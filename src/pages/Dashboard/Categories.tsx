import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Loader,
  Smartphone,
  Laptop,
  Tv,
  Gamepad2,
  Headphones,
  Watch,
  Package,
} from "lucide-react";
import { useStore } from "../../store/useStore";

// خريطة الأيقونات
const iconMap: Record<string, React.ElementType> = {
  Smartphone,
  Laptop,
  Tv,
  Gamepad2,
  Headphones,
  Watch,
  Package,
};
import {
  subscribeToCategories,
  addCategoryToFirestore,
  updateCategoryInFirestore,
  deleteCategoryFromFirestore,
} from "../../services/firestore";
import "./Categories.css";

interface CategoryUI {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  productsCount: number;
  subcategories: { id: string; name: string; productsCount: number }[];
  order: number;
}

const Categories: React.FC = () => {
  const { setCategories: setStoreCategories } = useStore();

  const [categories, setCategories] = useState<CategoryUI[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryUI | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    nameEn: "",
    icon: "",
  });
  const [showSubModal, setShowSubModal] = useState(false);
  const [subParentId, setSubParentId] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<{
    id: string;
    name: string;
    nameEn: string;
  } | null>(null);
  const [subFormData, setSubFormData] = useState({ name: "", nameEn: "" });

  // الاشتراك في التصنيفات من Firestore (المنتجات تأتي من المتجر المركزي)
  useEffect(() => {
    const unsubscribeCategories = subscribeToCategories(
      (firestoreCategories) => {
        const currentProducts = useStore.getState().products;
        const categoriesUI = firestoreCategories.map((c) => ({
          id: c.id,
          name: c.name,
          nameEn: c.nameEn || "",
          icon: c.icon || "Package",
          productsCount: currentProducts.filter((p) => p.category === c.id)
            .length,
          subcategories: (c.subcategories || []).map((sub) => ({
            id: sub.id,
            name: sub.name,
            productsCount: currentProducts.filter(
              (p) => p.subcategory === sub.id,
            ).length,
          })),
          order: c.order ?? 0,
        }));
        setCategories(categoriesUI);
        setStoreCategories(firestoreCategories);
      },
    );

    return () => {
      unsubscribeCategories();
    };
  }, [setStoreCategories]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleOpenModal = (category?: CategoryUI) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        nameEn: category.nameEn,
        icon: category.icon,
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", nameEn: "", icon: "Package" });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCategory) {
        await updateCategoryInFirestore(editingCategory.id, {
          name: formData.name,
          nameEn: formData.nameEn,
          icon: formData.icon,
          updatedAt: new Date(),
        });
      } else {
        await addCategoryToFirestore({
          name: formData.name,
          nameEn: formData.nameEn,
          icon: formData.icon,
          image: "",
          order: categories.length,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving category:", error);
      alert("حدث خطأ أثناء حفظ التصنيف");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا التصنيف؟")) {
      try {
        await deleteCategoryFromFirestore(id);
      } catch (error) {
        console.error("Error deleting category:", error);
        alert("حدث خطأ أثناء حذف التصنيف");
      }
    }
  };

  // تغيير ترتيب التصنيف
  const handleReorder = async (id: string, direction: "up" | "down") => {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((c) => c.id === id);
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= sorted.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    try {
      await updateCategoryInFirestore(sorted[idx].id, {
        order: sorted[swapIdx].order,
      });
      await updateCategoryInFirestore(sorted[swapIdx].id, {
        order: sorted[idx].order,
      });
    } catch (error) {
      console.error("Error reordering:", error);
    }
  };

  // إدارة التصنيفات الفرعية
  const handleOpenSubModal = (
    parentId: string,
    sub?: { id: string; name: string; productsCount: number },
  ) => {
    setSubParentId(parentId);
    if (sub) {
      setEditingSub({ id: sub.id, name: sub.name, nameEn: "" });
      setSubFormData({ name: sub.name, nameEn: "" });
    } else {
      setEditingSub(null);
      setSubFormData({ name: "", nameEn: "" });
    }
    setShowSubModal(true);
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subParentId) return;
    setLoading(true);
    try {
      const parentCat = categories.find((c) => c.id === subParentId);
      const currentSubs =
        parentCat?.subcategories?.map((s) => ({
          id: s.id,
          name: s.name,
          nameEn: "",
        })) || [];
      let updatedSubs;
      if (editingSub) {
        updatedSubs = currentSubs.map((s) =>
          s.id === editingSub.id
            ? { ...s, name: subFormData.name, nameEn: subFormData.nameEn }
            : s,
        );
      } else {
        updatedSubs = [
          ...currentSubs,
          {
            id: `sub_${Date.now()}`,
            name: subFormData.name,
            nameEn: subFormData.nameEn,
          },
        ];
      }
      await updateCategoryInFirestore(subParentId, {
        subcategories: updatedSubs,
      });
      setShowSubModal(false);
    } catch (error) {
      console.error("Error saving subcategory:", error);
      alert("حدث خطأ أثناء حفظ التصنيف الفرعي");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSub = async (parentId: string, subId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا التصنيف الفرعي؟")) return;
    try {
      const parentCat = categories.find((c) => c.id === parentId);
      const updatedSubs = (parentCat?.subcategories || [])
        .filter((s) => s.id !== subId)
        .map((s) => ({ id: s.id, name: s.name, nameEn: "" }));
      await updateCategoryInFirestore(parentId, { subcategories: updatedSubs });
    } catch (error) {
      console.error("Error deleting subcategory:", error);
    }
  };

  return (
    <div className="categories-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            إضافة تصنيف
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="categories-card">
        <div className="categories-list">
          {categories.map((category) => {
            const IconComponent = iconMap[category.icon] || Package;
            return (
              <div key={category.id} className="category-item">
                <div
                  className="category-main"
                  onClick={() => toggleExpand(category.id)}
                >
                  <div className="category-drag">
                    <button
                      className="action-btn small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(category.id, "up");
                      }}
                      title="تحريك للأعلى"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="action-btn small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(category.id, "down");
                      }}
                      title="تحريك للأسفل"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <span className="category-icon">
                    <IconComponent size={20} />
                  </span>
                  <div className="category-info">
                    <span className="category-name">{category.name}</span>
                    <span className="category-count">
                      {category.productsCount} منتج
                    </span>
                  </div>
                  <div className="category-actions">
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(category);
                      }}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(category.id);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="expand-icon">
                    {expandedIds.includes(category.id) ? (
                      <ChevronDown size={20} />
                    ) : (
                      <ChevronRight size={20} />
                    )}
                  </div>
                </div>

                {expandedIds.includes(category.id) && (
                  <div className="subcategories">
                    {category.subcategories.map((sub) => (
                      <div key={sub.id} className="subcategory-item">
                        <span className="sub-name">{sub.name}</span>
                        <span className="sub-count">
                          {sub.productsCount} منتج
                        </span>
                        <div className="category-actions">
                          <button
                            className="action-btn small"
                            onClick={() => handleOpenSubModal(category.id, sub)}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="action-btn small delete"
                            onClick={() => handleDeleteSub(category.id, sub.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      className="add-sub-btn"
                      onClick={() => handleOpenSubModal(category.id)}
                    >
                      <Plus size={16} />
                      إضافة تصنيف فرعي
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? "تعديل التصنيف" : "إضافة تصنيف جديد"}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">اسم التصنيف (عربي)</label>
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
                  <label className="form-label">اسم التصنيف (إنجليزي)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.nameEn}
                    onChange={(e) =>
                      setFormData({ ...formData, nameEn: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">الأيقونة</label>
                  <select
                    className="form-select"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                  >
                    <option value="Smartphone">📱 جوالات</option>
                    <option value="Laptop">💻 لابتوبات</option>
                    <option value="Tv">📺 تلفزيونات</option>
                    <option value="Gamepad2">🎮 ألعاب</option>
                    <option value="Headphones">🎧 سماعات</option>
                    <option value="Watch">⌚ ساعات</option>
                    <option value="Package">📦 أخرى</option>
                  </select>
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
                  ) : editingCategory ? (
                    "حفظ التغييرات"
                  ) : (
                    "إضافة التصنيف"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Subcategory Modal */}
      {showSubModal && (
        <div className="modal-overlay" onClick={() => setShowSubModal(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSub ? "تعديل تصنيف فرعي" : "إضافة تصنيف فرعي"}</h2>
              <button
                className="close-btn"
                onClick={() => setShowSubModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">
                    اسم التصنيف الفرعي (عربي)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={subFormData.name}
                    onChange={(e) =>
                      setSubFormData({ ...subFormData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    اسم التصنيف الفرعي (إنجليزي)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={subFormData.nameEn}
                    onChange={(e) =>
                      setSubFormData({ ...subFormData, nameEn: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowSubModal(false)}
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
                  ) : editingSub ? (
                    "حفظ التغييرات"
                  ) : (
                    "إضافة"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
