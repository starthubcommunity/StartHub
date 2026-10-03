// Google Analytics 4 (gtag.js). Ölçüm kimliği koda gömülmez — VITE_GA_MEASUREMENT_ID
// env değişkeninden okunur. Tanımlı değilse veya production dışındaysa hiçbir şey
// yüklenmez (geliştirme ortamı ölçüme karışmasın).
//
// send_page_view: false — gtag'in kendi ilk page_view'ı kapatılır; sayfa geçişleri
// trackPageView ile TEK kez gönderilir (ilk yükleme dahil). Böylece çift sayım olmaz.

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const ENABLED = import.meta.env.PROD && Boolean(GA_ID);

let initialized = false;

export function initGA() {
  if (!ENABLED || initialized) return;
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
}

export function trackPageView(pagePath) {
  if (!ENABLED || !initialized) return;
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_location: window.location.href,
  });
}
