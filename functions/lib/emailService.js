"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderStatusUpdateEmail = exports.sendOrderConfirmationEmail = void 0;
const nodemailer = __importStar(require("nodemailer"));
const admin = __importStar(require("firebase-admin"));
// Get email settings from Firestore
// Checks both settings/email (dedicated) and settings/store.email (dashboard saves here)
const getEmailSettings = async () => {
    // Try dedicated email document first
    const emailDoc = await admin
        .firestore()
        .collection("settings")
        .doc("email")
        .get();
    if (emailDoc.exists) {
        const data = emailDoc.data();
        if (data.smtpHost && data.smtpUser && data.smtpPassword && data.fromEmail) {
            return data;
        }
    }
    // Fallback: check settings/store → email field (Dashboard saves here)
    const storeDoc = await admin
        .firestore()
        .collection("settings")
        .doc("store")
        .get();
    if (storeDoc.exists) {
        const storeData = storeDoc.data();
        const data = storeData === null || storeData === void 0 ? void 0 : storeData.email;
        if (data && data.smtpHost && data.smtpUser && data.smtpPassword && data.fromEmail) {
            return data;
        }
    }
    console.log("Email settings not configured in either settings/email or settings/store.email - skipping email");
    return null;
};
// Format price
const formatPrice = (price) => {
    return new Intl.NumberFormat("ar-SA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
};
// Order confirmation email template - Premium Design
const getOrderConfirmationTemplate = (order) => {
    const itemsHtml = order.items
        .map((item) => `
      <tr>
        <td style="padding: 16px 12px; border-bottom: 1px solid rgba(0,0,0,0.06);">
          <div style="display: flex; align-items: center;">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 12px; margin-left: 14px; border: 1px solid rgba(0,0,0,0.08);">` : `<div style="width: 56px; height: 56px; background: linear-gradient(135deg, #f0f4ff, #e8ecf4); border-radius: 12px; margin-left: 14px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 22px;">📦</span></div>`}
            <div>
              <span style="font-weight: 600; color: #1a1a2e; font-size: 14px; line-height: 1.4; display: block;">${item.name}</span>
              <span style="color: #94a3b8; font-size: 12px; margin-top: 4px; display: block;">الكمية: ${item.quantity}</span>
            </div>
          </div>
        </td>
        <td style="padding: 16px 12px; border-bottom: 1px solid rgba(0,0,0,0.06); text-align: left; font-weight: 700; color: #1a1a2e; font-size: 14px; white-space: nowrap;">${formatPrice(item.price * item.quantity)} ر.س</td>
      </tr>
    `)
        .join("");
    const paymentMethodText = order.paymentMethod === "cash"
        ? "💵 الدفع عند الاستلام"
        : order.paymentMethod === "bank"
            ? "🏦 تحويل بنكي"
            : order.paymentMethod === "tabby"
                ? "💳 تابي - تقسيط على 4 دفعات"
                : order.paymentMethod === "tamara"
                    ? "💳 تمارا - تقسيط على 3 دفعات"
                    : "💳 بطاقة ائتمان";
    const orderNumber = order.id.slice(-8).toUpperCase();
    const orderDate = new Date(order.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>شكراً لطلبك - متجر جبوري</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5; direction: rtl; -webkit-font-smoothing: antialiased;">
  
  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f2f5;">
    <tr>
      <td align="center" style="padding: 30px 16px;">
        
        <!-- Main Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);">
          
          <!-- Premium Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #334155 100%); padding: 0; position: relative;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 40px 40px 30px 40px; text-align: center;">
                    <!-- Decorative circles -->
                    <div style="font-size: 48px; margin-bottom: 8px;">⚡</div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">متجر جبوري</h1>
                    <p style="color: #c9a227; margin: 8px 0 0 0; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">JABORY ELECTRONICS</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold Accent Bar -->
          <tr>
            <td style="background: linear-gradient(90deg, #c9a227, #f4d03f, #c9a227); height: 4px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
          <!-- Thank You Section -->
          <tr>
            <td style="background: linear-gradient(180deg, #ffffff 0%, #fafbfc 100%); padding: 48px 40px 32px 40px; text-align: center;">
              
              <!-- Success Badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="background: linear-gradient(135deg, #22c55e, #16a34a); width: 72px; height: 72px; border-radius: 50%; text-align: center; vertical-align: middle; box-shadow: 0 8px 24px rgba(34,197,94,0.3);">
                    <span style="color: white; font-size: 32px; line-height: 72px;">✓</span>
                  </td>
                </tr>
              </table>

              <h2 style="color: #0f172a; margin: 24px 0 8px 0; font-size: 24px; font-weight: 800;">شكراً لشرائك، ${order.customer}! 🎉</h2>
              <p style="color: #64748b; margin: 0 0 24px 0; font-size: 15px; line-height: 1.7;">
                تم استلام طلبك بنجاح وسنعمل على تجهيزه في أسرع وقت
              </p>

              <!-- Order Number Card -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="width: 100%; max-width: 320px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 24px 30px; text-align: center; box-shadow: 0 4px 16px rgba(15,23,42,0.15);">
                    <p style="color: #94a3b8; margin: 0 0 8px 0; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">رقم الطلب</p>
                    <p style="color: #c9a227; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 3px; font-family: 'Courier New', monospace;">#${orderNumber}</p>
                  </td>
                </tr>
              </table>

              <p style="color: #94a3b8; margin: 16px 0 0 0; font-size: 13px;">📅 ${orderDate}</p>
            </td>
          </tr>

          <!-- Order Items -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              
              <!-- Section Header -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 24px 0 16px 0; border-bottom: 2px solid #f1f5f9;">
                    <h3 style="color: #0f172a; font-size: 17px; margin: 0; font-weight: 700;">📦 تفاصيل طلبك</h3>
                  </td>
                </tr>
              </table>

              <!-- Items Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Order Summary -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px;">
                    ${order.subtotal ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">المجموع الفرعي</td>
                        <td style="padding: 6px 0; color: #334155; font-size: 14px; text-align: left; font-weight: 600;">${formatPrice(order.subtotal)} ر.س</td>
                      </tr>
                    </table>
                    ` : ""}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">🚚 الشحن</td>
                        <td style="padding: 6px 0; color: ${order.shippingCost === 0 ? "#22c55e" : "#334155"}; font-size: 14px; text-align: left; font-weight: 600;">${order.shippingCost === 0 ? "✨ مجاني" : `${formatPrice(order.shippingCost || 0)} ر.س`}</td>
                      </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">طريقة الدفع</td>
                        <td style="padding: 6px 0; color: #334155; font-size: 14px; text-align: left; font-weight: 600;">${paymentMethodText}</td>
                      </tr>
                    </table>
                    
                    <!-- Total -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; border-top: 2px solid rgba(0,0,0,0.08);">
                      <tr>
                        <td style="padding: 20px 0 4px 0; color: #0f172a; font-size: 16px; font-weight: 700;">💰 الإجمالي</td>
                        <td style="padding: 20px 0 4px 0; text-align: left;">
                          <span style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #c9a227; padding: 8px 20px; border-radius: 10px; font-size: 20px; font-weight: 800; display: inline-block;">${formatPrice(order.total)} ر.س</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Info -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px 24px; border-bottom: 1px solid #f1f5f9;">
                    <h3 style="color: #0f172a; font-size: 15px; margin: 0; font-weight: 700;">📍 عنوان التوصيل</h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; width: 80px;">الاسم:</td>
                        <td style="padding: 5px 0; color: #1e293b; font-weight: 600;">${order.customer}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b;">الجوال:</td>
                        <td style="padding: 5px 0; color: #1e293b; font-weight: 600; direction: ltr; text-align: right;">${order.phone}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; vertical-align: top;">العنوان:</td>
                        <td style="padding: 5px 0; color: #1e293b; font-weight: 600; line-height: 1.6;">${order.shippingAddress}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Steps -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 40px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%); border-radius: 16px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <h3 style="color: #1e40af; font-size: 16px; margin: 0 0 16px 0; font-weight: 700;">ماذا بعد؟</h3>
                    <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                      <tr>
                        <td style="padding: 6px 16px; text-align: right;">
                          <span style="color: #3b82f6; font-size: 18px; margin-left: 8px;">①</span>
                          <span style="color: #334155; font-size: 13px;">سنراجع طلبك ونبدأ التجهيز</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 16px; text-align: right;">
                          <span style="color: #3b82f6; font-size: 18px; margin-left: 8px;">②</span>
                          <span style="color: #334155; font-size: 13px;">سنخبرك عند شحن الطلب برقم التتبع</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 16px; text-align: right;">
                          <span style="color: #3b82f6; font-size: 18px; margin-left: 8px;">③</span>
                          <span style="color: #334155; font-size: 13px;">استلم طلبك واستمتع! 🎊</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Premium Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 40px; text-align: center;">
              <p style="color: #c9a227; margin: 0 0 6px 0; font-size: 18px; font-weight: 700;">متجر جبوري</p>
              <p style="color: #64748b; margin: 0 0 20px 0; font-size: 12px; letter-spacing: 1px;">للإلكترونيات والأجهزة الذكية</p>
              
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="padding: 0 12px;">
                    <a href="tel:0556122411" style="color: #94a3b8; font-size: 13px; text-decoration: none;">📞 0556122411</a>
                  </td>
                  <td style="color: #334155;">|</td>
                  <td style="padding: 0 12px;">
                    <a href="https://jabouri-digital-library.web.app" style="color: #94a3b8; font-size: 13px; text-decoration: none;">🌐 jabory.com</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);">
                <p style="color: #475569; margin: 0; font-size: 11px;">هذا الإيميل تم إرساله تلقائياً من متجر جبوري</p>
                <p style="color: #475569; margin: 4px 0 0 0; font-size: 11px;">© ${new Date().getFullYear()} جبوري للإلكترونيات — جميع الحقوق محفوظة</p>
              </div>
            </td>
          </tr>

        </table>
        <!-- End Main Container -->

      </td>
    </tr>
  </table>
  <!-- End Wrapper -->

