/**
 * Tap Payments Service
 * خدمة التكامل مع تاب - الفرونت إند
 * تعرض جميع وسائل الدفع المفعّلة (mada, KNET, Visa, Master, AMEX, Apple Pay, Google Pay...)
 * عبر صفحة تاب المستضافة باستخدام مصدر src_all.
 */

import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();

/**
 * بيانات العميل
 */
interface TapCustomer {
  name: string;
  email: string;
  phone: string;
}

/**
 * طلب إنشاء عملية دفع
 */
interface CreateTapChargeRequest {
  amount: string;
  currency?: string;
  description?: string;
  customer: TapCustomer;
  order_reference_id: string;
  redirect_url: string;
  source_id?: string;
  // بيانات الطلب الكاملة — تُخزَّن في الخادم ويُنشأ منها الطلب عند تأكيد الدفع فعلياً
  orderData?: Record<string, unknown>;
}

/**
 * نتيجة إنشاء عملية الدفع
 */
interface TapChargeResult {
  id?: string;
  status?: string;
  redirect_url?: string | null;
}

/**
 * نتيجة حالة الدفع
 */
interface TapChargeStatus {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  order_reference_id?: string | null;
  payment_method?: string | null;
}

/**
 * إنشاء عملية دفع تاب (تُرجع رابط صفحة الدفع المستضافة)
 */
export async function createTapCharge(
  request: CreateTapChargeRequest
): Promise<TapChargeResult> {
  const createCharge = httpsCallable<CreateTapChargeRequest, TapChargeResult>(
    functions,
    "tapCreateCharge"
  );
  const result = await createCharge(request);
  return result.data;
}

/**
 * التحقق من حالة الدفع وتأكيده — الخادم يُنشئ/يُعلّم الطلب مدفوعاً عند CAPTURED
 */
export async function getTapChargeStatus(
  chargeId: string,
  orderReferenceId?: string
): Promise<TapChargeStatus> {
  const getStatus = httpsCallable<
    { chargeId: string; order_reference_id?: string },
    TapChargeStatus
  >(functions, "tapGetChargeStatus");
  const result = await getStatus({
    chargeId,
    order_reference_id: orderReferenceId,
  });
  return result.data;
}

/**
 * حفظ إعدادات تاب (للأدمن)
 */
export async function saveTapSettings(
  secretKey: string,
  publicKey: string
): Promise<{ success: boolean; message: string }> {
  const saveSettings = httpsCallable(functions, "tapSaveSettings");
  const result = await saveSettings({ secretKey, publicKey });
  return result.data as { success: boolean; message: string };
}

/**
 * اختبار الاتصال بتاب (للأدمن)
 */
export async function testTapConnection(
  secretKey: string,
  publicKey: string
): Promise<{ success: boolean; message: string }> {
  const testConnection = httpsCallable(functions, "tapTestConnection");
  const result = await testConnection({ secretKey, publicKey });
  return result.data as { success: boolean; message: string };
}
