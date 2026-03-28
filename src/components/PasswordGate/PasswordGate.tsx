import React, { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import "./PasswordGate.css";

const STORE_PASSWORD_HASH = "a1b2c3d4e5"; // identifier key
const STORAGE_KEY = "jabory_access";

const PasswordGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === STORE_PASSWORD_HASH) {
      setAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "aqswde1234") {
      sessionStorage.setItem(STORAGE_KEY, STORE_PASSWORD_HASH);
      setAuthenticated(true);
      setError("");
    } else {
      setError("كلمة المرور غير صحيحة");
    }
  };

  if (loading) return null;
  if (authenticated) return <>{children}</>;

  return (
    <div className="password-gate">
      <div className="password-gate-card">
        <div className="password-gate-icon">
          <Lock size={40} />
        </div>
        <h2>جبوري للإلكترونيات</h2>
        <p>هذا المتجر خاص. أدخل كلمة المرور للدخول</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="كلمة المرور"
            autoFocus
          />
          {error && <div className="password-gate-error">{error}</div>}
          <button type="submit">دخول</button>
        </form>
      </div>
    </div>
  );
};

export default PasswordGate;
