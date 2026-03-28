import fetch from "node-fetch";

// PayPal API URLs
const PAYPAL_SANDBOX_URL = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_URL = "https://api-m.paypal.com";

// Get PayPal config from environment variables
function getPayPalConfig() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    mode: process.env.PAYPAL_MODE || "sandbox",
  };
}

// Get the appropriate PayPal API URL based on mode
function getBaseUrl(): string {
  const { mode } = getPayPalConfig();
  return mode === "live" ? PAYPAL_LIVE_URL : PAYPAL_SANDBOX_URL;
}

// Get PayPal access token
async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getPayPalConfig();
  
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const baseUrl = getBaseUrl();

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json() as any;

  if (!response.ok) {
    console.error("PayPal auth error:", data);
    throw new Error(data.error_description || "Failed to get PayPal access token");
  }

  return data.access_token;
}

// Create PayPal order for Smart Buttons
export async function createOrder(orderData: {
  amount: number;
  currency: string;
  orderId: string;
  description: string;
}): Promise<{ id: string; status: string }> {
  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  // PayPal لا يدعم SAR - نحول دائماً إلى USD
  // سعر الصرف التقريبي: 1 SAR ≈ 0.27 USD
  const currency = "USD";
  const amount = orderData.currency === "SAR"
    ? (orderData.amount * 0.27).toFixed(2)
    : orderData.amount.toFixed(2);

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: orderData.orderId,
        description: orderData.description,
        amount: {
          currency_code: currency,
          value: amount,
        },
      },
    ],
    // application_context لتجربة مستخدم أفضل
    application_context: {
      brand_name: "جبوري للإلكترونيات",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: "https://jabouri-digital-library.web.app/checkout/success",
      cancel_url: "https://jabouri-digital-library.web.app/checkout",
    },
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `order-${orderData.orderId}-${Date.now()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as any;

  if (!response.ok) {
    console.error("PayPal create order error:", data);
    throw new Error(data.message || data.details?.[0]?.description || "Failed to create PayPal order");
  }

  return {
    id: data.id,
    status: data.status,
  };
}

// Capture PayPal order (complete the payment)
export async function captureOrder(paypalOrderId: string): Promise<{
  id: string;
  status: string;
  captureId: string;
  amount: string;
  currency: string;
}> {
  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json() as any;

  if (!response.ok) {
    console.error("PayPal capture error:", data);
    throw new Error(data.message || data.details?.[0]?.description || "Failed to capture PayPal payment");
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    id: data.id,
    status: data.status,
    captureId: capture?.id || "",
    amount: capture?.amount?.value || "0",
    currency: capture?.amount?.currency_code || "SAR",
  };
}

// Get order details
export async function getOrderDetails(paypalOrderId: string): Promise<any> {
  const accessToken = await getAccessToken();
  const baseUrl = getBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json() as any;

  if (!response.ok) {
    console.error("PayPal get order error:", data);
    throw new Error(data.message || "Failed to get PayPal order details");
  }

  return data;
}
