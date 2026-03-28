import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  Timestamp,
  increment,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { Product, Category } from "../types";

// ==================== Products ====================

export const productsCollection = collection(db, "products");

export const getProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(
    query(productsCollection, orderBy("createdAt", "desc")),
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Product[];
};

export const addProduct = async (
  product: Omit<Product, "id">,
): Promise<string> => {
  const docRef = await addDoc(productsCollection, {
    ...product,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateProduct = async (
  id: string,
  product: Partial<Product>,
): Promise<void> => {
  const docRef = doc(db, "products", id);
  await updateDoc(docRef, {
    ...product,
    updatedAt: Timestamp.now(),
  });
};

export const deleteProduct = async (id: string): Promise<void> => {
  const docRef = doc(db, "products", id);
  await deleteDoc(docRef);
};

export const decrementStock = async (
  productId: string,
  quantity: number,
): Promise<void> => {
  const docRef = doc(db, "products", productId);
  await updateDoc(docRef, {
    stock: increment(-quantity),
    updatedAt: Timestamp.now(),
  });
};

export const subscribeToProducts = (
  callback: (products: Product[]) => void,
) => {
  return onSnapshot(
    query(productsCollection, orderBy("createdAt", "desc")),
    (snapshot) => {
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Product[];
      callback(products);
    },
  );
};

// ==================== Categories ====================

export const categoriesCollection = collection(db, "categories");

export const getCategories = async (): Promise<Category[]> => {
  const snapshot = await getDocs(
    query(categoriesCollection, orderBy("order", "asc")),
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Category[];
};

export const addCategory = async (
  category: Omit<Category, "id">,
): Promise<string> => {
  const docRef = await addDoc(categoriesCollection, {
    ...category,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateCategory = async (
  id: string,
  category: Partial<Category>,
): Promise<void> => {
  const docRef = doc(db, "categories", id);
  await updateDoc(docRef, {
    ...category,
    updatedAt: Timestamp.now(),
  });
};

export const deleteCategory = async (id: string): Promise<void> => {
  const docRef = doc(db, "categories", id);
  await deleteDoc(docRef);
};

export const subscribeToCategories = (
  callback: (categories: Category[]) => void,
) => {
  return onSnapshot(
    query(categoriesCollection, orderBy("order", "asc")),
    (snapshot) => {
      const categories = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Category[];
      callback(categories);
    },
  );
};

// ==================== Orders ====================

export const ordersCollection = collection(db, "orders");

export interface FirestoreOrder {
  id: string;
  userId?: string;
  customer: string;
  email: string;
  phone: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }[];
  total: number;
  subtotal?: number;
  shippingCost?: number;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentMethod: string;
  paymentStatus?: "pending" | "paid";
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paidAt?: Date;
  shippingAddress: string;
  address?: {
    fullName: string;
    phone: string;
    city: string;
    district: string;
    street: string;
    building?: string;
    nationalAddress?: string;
  };
  notes?: string;
  // حقول CJ Dropshipping
  isCJOrder?: boolean;
  cjOrderId?: string;
  cjOrderNum?: string;
  cjOrderStatus?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  cjLogisticName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const getOrders = async (): Promise<FirestoreOrder[]> => {
  const snapshot = await getDocs(
    query(ordersCollection, orderBy("createdAt", "desc")),
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as FirestoreOrder[];
};

export const addOrder = async (
  order: Omit<FirestoreOrder, "id">,
): Promise<string> => {
  const docRef = await addDoc(ordersCollection, {
    ...order,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateOrderStatus = async (
  id: string,
  status: FirestoreOrder["status"],
): Promise<void> => {
  const docRef = doc(db, "orders", id);
  await updateDoc(docRef, {
    status,
    updatedAt: Timestamp.now(),
  });
};

export const subscribeToOrders = (
  callback: (orders: FirestoreOrder[]) => void,
) => {
  return onSnapshot(
    query(ordersCollection, orderBy("createdAt", "desc")),
    (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as FirestoreOrder[];
      callback(orders);
    },
  );
};

export const deleteOrder = async (id: string): Promise<void> => {
  const docRef = doc(db, "orders", id);
  await deleteDoc(docRef);
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

// ==================== Users ====================

import type { User } from "../types";

export const usersCollection = collection(db, "users");

export const getUser = async (userId: string): Promise<User | null> => {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    } as User;
  }
  return null;
};

export const getUserById = async (userId: string): Promise<User | null> => {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    } as User;
  }
  return null;
};

export const createOrUpdateUser = async (user: User): Promise<void> => {
  const docRef = doc(db, "users", user.id);
  await setDoc(
    docRef,
    {
      email: user.email,
      name: user.name,
      phone: user.phone || "",
      role: user.role,
      addresses: user.addresses || [],
      createdAt: Timestamp.now(),
    },
    { merge: true },
  );
};

export const updateUserRole = async (
  userId: string,
  role: "customer" | "admin",
): Promise<void> => {
  const docRef = doc(db, "users", userId);
  await updateDoc(docRef, { role });
};

export const getAllUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(
    query(usersCollection, orderBy("createdAt", "desc")),
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as User[];
};

export const subscribeToUsers = (callback: (users: User[]) => void) => {
  return onSnapshot(
    query(usersCollection, orderBy("createdAt", "desc")),
    (snapshot) => {
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as User[];
      callback(users);
    },
  );
};

// ==================== User Orders ====================

export const getUserOrders = async (
  userId: string,
): Promise<FirestoreOrder[]> => {
  const q = query(
    ordersCollection,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as FirestoreOrder[];
};

export const subscribeToUserOrders = (
  userId: string,
  callback: (orders: FirestoreOrder[]) => void,
) => {
  const q = query(
    ordersCollection,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as FirestoreOrder[];
    callback(orders);
  });
};

// ==================== Settings ====================

export interface StoreSettings {
  store?: {
    storeName: string;
    storeEmail: string;
    storePhone: string;
    storeAddress: string;
    currency: string;
    language: string;
  };
  shipping?: {
    freeShippingThreshold: number;
    defaultShippingCost: number;
    enableFreeShipping: boolean;
    estimatedDays: string;
  };
  notifications?: {
    orderNotifications: boolean;
    lowStockAlert: boolean;
    customerMessages: boolean;
    marketingEmails: boolean;
    lowStockThreshold: number;
  };
  payment?: {
    methods: { id: string; name: string; enabled: boolean }[];
  };
  updatedAt?: Date;
}

export const getSettings = async (): Promise<StoreSettings | null> => {
  const docRef = doc(db, "settings", "store");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as StoreSettings;
  }
  return null;
};

export const updateSettings = async (
  settings: Partial<StoreSettings>,
): Promise<void> => {
  const docRef = doc(db, "settings", "store");
  await setDoc(
    docRef,
    {
      ...settings,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
};

export const subscribeToSettings = (
  callback: (settings: StoreSettings | null) => void,
) => {
  const docRef = doc(db, "settings", "store");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as StoreSettings);
    } else {
      callback(null);
    }
  });
};

// ==================== Contact Messages ====================

export interface ContactMessage {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export const addContactMessage = async (
  message: Omit<ContactMessage, "id" | "read" | "createdAt">,
): Promise<string> => {
  const docRef = await addDoc(collection(db, "contactMessages"), {
    ...message,
    read: false,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const subscribeToContactMessages = (
  callback: (messages: ContactMessage[]) => void,
) => {
  return onSnapshot(
    query(collection(db, "contactMessages"), orderBy("createdAt", "desc")),
    (snapshot) => {
      const messages = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      })) as ContactMessage[];
      callback(messages);
    },
  );
};

export const markMessageRead = async (id: string): Promise<void> => {
  const docRef = doc(db, "contactMessages", id);
  await updateDoc(docRef, { read: true });
};

export const deleteContactMessage = async (id: string): Promise<void> => {
  const docRef = doc(db, "contactMessages", id);
  await deleteDoc(docRef);
};

// ==================== CJ Dropshipping Settings ====================

import type { CJSettings } from "../types";

export const getCJSettings = async (): Promise<CJSettings | null> => {
  const docRef = doc(db, "settings", "cjDropshipping");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as CJSettings;
  }
  return null;
};

export const updateCJSettings = async (
  settings: Partial<CJSettings>,
): Promise<void> => {
  const docRef = doc(db, "settings", "cjDropshipping");
  await setDoc(
    docRef,
    {
      ...settings,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
};

export const subscribeToCJSettings = (
  callback: (settings: CJSettings | null) => void,
) => {
  const docRef = doc(db, "settings", "cjDropshipping");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as CJSettings);
    } else {
      callback(null);
    }
  });
};

// تحديث طلب مع بيانات CJ
export const updateOrderCJData = async (
  orderId: string,
  cjData: {
    isCJOrder?: boolean;
    cjOrderId?: string;
    cjOrderNum?: string;
    cjOrderStatus?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    cjLogisticName?: string;
  },
): Promise<void> => {
  const docRef = doc(db, "orders", orderId);
  await updateDoc(docRef, {
    ...cjData,
    updatedAt: Timestamp.now(),
  });
};
