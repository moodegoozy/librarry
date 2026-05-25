import { getFunctions, httpsCallable } from "firebase/functions";
import app from "../config/firebase";

const functions = getFunctions(app);

// ==================== أنواع ====================

export interface WooKeysStatus {
  exists: boolean;
  consumerKey?: string | null;
  enabled?: boolean;
  rotatedAt?: string | null;
}

export interface GeneratedKeys {
  consumerKey: string;
  consumerSecret: string;
}

// ==================== دوال ====================

export async function generateM5aznKeys(): Promise<GeneratedKeys> {
  const fn = httpsCallable(functions, "wooGenerateKeys");
  const res = await fn({});
  return res.data as GeneratedKeys;
}

export async function getM5aznKeysStatus(): Promise<WooKeysStatus> {
  const fn = httpsCallable(functions, "wooGetKeysStatus");
  const res = await fn({});
  return res.data as WooKeysStatus;
}

export async function setM5aznEnabled(enabled: boolean): Promise<{ ok: boolean; enabled: boolean }> {
  const fn = httpsCallable(functions, "wooSetEnabled");
  const res = await fn({ enabled });
  return res.data as { ok: boolean; enabled: boolean };
}

/**
 * يُعيد عنوان REST الأساسي الذي يجب وضعه في خانة "رابط المتجر" بلوحة مخازن.
 * هذا هو دومين الـ Cloud Function. مخازن سيُضيف /wp-json/wc/v3 من جهته.
 *
 * إذا كنت تستخدم نطاق هوست مخصص + Firebase Hosting rewrite، يمكن استخدام
 * https://<your-domain> مباشرة بعد إضافة rewrite في firebase.json.
 */
export function getStoreApiBaseUrl(): string {
  // مشروع Firebase: jabouri-digital-library, المنطقة الافتراضية: us-central1
  const projectId = "jabouri-digital-library";
  const region = "us-central1";
  return `https://${region}-${projectId}.cloudfunctions.net/wcApi`;
}

export function getHostingApiBaseUrl(): string {
  return "https://jabouri-digital-library.web.app";
}
