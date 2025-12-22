import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, ChevronDown, Grid, List } from 'lucide-react';
import ProductCard from '../../components/ProductCard/ProductCard';
import { useStore } from '../../store/useStore';
import { subscribeToProducts, subscribeToCategories } from '../../services/firestore';
import './Products.css';

const Products: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { products, setProducts, categories, setCategories, searchQuery } = useStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  const categoryParam = searchParams.get('category');
  const featuredParam = searchParams.get('featured');
  const searchParam = searchParams.get('search');

  // الاشتراك في المنتجات والتصنيفات
  useEffect(() => {
    const unsubProducts = subscribeToProducts((firestoreProducts) => {
      setProducts(firestoreProducts);
    });
    const unsubCategories = subscribeToCategories((firestoreCategories) => {
      setCategories(firestoreCategories);
    });

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, [setProducts, setCategories]);

  // فلترة المنتجات
  let filteredProducts = [...products];

  // فلتر حسب التصنيف
  if (categoryParam) {
    filteredProducts = filteredProducts.filter(p => 
      p.category === categoryParam || p.category.toLowerCase() === categoryParam.toLowerCase()
    );
  }

  // فلتر المنتجات المميزة
  if (featuredParam === 'true') {
    filteredProducts = filteredProducts.filter(p => p.featured);
  }

  // فلتر البحث
  const activeSearch = searchParam || searchQuery;
  if (activeSearch) {
    filteredProducts = filteredProducts.filter(p =>
      p.name.includes(activeSearch) ||
      p.nameEn.toLowerCase().includes(activeSearch.toLowerCase()) ||
      p.description.includes(activeSearch)
    );
  }

  // الترتيب
  switch (sortBy) {
    case 'price-low':
      filteredProducts.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      filteredProducts.sort((a, b) => b.price - a.price);
      break;
    case 'name':
      filteredProducts.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      break;
    case 'newest':
    default:
      filteredProducts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  const getPageTitle = () => {
    if (featuredParam === 'true') return 'عروض اليوم';
    if (categoryParam) {
      const cat = categories.find(c => c.id === categoryParam || c.nameEn.toLowerCase() === categoryParam.toLowerCase());
      return cat?.name || categoryParam;
    }
    if (activeSearch) return `نتائج البحث: ${activeSearch}`;
    return 'جميع المنتجات';
  };

  return (
    <div className="products-page">
      <div className="container">
        {/* Page Header */}
        <div className="page-header">
          <h1>{getPageTitle()}</h1>
          <p>{filteredProducts.length} منتج</p>
        </div>

        {/* Toolbar */}
        <div className="products-toolbar">
          <button 
            className="filter-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            الفلاتر
          </button>

          <div className="toolbar-right">
            {/* Sort */}
            <div className="sort-select">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">الأحدث</option>
                <option value="price-low">السعر: من الأقل للأعلى</option>
                <option value="price-high">السعر: من الأعلى للأقل</option>
                <option value="name">الاسم</option>
              </select>
              <ChevronDown size={16} />
            </div>

            {/* View Mode */}
            <div className="view-modes">
              <button 
                className={viewMode === 'grid' ? 'active' : ''} 
                onClick={() => setViewMode('grid')}
              >
                <Grid size={18} />
              </button>
              <button 
                className={viewMode === 'list' ? 'active' : ''} 
                onClick={() => setViewMode('list')}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Sidebar */}
        {showFilters && (
          <div className="filters-sidebar">
            <h3>التصنيفات</h3>
            <ul className="category-list">
              <li>
                <a href="/products" className={!categoryParam ? 'active' : ''}>
                  جميع المنتجات
                </a>
              </li>
              {categories.map(cat => (
                <li key={cat.id}>
                  <a 
                    href={`/products?category=${cat.id}`}
                    className={categoryParam === cat.id ? 'active' : ''}
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className={`products-grid ${viewMode}`}>
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="no-products">
            <p>لا توجد منتجات</p>
            {categoryParam && (
              <a href="/products" className="btn btn-primary">
                عرض جميع المنتجات
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