</body>
</html>
  `;
};
// Send order confirmation email
const sendOrderConfirmationEmail = async (order) => {
    try {
        const settings = await getEmailSettings();
        // If email settings not configured, skip gracefully
        if (!settings) {
            console.log("Email settings not configured - order confirmation email skipped");
            return { success: true, skipped: true };
        }
        const transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpPort === 465,
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPassword,
            },
        });
        const htmlContent = getOrderConfirmationTemplate(order);
        const mailOptions = {
            from: `"${settings.fromName}" <${settings.fromEmail}>`,
            to: order.email,
            subject: `✨ شكراً لشرائك من متجر جبوري — طلبك #${order.id.slice(-8).toUpperCase()}`,
            html: htmlContent,
        };
        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent to ${order.email}`);
        return { success: true };
    }
    catch (error) {
        console.error("Error sending order confirmation email:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
};
exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
// Order status update email template
const sendOrderStatusUpdateEmail = async (order) => {
    const statusLabels = {
        processing: {
            label: "قيد التجهيز",
            color: "#3b82f6",
            message: "نحن نعمل على تجهيز طلبك الآن",
        },
        shipped: {
            label: "تم الشحن",
            color: "#8b5cf6",
            message: "طلبك في الطريق إليك!",
        },
        delivered: {
            label: "تم التسليم",
            color: "#22c55e",
            message: "تم توصيل طلبك بنجاح",
        },
        cancelled: {
            label: "ملغي",
            color: "#ef4444",
            message: "تم إلغاء طلبك",
        },
    };
    const statusInfo = statusLabels[order.status];
    if (!statusInfo) {
        return { success: false, error: "Invalid status" };
    }
    try {
        const settings = await getEmailSettings();
        // If email settings not configured, skip gracefully
        if (!settings) {
            console.log("Email settings not configured - status update email skipped");
            return { success: true, skipped: true };
        }
        const transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpPort === 465,
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPassword,
            },
        });
        const trackingHtml = order.trackingNumber
            ? `
      <div style="background: #ede9fe; border-radius: 12px; padding: 20px; margin-top: 20px; text-align: center;">
        <p style="color: #7c3aed; margin: 0 0 10px 0; font-size: 14px;">رقم التتبع</p>
        <p style="color: #5b21b6; margin: 0; font-size: 20px; font-weight: 700;">${order.trackingNumber}</p>
        ${order.trackingUrl ? `<a href="${order.trackingUrl}" style="display: inline-block; margin-top: 15px; background: #8b5cf6; color: white; padding: 10px 25px; border-radius: 8px; text-decoration: none; font-weight: 600;">تتبع الشحنة</a>` : ""}
      </div>
    `
            : "";
        const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; direction: rtl;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">متجر جبوري</h1>
    </div>

    <div style="padding: 30px; text-align: center;">
      <div style="width: 80px; height: 80px; background: ${statusInfo.color}; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 36px;">${order.status === "delivered" ? "✓" : order.status === "shipped" ? "🚚" : order.status === "processing" ? "📦" : "✕"}</span>
      </div>
      <h2 style="color: ${statusInfo.color}; margin: 0 0 10px 0; font-size: 24px;">${statusInfo.label}</h2>
      <p style="color: #64748b; margin: 0; font-size: 16px;">${statusInfo.message}</p>

      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 25px;">
        <p style="color: #64748b; margin: 0 0 5px 0; font-size: 13px;">رقم الطلب</p>
        <p style="color: #2563eb; margin: 0; font-size: 18px; font-weight: 700;">#${order.id.slice(-8).toUpperCase()}</p>
      </div>

      ${trackingHtml}

      <p style="color: #64748b; margin: 30px 0 0 0; font-size: 14px;">مرحباً ${order.customer}،</p>
      <p style="color: #334155; margin: 10px 0 0 0; font-size: 14px;">${statusInfo.message}</p>
    </div>

    <div style="background: #1e293b; padding: 25px; text-align: center;">
      <p style="color: rgba(255,255,255,0.5); margin: 0; font-size: 12px;">© ${new Date().getFullYear()} متجر جبوري</p>
    </div>

  </div>
</body>
</html>
    `;
        await transporter.sendMail({
            from: `"${settings.fromName}" <${settings.fromEmail}>`,
            to: order.email,
            subject: `تحديث طلبك #${order.id.slice(-8).toUpperCase()} - ${statusInfo.label}`,
            html: htmlContent,
        });
        return { success: true };
    }
    catch (error) {
        console.error("Error sending status update email:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
};
exports.sendOrderStatusUpdateEmail = sendOrderStatusUpdateEmail;
//# sourceMappingURL=emailService.js.map