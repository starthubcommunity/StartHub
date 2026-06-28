// layout.jsx — Navbar, Footer, Page wrappers
import React, { useState, useEffect, useRef } from 'react';
import { useLang } from './data';
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
    { key: 'home', label: t('nav.home') },
    { key: 'about', label: t('nav.about') },
    { key: 'labs', label: t('nav.labs') },
    { key: 'blog', label: t('nav.blog') },
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
  const { t } = useLang();

  const handleNav = (key) => {
    navigate(key);
    window.scrollTo({ top: 0 });
  };

  return (
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
          </div>

          <div>
            <h4 className="footer__col-title">{t('footer.connect')}</h4>
            <a className="footer__link" href="#" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="linkedin" size={14} /> LinkedIn
            </a>
            <a className="footer__link" href="#" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="github" size={14} /> GitHub
            </a>
            <a className="footer__link" href="#" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="mail" size={14} /> hello@starthub.co
            </a>
          </div>
        </div>

        <div className="footer__bottom">
          <span>{t('footer.rights')}</span>
          <div className="footer__socials">
            <a href="#"><Icon name="linkedin" size={18} /></a>
            <a href="#"><Icon name="github" size={18} /></a>
            <a href="#"><Icon name="mail" size={18} /></a>
          </div>
        </div>
      </div>
    </footer>
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
// CTA SECTION — kaldırıldı (kullanıcı isteği). Geriye dönük uyum için no-op.
// ============================================
function CTASection() { return null; }

export { Navbar, Footer, PageHeader, CTASection };
