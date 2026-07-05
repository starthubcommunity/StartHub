// layout.jsx — Navbar, Footer, Page wrappers
import React, { useState, useEffect } from 'react';
import { useLang, useSiteSettings } from './data';
import { Icon, Button } from './ui-components';

// ============================================
// NAVBAR
// ============================================
function Navbar({ currentPage, navigate }) {
  const { lang, t, setLang } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { key: 'home',  label: t('nav.home') },
    { key: 'labs',  label: t('nav.labs') },
    { key: 'blog',  label: t('nav.blog') },
    { key: 'about', label: t('nav.about') },
  ];

  const handleNav = (key) => {
    navigate(key);
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <React.Fragment>
      <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
        <div className="container nav__inner">
          <a className="nav__logo" onClick={() => handleNav('home')} style={{ cursor: 'pointer' }}>
            <img src="logo-full.png" alt="Start-Hub" className="nav__logo-img" />
          </a>

          <div className="nav__links">
            {navItems.map(item => (
              <a key={item.key}
                className={`nav__link ${currentPage === item.key ? 'nav__link--active' : ''}`}
                onClick={() => handleNav(item.key)}
                style={{ cursor: 'pointer' }}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="nav__actions">
            <button className="nav__lang" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}>
              {lang === 'tr' ? 'EN' : 'TR'}
            </button>
            <Button variant="primary" size="sm" onClick={() => handleNav('join')}>
              {t('nav.join')}
            </Button>
            <button className="nav__mobile-toggle" onClick={() => setMobileOpen(true)}>
              <Icon name="menu" size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileOpen ? 'mobile-menu--open' : ''}`}>
        <button className="mobile-menu__close" onClick={() => setMobileOpen(false)}>
          <Icon name="x" size={28} />
        </button>
        {navItems.map(item => (
          <a key={item.key} className="mobile-menu__link" onClick={() => handleNav(item.key)}
            style={{ cursor: 'pointer', color: currentPage === item.key ? 'var(--accent)' : undefined }}>
            {item.label}
          </a>
        ))}
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" size="lg" onClick={() => handleNav('join')}>
            {t('nav.join')}
          </Button>
        </div>
      </div>
    </React.Fragment>
  );
}

// ============================================
// FOOTER
// ============================================
function Footer({ navigate }) {
  const { t, lang } = useLang();
  const settings = useSiteSettings();
  const linkedinUrl = settings.company_linkedin || 'https://www.linkedin.com/company/111725833/';

  const [emailCopied, setEmailCopied] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen]     = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText('iletisim@starthub-community.com');
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      window.location.href = 'mailto:iletisim@starthub-community.com';
    }
  };

  const handleNav = (key) => {
    navigate(key);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <footer className="footer">
        <div className="container">
          <div className="footer__top">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <img src="logo-mark.png" alt="Start-Hub" style={{ height: 30 }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: 'white', letterSpacing: '-0.01em' }}>
                  Start<span style={{ color: 'var(--red)' }}>-Hub</span>
                </span>
              </div>
              <p className="footer__brand-desc">{t('footer.desc')}</p>
            </div>

            <div>
              <h4 className="footer__col-title">{t('footer.platform')}</h4>
              <a className="footer__link" onClick={() => handleNav('labs')} style={{ cursor: 'pointer' }}>{t('nav.labs')}</a>
              <a className="footer__link" onClick={() => handleNav('blog')} style={{ cursor: 'pointer' }}>{t('nav.blog')}</a>
              <a className="footer__link" onClick={() => handleNav('join')} style={{ cursor: 'pointer' }}>{t('nav.join')}</a>
            </div>

            <div>
              <h4 className="footer__col-title">{t('footer.company')}</h4>
              <a className="footer__link" onClick={() => handleNav('about')} style={{ cursor: 'pointer' }}>{t('nav.about')}</a>
              <a className="footer__link" onClick={() => handleNav('home')} style={{ cursor: 'pointer' }}>{t('nav.home')}</a>
              <button className="footer__link" onClick={() => setPrivacyOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                {lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}
              </button>
              <button className="footer__link" onClick={() => setTermsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                {lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Use'}
              </button>
            </div>

            <div>
              <h4 className="footer__col-title">{t('footer.connect')}</h4>
              <a className="footer__link" href={linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="linkedin" size={14} /> LinkedIn
              </a>
              <button className="footer__link" onClick={copyEmail}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', color: emailCopied ? 'var(--green)' : undefined }}>
                <Icon name="mail" size={14} />
                {emailCopied
                  ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!')
                  : 'iletisim@starthub-community.com'}
              </button>
            </div>
          </div>

          <div className="footer__bottom">
            <span>{t('footer.rights')}</span>
            <div className="footer__socials">
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"><Icon name="linkedin" size={18} /></a>
              <button onClick={copyEmail} title={emailCopied ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : 'iletisim@starthub-community.com'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: emailCopied ? 'var(--green)' : 'inherit', display: 'flex', alignItems: 'center', padding: 0 }}>
                <Icon name="mail" size={18} />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy Modal */}
      {privacyOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPrivacyOpen(false)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 32, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20 }}>{lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</h2>
              <button onClick={() => setPrivacyOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Icon name="x" size={20} /></button>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {lang === 'tr'
                ? 'Start-Hub olarak kullanıcı gizliliğine saygı duyuyoruz. Topladığımız veriler yalnızca topluluğumuzu geliştirmek ve üyelerimizle iletişim kurmak amacıyla kullanılır. Kişisel verileriniz üçüncü taraflarla paylaşılmaz. Başvuru formlarında sağladığınız bilgiler yalnızca değerlendirme sürecinde kullanılır. Verilerinizin silinmesini talep etmek için iletisim@starthub-community.com adresine e-posta gönderebilirsiniz.'
                : 'At Start-Hub, we respect user privacy. Data we collect is used solely to improve our community and communicate with our members. Personal data is not shared with third parties. Information provided in application forms is used only during the evaluation process. To request deletion of your data, email iletisim@starthub-community.com.'}
            </p>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {termsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setTermsOpen(false)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, padding: 32, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20 }}>{lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Use'}</h2>
              <button onClick={() => setTermsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><Icon name="x" size={20} /></button>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {lang === 'tr'
                ? 'Start-Hub platformunu kullanarak aşağıdaki koşulları kabul etmiş olursunuz: (1) Platforma yalnızca yasal amaçlarla erişebilirsiniz. (2) Topluluk standartlarına uygun davranmayı kabul edersiniz. (3) Paylaştığınız içeriklerden siz sorumlusunuzdur. (4) Start-Hub, önceden haber vermeksizin içerikleri kaldırma hakkını saklı tutar. (5) Hizmetler "olduğu gibi" sunulmaktadır; kesintisiz erişim garanti edilmez.'
                : 'By using the Start-Hub platform, you agree to the following terms: (1) You may access the platform only for lawful purposes. (2) You agree to behave in accordance with community standards. (3) You are responsible for the content you share. (4) Start-Hub reserves the right to remove content without prior notice. (5) Services are provided "as-is"; uninterrupted access is not guaranteed.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// PAGE HEADER (inner pages)
// ============================================
function PageHeader({ label, title, desc }) {
  return (
    <div className="page-header">
      <div className="container">
        {label && <div className="page-header__label">{label}</div>}
        <h1 className="page-header__title text-h1">{title}</h1>
        {desc && <p className="page-header__desc text-pretty">{desc}</p>}
      </div>
    </div>
  );
}

// ============================================
// CTA SECTION — kaldırıldı. Geriye dönük uyum için no-op.
// ============================================
function CTASection() { return null; }

export { Navbar, Footer, PageHeader, CTASection };
