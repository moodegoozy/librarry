export interface Product {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  subcategory?: string;
  images: string[];
  stock: number;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  specs?: Record<string, string>;
  // حقول الدروبشيبينج
  supplierName?: string; // اسم المورد
  supplierPrice?: number; // سعر المورد (التكلفة)
  supplierUrl?: string; // رابط المنتج عند المورد
  externalId?: string; // معرف المنتج في API الخارجي
  profitMargin?: number; // هامش الربح (%)
  autoSync?: boolean; // مزامنة تلقائية مع المورد
  lastSyncAt?: Date; // آخر مزامنة

  // حقول CJ Dropshipping
  isCJProduct?: boolean; // هل هذا منتج من CJ
  cjProductId?: string; // معرف المنتج في CJ
  cjVariantId?: string; // معرف المتغير في CJ
  cjSku?: string; // SKU في CJ
  cjCategoryId?: string; // تصنيف CJ
  cjSourcePrice?: number; // سعر CJ بالدولار
  cjImageUrl?: string; // رابط صورة CJ الأصلية
}

// أنواع CJ Dropshipping
export interface CJProduct {
  pid: string;
  productNameEn: string;
  productNameAr?: string;
  productSku: string;
  productImage: string;
  productWeight: number;
  productType: string;
  productUnit: string;
  sellPrice: number;
  categoryId: string;
  categoryName: string;
  sourceFrom: number;
  remark: string;
  createTime: string;
  variants: CJVariant[];
}

export interface CJVariant {
  vid: string;
  variantNameEn: string;
  variantSku: string;
  variantImage: string;
  variantStandard: string;
  variantPrice: number;
  variantVolume: number;
  variantWeight: number;
  variantKey: string;
  createTime: string;
}

export interface CJOrderItem {
  vid: string;
  quantity: number;
}

export interface CJOrderRequest {
  orderNumber: string;
  shippingZip: string;
  shippingCountryCode: string;
  shippingCountry: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string;
  shippingCustomerName: string;
  shippingPhone: string;
  remark: string;
  fromCountryCode: string;
  logisticName: string;
  products: CJOrderItem[];
}

export interface CJSettings {
  apiKey: string;
  email: string; // بريد حساب CJ Dropshipping
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  defaultMarkup: number; // نسبة الربح الافتراضية %
  usdToSar: number; // سعر تحويل الدولار إلى ريال
  autoForwardOrders: boolean; // إرسال الطلبات تلقائياً إلى CJ
  defaultWarehouse: string; // المستودع الافتراضي (CN, US, TH, etc.)
  defaultLogistic: string; // شركة الشحن الافتراضية
}

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  image?: string;
  subcategories?: Subcategory[];
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Subcategory {
  id: string;
  name: string;
  nameEn: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  shippingAddress: Address;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  image: string;
}

export interface Address {
  fullName: string;
  phone: string;
  city: string;
  district: string;
  street: string;
  building?: string;
  nationalAddress?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: "customer" | "admin";
  addresses: Address[];
  createdAt: Date;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  recentOrders: Order[];
  monthlyRevenue: { month: string; revenue: number }[];
}
