import React, { useState, useRef, useEffect } from "react";
import { Phone, ArrowLeft, Loader, Shield } from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import type { ConfirmationResult } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useStore } from "../../store/useStore";
import { getUserById, createOrUpdateUser } from "../../services/firestore";
import "./PhoneAuth.css";

// Extend Window for recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

interface PhoneAuthProps {
  onSuccess?: (user: ReturnType<typeof useStore.getState>["user"]) => void;
  mode?: "login" | "checkout";
  className?: string;
}

const PhoneAuth: React.FC<PhoneAuthProps> = ({
  onSuccess,
  mode = "login",
  className = "",
}) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const { setUser } = useStore();

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      window.recaptchaVerifier = undefined;
      window.confirmationResult = undefined;
    };
  }, []);

  const formatPhoneForFirebase = (phone: string): string => {
    let cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
    // If starts with 05, convert to +966 5
    if (cleaned.startsWith("05")) {
      cleaned = "+966" + cleaned.substring(1);
    }
    // If starts with 5 and is 9 digits
    if (cleaned.startsWith("5") && cleaned.length === 9) {
      cleaned = "+966" + cleaned;
    }
    // If doesn't start with +, assume Saudi
    if (!cleaned.startsWith("+")) {
      cleaned = "+966" + cleaned;
    }
    return cleaned;
  };

  const clearRecaptcha = () => {
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
    window.recaptchaVerifier = undefined;
  };

  const setupRecaptcha = async () => {
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    if (!recaptchaContainerRef.current) {
      throw new Error("reCAPTCHA container is not ready");
    }

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved
      },
      "expired-callback": () => {
        clearRecaptcha();
        setError("انتهت صلاحية التحقق، حاول مرة أخرى");
      },
    });

    await verifier.render();
    recaptchaVerifierRef.current = verifier;
    window.recaptchaVerifier = verifier;

    return verifier;
  };

  // أخطاء دائمة لا فائدة من إعادة المحاولة عليها
  const PERMANENT_OTP_ERRORS = new Set([
    "auth/invalid-phone-number",
    "auth/operation-not-allowed",
    "auth/app-not-authorized",
    "auth/too-many-requests",
    "auth/quota-exceeded",
    "auth/invalid-app-credential",
    "auth/missing-app-credential",
  ]);

  const otpErrorMessage = (code?: string): string => {
    switch (code) {
      case "auth/invalid-phone-number":
        return "رقم الجوال غير صحيح";
      case "auth/operation-not-allowed":
        return "تسجيل الدخول بالجوال غير مفعّل في Firebase";
      case "auth/app-not-authorized":
        return "هذا النطاق غير مصرّح له في إعدادات Firebase Auth";
      case "auth/invalid-app-credential":
        return "تعذر تهيئة التحقق الأمني. أعد تحميل الصفحة وحاول مرة أخرى";
      case "auth/missing-app-credential":
        return "فشل تحميل reCAPTCHA. تحقق من اتصالك ثم أعد المحاولة";
      case "auth/too-many-requests":
        return "محاولات كثيرة، يرجى الانتظار والمحاولة لاحقاً";
      case "auth/quota-exceeded":
        return "تم تجاوز الحد المسموح، حاول لاحقاً";
      default:
        // 503 غالباً = حجب مؤقت من حماية Google بعد محاولات متكررة على نفس الرقم
        return "تعذّر إرسال الرمز لهذا الرقم حالياً — غالباً بسبب محاولات متكررة عليه. انتظر قليلاً وأعد المحاولة، أو جرّب رقم جوال آخر";
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate phone number
    const cleaned = phoneNumber.replace(/\s+/g, "").replace(/-/g, "");
    if (!cleaned.match(/^(05\d{8}|5\d{8}|\+9665\d{8})$/)) {
      setError("يرجى إدخال رقم جوال سعودي صحيح (مثل: 05XXXXXXXX)");
      return;
    }

    setLoading(true);
    const formattedPhone = formatPhoneForFirebase(phoneNumber);
    const maxAttempts = 3; // محاولة أولى + محاولتا إعادة عند الفشل المؤقت
    let lastCode: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // رمز reCAPTCHA يُستهلك بعد كل محاولة — نبنيه من جديد في كل مرة
        clearRecaptcha();
        const appVerifier = await setupRecaptcha();
        const result = await signInWithPhoneNumber(
          auth,
          formattedPhone,
          appVerifier
        );
        window.confirmationResult = result;
        setStep("otp");
        setCountdown(60);
        setError("");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        setLoading(false);
        return;
      } catch (err: unknown) {
        const firebaseError = err as { code?: string; message?: string };
        lastCode = firebaseError.code;
        console.error(`Phone auth attempt ${attempt} failed:`, firebaseError);

        // خطأ دائم — نتوقف فوراً
        if (firebaseError.code && PERMANENT_OTP_ERRORS.has(firebaseError.code)) {
          break;
        }
        // خطأ مؤقت — ننتظر قليلاً (backoff) ونعيد المحاولة تلقائياً
        if (attempt < maxAttempts) {
          setError(
            `خدمة التحقق مشغولة… جارٍ إعادة المحاولة (${attempt}/${maxAttempts - 1})`
          );
          await new Promise((r) => setTimeout(r, 900 * attempt));
        }
      }
    }

    clearRecaptcha();
    setError(otpErrorMessage(lastCode));
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6);
      const newOtp = [...otpCode];
      digits.split("").forEach((d, i) => {
        if (i + index < 6) newOtp[i + index] = d;
      });
      setOtpCode(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      // Auto-verify if all filled
      if (newOtp.every((d) => d !== "")) {
        verifyOtp(newOtp.join(""));
      }
      return;
    }

    const newOtp = [...otpCode];
    newOtp[index] = value.replace(/\D/g, "");
    setOtpCode(newOtp);

    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all filled
    if (newOtp.every((d) => d !== "")) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code: string) => {
    if (!window.confirmationResult) {
      setError("انتهت الجلسة، أعد إرسال الرمز");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await window.confirmationResult.confirm(code);
      const firebaseUser = result.user;

      // Get or create user in Firestore
      let userData = await getUserById(firebaseUser.uid);

      if (!userData) {
        userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          name: firebaseUser.displayName || "",
          phone: firebaseUser.phoneNumber || formatPhoneForFirebase(phoneNumber),
          role: "customer" as const,
          addresses: [],
          createdAt: new Date(),
        };
        await createOrUpdateUser(userData);
      } else if (!userData.phone) {
        // Update phone if missing
        userData.phone = firebaseUser.phoneNumber || formatPhoneForFirebase(phoneNumber);
        await createOrUpdateUser(userData);
      }

      setUser(userData);
      onSuccess?.(userData);
      window.confirmationResult = undefined;
      clearRecaptcha();
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === "auth/invalid-verification-code") {
        setError("رمز التحقق غير صحيح");
      } else if (firebaseError.code === "auth/code-expired") {
        setError("انتهت صلاحية الرمز، أعد الإرسال");
      } else {
        setError("حدث خطأ في التحقق، حاول مرة أخرى");
      }
      setOtpCode(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setStep("phone");
    setOtpCode(["", "", "", "", "", ""]);
    setError("");
    window.confirmationResult = undefined;
    clearRecaptcha();
  };

  return (
    <div className={`phone-auth ${className}`}>
      {/* Invisible reCAPTCHA */}
      <div ref={recaptchaContainerRef}></div>

      {step === "phone" && (
        <form onSubmit={handleSendOtp} className="phone-step">
          {mode === "checkout" && (
            <div className="phone-auth-header">
              <Shield size={20} />
              <span>تحقق من رقم الجوال لإتمام الطلب</span>
            </div>
          )}

          {error && <div className="phone-auth-error">{error}</div>}

          <div className="phone-input-group">
            <div className="phone-prefix">
              <span className="flag">🇸🇦</span>
              <span className="code">+966</span>
            </div>
            <div className="phone-input-wrapper">
              <Phone size={18} />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="05XXXXXXXX"
                className="phone-input"
                dir="ltr"
                autoComplete="tel"
                maxLength={12}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block phone-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={18} className="spinning" />
                جاري الإرسال...
              </>
            ) : (
              "إرسال رمز التحقق"
            )}
          </button>
        </form>
      )}

      {step === "otp" && (
        <div className="otp-step">
          <div className="otp-header">
            <button
              type="button"
              className="otp-back"
              onClick={() => {
                setStep("phone");
                setError("");
                setOtpCode(["", "", "", "", "", ""]);
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="otp-info">
              <h3>أدخل رمز التحقق</h3>
              <p>
                تم إرسال رمز التحقق إلى{" "}
                <span dir="ltr" className="otp-phone">
                  {formatPhoneForFirebase(phoneNumber)}
                </span>
              </p>
            </div>
          </div>

          {error && <div className="phone-auth-error">{error}</div>}

          <div className="otp-inputs">
            {otpCode.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                  handleOtpChange(index, pasted);
                }}
                className={`otp-input ${digit ? "filled" : ""}`}
                autoComplete="one-time-code"
                dir="ltr"
              />
            ))}
          </div>

          {loading && (
            <div className="otp-verifying">
              <Loader size={18} className="spinning" />
              <span>جاري التحقق...</span>
            </div>
          )}

          <div className="otp-resend">
            {countdown > 0 ? (
              <span className="resend-timer">
                إعادة الإرسال بعد <strong>{countdown}</strong> ثانية
              </span>
            ) : (
              <button
                type="button"
                className="resend-btn"
                onClick={handleResend}
              >
                لم يصلك الرمز؟ أعد الإرسال
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneAuth;
