import { useState } from 'react';
import { ChevronDown, ShoppingCart, Truck, RotateCcw, CreditCard, Shield, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Legal.css';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: React.ReactNode;
  items: FAQItem[];
}

const faqData: FAQCategory[] = [
  {
    title: 'الطلبات والشراء',
    icon: <ShoppingCart size={22} />,
    items: [
      {
        question: 'كيف أقوم بتقديم طلب شراء؟',
        answer: 'اختر المنتج المطلوب، أضفه إلى سلة التسوق، ثم اتبع خطوات إتمام الطلب بإدخال عنوان الشحن واختيار طريقة الدفع. ستتلقى تأكيداً بالبريد الإلكتروني بعد إتمام الطلب.'
      },
      {
        question: 'هل يمكنني تعديل أو إلغاء طلبي بعد تقديمه؟',
        answer: 'يمكنك تعديل أو إلغاء طلبك قبل شحنه. بعد الشحن، يمكنك رفض الاستلام أو طلب الإرجاع وفقاً لسياسة الإرجاع الخاصة بنا.'
      },
      {
        question: 'هل المنتجات المعروضة أصلية؟',
        answer: 'نعم، جميع المنتجات في جبوري للإلكترونيات أصلية 100% ومستوردة من الوكلاء المعتمدين. نضمن لك جودة وأصالة كل منتج.'
      }
    ]
  },
  {
    title: 'الشحن والتوصيل',
    icon: <Truck size={22} />,
    items: [
      {
        question: 'كم تستغرق مدة التوصيل؟',
        answer: 'المدن الرئيسية (الرياض، جدة، الدمام): 2-4 أيام عمل. المدن الأخرى: 4-7 أيام عمل. المناطق النائية: 7-10 أيام عمل.'
      },
      {
        question: 'هل يوجد شحن مجاني؟',
        answer: 'نعم! الشحن مجاني لجميع الطلبات بقيمة 200 ريال وأكثر. للطلبات أقل من 200 ريال، رسوم الشحن 25 ريال فقط.'
      },
      {
        question: 'كيف أتتبع شحنتي؟',
        answer: 'بعد شحن طلبك، ستتلقى رقم تتبع عبر البريد الإلكتروني. يمكنك أيضاً متابعة حالة الطلب من حسابك على الموقع.'
      }
    ]
  },
  {
    title: 'الإرجاع والاستبدال',
    icon: <RotateCcw size={22} />,
    items: [
      {
        question: 'ما هي سياسة الإرجاع؟',
        answer: 'يمكنك إرجاع المنتج خلال 7 أيام من الاستلام بشرط أن يكون في حالته الأصلية مع التغليف وجميع الملحقات. للتفاصيل الكاملة، راجع سياسة الإرجاع.'
      },
      {
        question: 'كيف أطلب إرجاع منتج؟',
        answer: 'تواصل معنا عبر صفحة الاتصال مع ذكر رقم الطلب وسبب الإرجاع. سنراجع طلبك ونرد عليك خلال 24 ساعة بتعليمات الإرجاع.'
      },
      {
        question: 'متى أسترد المبلغ بعد الإرجاع؟',
        answer: 'بعد استلام المنتج وفحصه: التحويل البنكي 5-14 يوم عمل، بطاقة الائتمان 7-21 يوم عمل، رصيد المتجر خلال 24 ساعة.'
      }
    ]
  },
  {
    title: 'الدفع',
    icon: <CreditCard size={22} />,
    items: [
      {
        question: 'ما هي طرق الدفع المتاحة؟',
        answer: 'نقبل الدفع عبر: التحويل البنكي، بطاقات الائتمان (فيزا، ماستركارد)، مدى، والدفع عند الاستلام (في مدن محددة).'
      },
      {
        question: 'هل الدفع الإلكتروني آمن؟',
        answer: 'نعم، جميع عمليات الدفع مشفرة ومحمية ببروتوكول SSL. نحن لا نخزن بيانات بطاقتك على خوادمنا، بل تتم المعالجة عبر بوابات دفع معتمدة وآمنة.'
      }
    ]
  },
  {
    title: 'الضمان والصيانة',
    icon: <Shield size={22} />,
    items: [
      {
        question: 'هل المنتجات مشمولة بالضمان؟',
        answer: 'نعم، جميع المنتجات الإلكترونية تأتي بضمان المصنع. مدة الضمان مذكورة في صفحة كل منتج. يغطي الضمان عيوب التصنيع فقط.'
      },
      {
        question: 'ماذا لا يغطيه الضمان؟',
        answer: 'لا يغطي الضمان: الأضرار الناتجة عن سوء الاستخدام، أضرار الماء أو السقوط، التعديل أو الإصلاح من جهة غير معتمدة.'
      }
    ]
  }
];

const FAQ = () => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="legal-page">
      <div className="legal-hero">
        <h1>الأسئلة الشائعة</h1>
        <p>إجابات لأهم الأسئلة المتعلقة بالتسوق من جبوري للإلكترونيات</p>
      </div>

      <div className="legal-content">
        {faqData.map((category, catIdx) => (
          <div key={catIdx} className="legal-section">
            <h2>{category.icon} {category.title}</h2>
            <div className="faq-list">
              {category.items.map((item, itemIdx) => {
                const key = `${catIdx}-${itemIdx}`;
                const isOpen = openItems.has(key);
                return (
                  <div key={key} className="faq-item">
                    <button
                      className={`faq-question ${isOpen ? 'open' : ''}`}
                      onClick={() => toggleItem(key)}
                    >
                      <span>{item.question}</span>
                      <ChevronDown size={18} />
                    </button>
                    {isOpen && (
                      <div className="faq-answer">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="legal-section">
          <h2><Headphones size={22} /> لم تجد إجابة لسؤالك؟</h2>
          <p>
            إذا لم تجد إجابة لسؤالك في القائمة أعلاه، لا تتردد في التواصل معنا.
            فريق خدمة العملاء جاهز لمساعدتك.
          </p>
        </div>

        <div className="legal-contact-box">
          <h3>تحتاج مساعدة إضافية؟</h3>
          <p>فريقنا متواجد للإجابة على جميع استفساراتك</p>
          <Link to="/contact">تواصل معنا</Link>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
