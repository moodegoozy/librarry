import React from "react";
import { Link } from "react-router-dom";
import { Home, Search } from "lucide-react";
import "./NotFound.css";

const NotFound: React.FC = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="error-code">404</h1>
        <h2>الصفحة غير موجودة</h2>
        <p>عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary btn-lg">
            <Home size={18} />
            الصفحة الرئيسية
          </Link>
          <Link to="/products" className="btn btn-outline btn-lg">
            <Search size={18} />
            تصفح المنتجات
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
