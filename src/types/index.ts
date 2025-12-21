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
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
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
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin';
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
