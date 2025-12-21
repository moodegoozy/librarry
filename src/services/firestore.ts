import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Product, Category } from '../types';

// ==================== Products ====================

export const productsCollection = collection(db, 'products');

export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(query(productsCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date()
  })) as Product[];
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<string> => {
  const docRef = await addDoc(productsCollection, {
    ...product,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
};

export const updateProduct = async (id: string, product: Partial<Product>): Promise<void> => {
  const docRef = doc(db, 'products', id);
  await updateDoc(docRef, {
    ...product,
    updatedAt: Timestamp.now()
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  const docRef = doc(db, 'products', id);
  await deleteDoc(docRef);
};

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  return onSnapshot(query(productsCollection, orderBy('createdAt', 'desc')), (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as Product[];
    callback(products);
  });
};

// ==================== Categories ====================

export const categoriesCollection = collection(db, 'categories');

export const getCategories = async (): Promise<Category[]> => {
  const snapshot = await getDocs(query(categoriesCollection, orderBy('order', 'asc')));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date()
  })) as Category[];
};

export const addCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
  const docRef = await addDoc(categoriesCollection, {
    ...category,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
};

export const updateCategory = async (id: string, category: Partial<Category>): Promise<void> => {
  const docRef = doc(db, 'categories', id);
  await updateDoc(docRef, {
    ...category,
    updatedAt: Timestamp.now()
  });
};

export const deleteCategory = async (id: string): Promise<void> => {
  const docRef = doc(db, 'categories', id);
  await deleteDoc(docRef);
};

export const subscribeToCategories = (callback: (categories: Category[]) => void) => {
  return onSnapshot(query(categoriesCollection, orderBy('order', 'asc')), (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as Category[];
    callback(categories);
  });
};

// ==================== Orders ====================

export const ordersCollection = collection(db, 'orders');

export interface FirestoreOrder {
  id: string;
  customer: string;
  email: string;
  phone: string;
  items: { productId: string; name: string; quantity: number; price: number }[];
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: string;
  shippingAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export const getOrders = async (): Promise<FirestoreOrder[]> => {
  const snapshot = await getDocs(query(ordersCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date()
  })) as FirestoreOrder[];
};

export const addOrder = async (order: Omit<FirestoreOrder, 'id'>): Promise<string> => {
  const docRef = await addDoc(ordersCollection, {
    ...order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  return docRef.id;
};

export const updateOrderStatus = async (id: string, status: FirestoreOrder['status']): Promise<void> => {
  const docRef = doc(db, 'orders', id);
  await updateDoc(docRef, {
    status,
    updatedAt: Timestamp.now()
  });
};

export const subscribeToOrders = (callback: (orders: FirestoreOrder[]) => void) => {
  return onSnapshot(query(ordersCollection, orderBy('createdAt', 'desc')), (snapshot) => {
    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as FirestoreOrder[];
    callback(orders);
  });
};

// Aliases for consistent naming
export const addProductToFirestore = addProduct;
export const updateProductInFirestore = updateProduct;
export const deleteProductFromFirestore = deleteProduct;
export const addCategoryToFirestore = addCategory;
export const updateCategoryInFirestore = updateCategory;
export const deleteCategoryFromFirestore = deleteCategory;
export const updateOrderStatusInFirestore = updateOrderStatus;

// Export Order type alias
export type Order = FirestoreOrder;
