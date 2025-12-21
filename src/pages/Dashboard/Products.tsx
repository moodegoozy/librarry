import React, { useState, useRef, useEffect } from 'react';
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
  Loader
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { 
  subscribeToProducts, 
  addProduct as addProductToFirestore,
  updateProduct as updateProductInFirestore,
  deleteProduct as deleteProductFromFirestore
} from '../../services/firestore';
import type { Product } from '../../types';
import './Products.css';

const Products: React.FC = () => {
  const { products, setProducts } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    description: '',
    price: '',
    oldPrice: '',
    category: '',
    stock: '',
    featured: false,
    images: [] as string[]
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // الاشتراك في تحديثات المنتجات من Firestore
  useEffect(() => {
    const unsubscribe = subscribeToProducts((firestoreProducts) => {
      setProducts(firestoreProducts);
    });
    return () => unsubscribe();
  }, [setProducts]);

  const filteredProducts = products.filter(p => 
    p.name.includes(searchQuery) || p.nameEn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        nameEn: product.nameEn,
        description: product.description,
        price: product.price.toString(),
        oldPrice: product.oldPrice?.toString() || '',
        category: product.category,
        stock: product.stock.toString(),
        featured: product.featured,
        images: product.images
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        nameEn: '',
        description: '',
        price: '',
        oldPrice: '',
        category: '',
        stock: '',
        featured: false,
        images: []
      });
    }
    setShowModal(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({
            ...prev,
            images: [...prev.images, reader.result as string]
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const productData = {
        name: formData.name,
        nameEn: formData.nameEn,
        description: formData.description,
        price: parseFloat(formData.price),
        oldPrice: formData.oldPrice ? parseFloat(formData.oldPrice) : undefined,
        category: formData.category,
        images: formData.images.length ? formData.images : ['https://via.placeholder.com/300'],
        stock: parseInt(formData.stock),
        featured: formData.featured,
        createdAt: editingProduct?.createdAt || new Date(),
        updatedAt: new Date()
      };

      if (editingProduct) {
        await updateProductInFirestore(editingProduct.id, productData);
      } else {
        await addProductToFirestore(productData);
      }

      setShowModal(false);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('حدث خطأ أثناء حفظ المنتج');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      try {
        await deleteProductFromFirestore(id);
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('حدث خطأ أثناء حذف المنتج');
      }
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ar-SA').format(price);
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
          <button className="btn btn-outline">
            <Upload size={18} />
            استيراد
          </button>
          <button className="btn btn-outline">
            <Download size={18} />
            تصدير
          </button>
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
          <select className="filter-select">
            <option value="">كل التصنيفات</option>
            <option value="phones">الجوالات</option>
            <option value="laptops">اللابتوبات</option>
            <option value="tvs">التلفزيونات</option>
          </select>
          <select className="filter-select">
            <option value="">الحالة</option>
            <option value="in-stock">متوفر</option>
            <option value="out-of-stock">نفذت الكمية</option>
          </select>
          <button className="btn btn-outline btn-sm">
            <Filter size={16} />
            فلترة
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
                  <input type="checkbox" />
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
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    <div className="product-cell">
                      <img src={product.images[0]} alt={product.name} className="product-thumb" />
                      <div>
                        <span className="product-name">{product.name}</span>
                        <span className="product-id">#{product.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>{product.category}</td>
                  <td>
                    <div className="price-cell">
                      <span className="current-price">{formatPrice(product.price)} ر.س</span>
                      {product.oldPrice && (
                        <span className="old-price">{formatPrice(product.oldPrice)} ر.س</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`stock-badge ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                      {product.stock > 0 ? `${product.stock} وحدة` : 'نفذت'}
                    </span>
                  </td>
                  <td>
                    {product.featured && <span className="badge badge-primary">مميز</span>}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button className="action-btn" title="عرض">
                        <Eye size={16} />
                      </button>
                      <button className="action-btn" title="تعديل" onClick={() => handleOpenModal(product)}>
                        <Edit size={16} />
                      </button>
                      <button className="action-btn delete" title="حذف" onClick={() => handleDelete(product.id)}>
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
          <span className="pagination-info">عرض 1-{filteredProducts.length} من {filteredProducts.length} منتج</span>
          <div className="pagination-buttons">
            <button className="pagination-btn" disabled>السابق</button>
            <button className="pagination-btn active">1</button>
            <button className="pagination-btn">2</button>
            <button className="pagination-btn">3</button>
            <button className="pagination-btn">التالي</button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
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
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">اسم المنتج (إنجليزي)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">الوصف</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">السعر (ر.س)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">السعر القديم (ر.س)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.oldPrice}
                      onChange={(e) => setFormData({ ...formData, oldPrice: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">التصنيف</label>
                    <select
                      className="form-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      <option value="">اختر التصنيف</option>
                      <option value="الجوالات">الجوالات</option>
                      <option value="اللابتوبات">اللابتوبات</option>
                      <option value="التلفزيونات">التلفزيونات</option>
                      <option value="الألعاب">الألعاب</option>
                      <option value="السماعات">السماعات</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">المخزون</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
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
                    style={{ display: 'none' }}
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
                              onClick={(e) => { e.stopPropagation(); removeImage(index); }}
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
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} disabled={loading}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <Loader className="spinner" size={18} /> : (editingProduct ? 'حفظ التغييرات' : 'إضافة المنتج')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
