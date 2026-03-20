/**
 * Tamara Payment Service
 * خدمة التكامل مع تمارا - الفرونت إند
 */

import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();

/**
 * واجهة عنصر السلة
 */
interface TamaraItem {
  reference_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  image_url?: string;
}

/**
 * واجهة بيانات المستهلك
 */
interface TamaraConsumer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

/**
 * واجهة عنوان الشحن
 */
interface TamaraShippingAddress {
  first_name: string;
  last_name: string;
  line1: string;
  city: string;
  phone: string;
}

/**
 * واجهة إنشاء جلسة الدفع
 */
interface CreateCheckoutRequest {
  orderReferenceId: string;
  totalAmount: number;
  currency?: string;
  items: TamaraItem[];
  consumer: TamaraConsumer;
  shippingAddress: TamaraShippingAddress;
  shippingAmount?: number;
  successUrl: string;
  failureUrl: string;
  cancelUrl: string;
  description?: string;
}

/**
 * واجهة نتيجة إنشاء جلسة الدفع
 */
interface CheckoutResult {
  checkout_id: string;
  checkout_url: string;
  status: string;
}

/**
 * إنشاء جلسة دفع تمارا
 */
export async function createTamaraCheckout(
  request: CreateCheckoutRequest
): Promise<CheckoutResult> {
  const createCheckout = httpsCallable<CreateCheckoutRequest, CheckoutResult>(
    functions,
    "tamaraCreateCheckout"
  );

  const result = await createCheckout(request);
  return result.data;
}

/**
 * التحقق من حالة الدفع
 */
export async function getTamaraPaymentStatus(
  checkoutId: string
): Promise<{
  order_id: string;
  status: string;
  payment_type: string;
  total_amount: {
    amount: number;
    currency: string;
  };
}> {
  const getStatus = httpsCallable(functions, "tamaraGetPaymentStatus");
  const result = await getStatus({ checkoutId });
  return result.data as any;
}

/**
 * تأكيد الطلب بعد نجاح الدفع
 */
export async function authorizeTamaraOrder(
  orderId: string,
  firestoreOrderId?: string
): Promise<{
  order_id: string;
  status: string;
  authorized_amount: {
    amount: number;
    currency: string;
  };
}> {
  const authorize = httpsCallable(functions, "tamaraAuthorizeOrder");
  const result = await authorize({ orderId, firestoreOrderId });
  return result.data as any;
}

/**
 * حفظ إعدادات تمارا (للأدمن)
 */
export async function saveTamaraSettings(
  apiToken: string
): Promise<{ success: boolean; message: string }> {
  const saveSettings = httpsCallable(functions, "tamaraSaveSettings");
  const result = await saveSettings({ apiToken });
  return result.data as any;
}

/**
 * اختبار الاتصال بتمارا (للأدمن)
 */
export async function testTamaraConnection(
  apiToken: string
): Promise<{ success: boolean; message: string }> {
  const testConnection = httpsCallable(functions, "tamaraTestConnection");
  const result = await testConnection({ apiToken });
  return result.data as any;
}
