import { Truck, Clock, MapPin, CreditCard, Package, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Legal.css';

const Shipping = () => {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <h1>سياسة الشحن والتوصيل</h1>
        <p>كل ما تحتاج معرفته عن شحن وتوصيل طلباتك</p>
      </div>

      <div className="legal-content">
        <div className="legal-section">
          <h2><Truck size={22} /> نطاق التوصيل</h2>
          <p>
            نوفر خدمة الشحن والتوصيل إلى جميع مناطق ومدن المملكة العربية السعودية.
            نتعاون مع أفضل شركات الشحن لضمان وصول طلبك بأمان وفي الوقت المحدد.
          </p>
        </div>

        <div className="legal-section">
          <h2><Clock size={22} /> مدة التوصيل</h2>
          <p>تختلف مدة التوصيل حسب موقعك:</p>
          <ul>
            <li><strong>المدن الرئيسية</strong> (الرياض، جدة، الدمام): من 2 إلى 4 أيام عمل</li>
            <li><strong>المدن الأخرى:</strong> من 4 إلى 7 أيام عمل</li>
            <li><strong>المناطق النائية:</strong> من 7 إلى 10 أيام عمل</li>
          </ul>
          <div className="legal-highlight">
            <p>يتم احتساب أيام العمل من الأحد إلى الخميس، ولا تشمل أيام العطل الرسمية والأعياد.</p>
          </div>
        </div>

        <div className="legal-section">
          <h2><CreditCard size={22} /> رسوم الشحن</h2>
          <p>يتم احتساب رسوم الشحن كالتالي:</p>
          <ul>
            <li><strong>شحن مجاني</strong> للطلبات بقيمة 200 ريال وأكثر</li>
            <li><strong>25 ريال</strong> للطلبات أقل من 200 ريال</li>
            <li>قد تختلف الرسوم للمنتجات كبيرة الحجم أو الوزن</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2><Package size={22} /> تتبع الشحنة</h2>
          <p>
            بعد شحن طلبك، ستتلقى رقم تتبع عبر البريد الإلكتروني أو رسالة نصية.
            يمكنك متابعة حالة شحنتك من خلال حسابك على موقعنا أو من خلال موقع شركة الشحن مباشرة.
          </p>
        </div>

        <div className="legal-section">
          <h2><MapPin size={22} /> عنوان التوصيل</h2>
          <p>لضمان توصيل ناجح، يرجى التأكد من:</p>
          <ul>
            <li>إدخال العنوان الوطني بشكل صحيح وكامل</li>
            <li>توفير رقم هاتف صحيح للتواصل أثناء التوصيل</li>
            <li>التواجد في العنوان المحدد أو توكيل شخص لاستلام الطلب</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2><AlertCircle size={22} /> ملاحظات مهمة</h2>
          <ul>
            <li>يرجى فحص المنتج عند الاستلام والتأكد من سلامة التغليف</li>
            <li>في حالة وجود أي تلف ظاهر، يرجى رفض الاستلام وإبلاغنا فوراً</li>
            <li>في حالة عدم التواجد في العنوان، ستقوم شركة الشحن بمحاولتين إضافيتين للتوصيل</li>
            <li>بعد 3 محاولات فاشلة، سيتم إرجاع الطلب إلينا وقد تُفرض رسوم إعادة شحن</li>
          </ul>
        </div>

        <div className="legal-contact-box">
          <h3>هل تحتاج مساعدة بخصوص الشحن؟</h3>
          <p>فريقنا جاهز لمساعدتك</p>
          <Link to="/contact">تواصل معنا</Link>
        </div>

        <p className="legal-last-updated">آخر تحديث: يناير 2025</p>
      </div>
    </div>
  );
};

export default Shipping;
