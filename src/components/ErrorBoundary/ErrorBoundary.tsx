import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "Tajawal, sans-serif",
            direction: "rtl",
            textAlign: "center",
            padding: "20px",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "40px",
              maxWidth: "500px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: "64px", marginBottom: "16px" }}>⚠️</div>
            <h1
              style={{
                fontSize: "24px",
                color: "#1e293b",
                marginBottom: "12px",
              }}
            >
              حدث خطأ غير متوقع
            </h1>
            <p
              style={{
                color: "#64748b",
                marginBottom: "24px",
                lineHeight: 1.6,
              }}
            >
              نعتذر عن هذا الخطأ. يرجى إعادة تحميل الصفحة أو العودة للرئيسية.
            </p>
            {this.state.error && (
              <details
                style={{
                  marginBottom: "24px",
                  textAlign: "left",
                  direction: "ltr",
                  background: "#fef2f2",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  color: "#ef4444",
                }}
              >
                <summary style={{ cursor: "pointer", marginBottom: "8px" }}>
                  تفاصيل الخطأ
                </summary>
                {this.state.error.message}
              </details>
            )}
            <button
              onClick={this.handleReload}
              style={{
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "12px 32px",
                fontSize: "16px",
                fontFamily: "Tajawal, sans-serif",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
