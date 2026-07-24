import { useEffect } from "react";

/**
 * مراقب عام للظهور التدريجي عند التمرير.
 * أي عنصر يحمل [data-reveal] أو [data-reveal-stagger] يظهر تلقائياً
 * عند دخوله الشاشة — بلا حاجة لربط يدوي في كل صفحة.
 *
 * يعيد المسح عند تغيّر المسار لالتقاط عناصر الصفحات المحمّلة كسولاً.
 */
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const selector = "[data-reveal], [data-reveal-stagger]";

    // احترام تفضيل تقليل الحركة: أظهر كل شيء فوراً
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      document
        .querySelectorAll(selector)
        .forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            // مرة واحدة فقط — لا نخفيه عند الخروج
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    const observeAll = () => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el.classList.contains("is-revealed")) observer.observe(el);
      });
    };

    observeAll();

    // التقاط العناصر التي تُضاف لاحقاً (تحميل كسول / بيانات غير متزامنة).
    // نجمع التغييرات في إطار واحد حتى لا نمسح DOM مع كل تعديل صغير.
    let scheduled = 0;
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        observeAll();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
      if (scheduled) cancelAnimationFrame(scheduled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useScrollReveal;
