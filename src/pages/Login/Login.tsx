import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useStore } from '../../store/useStore';
import { getUserById, createOrUpdateUser } from '../../services/firestore';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // جلب بيانات المستخدم من Firestore
      let userData = await getUserById(firebaseUser.uid);
      
      if (!userData) {
        // إنشاء مستخدم جديد في Firestore
        userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'مستخدم',
          role: 'customer', // العملاء الجدد كـ customer
          addresses: [],
          createdAt: new Date()
        };
        await createOrUpdateUser(userData);
      }
      
      setUser(userData);
      
      // توجيه حسب الدور
      if (userData.role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/user-not-found') {
        setError('لا يوجد حساب بهذا البريد الإلكتروني');
      } else if (firebaseError.code === 'auth/wrong-password') {
        setError('كلمة المرور غير صحيحة');
      } else if (firebaseError.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني غير صالح');
      } else if (firebaseError.code === 'auth/invalid-credential') {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // جلب أو إنشاء المستخدم في Firestore
      let userData = await getUserById(firebaseUser.uid);
      
      if (!userData) {
        userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'مستخدم',
          role: 'customer',
          addresses: [],
          createdAt: new Date()
        };
        await createOrUpdateUser(userData);
      }
      
      setUser(userData);
      
      if (userData.role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string };
      if (firebaseError.code === 'auth/popup-closed-by-user') {
        setError('تم إلغاء تسجيل الدخول');
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول بـ Google');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <Link to="/" className="back-home-btn">
          <ArrowRight size={20} />
          العودة للرئيسية
        </Link>
        <div className="login-box">
          <div className="login-header">
            <Link to="/" className="login-logo">
              <span className="logo-text">جبوري</span>
              <span className="logo-sub">للإلكترونيات</span>
            </Link>
            <h1>تسجيل الدخول</h1>
            <p>مرحباً بك مجدداً! سجل دخولك للمتابعة</p>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">البريد الإلكتروني</label>
              <div className="input-icon">
                <Mail size={20} />
                <input
                  type="email"
                  className="form-input"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">كلمة المرور</label>
              <div className="input-icon">
                <Lock size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" />
                <span>تذكرني</span>
              </label>
              <Link to="/forgot-password" className="forgot-link">
                نسيت كلمة المرور؟
              </Link>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-lg btn-block"
              disabled={loading}
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

          <div className="login-divider">
            <span>أو</span>
          </div>

          <div className="social-login">
            <button 
              type="button"
              className="social-btn google"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <span>G</span>
              تسجيل بحساب Google
            </button>
          </div>

          <div className="login-footer">
            <p>
              ليس لديك حساب؟{' '}
              <Link to="/register">إنشاء حساب جديد</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
