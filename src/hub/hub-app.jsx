// hub-app.jsx — Kurucu Hattı: kabuk + auth kapısı + rol kapısı
// HUB_SPEC §5.1 (aynı Supabase istemcisi, aynı oturum) + §5.2 (açılış akışı).
// Router yok; sayfa geçişi sonraki adımlarda useState + sessionStorage ile.
import React from 'react';
import { useState, useEffect } from 'react';
import { supabase, setRememberMe } from '../lib/supabase';
import { AIcon } from '../admin/admin-ui';
import { HubStoreProvider } from './hub-store';
import { HubMemberContext, useHubMember } from './hub-member';
import { PermsProvider, usePerms } from '../lib/use-perms';
import PermissionsScreen from '../admin/permissions-screen';
import { EMPTY_FILTERS } from './components/filter-bar';
import TodayPage from './pages/today';
import CandidatesListPage from './pages/candidates-list';
import ArchivePage from './pages/archive';
import TemplatesPage from './pages/templates';
import MetricsPage from './pages/metrics';
import SourcesPage from './pages/sources';
import SettingsPage from './pages/settings';
import RolesPage from './pages/roles';
import OverviewPage from './pages/overview';
import InboundOverviewPage from './pages/inbound-overview';
import InboundBoardPage from './pages/inbound-board';
import { INBOUND_CHANGED } from './use-inbound';
import '../styles/inbound.css';
import SponsorsPage from './pages/sponsors';

// useHubMember() geriye dönük uyumluluk için buradan da dışa aktarılır
// (Adım 3 kabul kriteri bu isme atıf yapıyor).
export { useHubMember };

// ─── Paylaşılan stiller (admin AuthShell deseni, --adm-* token'ları) ──────
const inputStyle = { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg)', fontSize: 14, color: 'var(--adm-text)', boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--font-body)' };
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--adm-text-dim)', display: 'block', marginBottom: 6 };
const btnPrimary = { marginTop: 4, padding: '11px', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', cursor: 'pointer' };
const btnGhost = { width: '100%', padding: '11px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'none', color: 'var(--adm-text)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const errorBox = { fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px' };

// ─── Ortak kart kabuğu ──────────────────────────────────────────────────
function AuthShell({ title, desc, children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)', padding: 20, boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: 'var(--adm-text)', letterSpacing: '-0.02em' }}>Start-Hub</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Kurucu Hattı</div>
        </div>
        <div style={{ background: 'var(--adm-bg-card)', border: '1px solid var(--adm-border-light)', borderRadius: 16, padding: 28 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 4, color: 'var(--adm-text)', letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 22 }}>{desc}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Şifre alanı (göster/gizle) ─────────────────────────────────────────
function EyeIcon({ off }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={onChange} type={show ? 'text' : 'password'} required placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 42 }} />
      <button type="button" onClick={() => setShow(s => !s)} title={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: 'var(--adm-text-dim)', display: 'flex', alignItems: 'center' }}>
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

// ─── Hesap oluştur ─────────────────────────────────────────────────────
// Yalnızca e-posta. invite-member yetkiyi kontrol eder; ekran her durumda
// aynı mesajı verir (yetkili/yetkisiz ayırt edilemesin).
function CreateAccountPage({ onBack }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await supabase.functions.invoke('invite-member', { body: { email: email.trim(), area: 'hub' } }); }
    catch (_) { /* yanıt her durumda aynı */ }
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="İşlem alındı" desc="">
        <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
          Eğer bu e-posta yetkiliyse, şifre belirleme bağlantısı gönderildi. Gelen kutunu kontrol et.
        </p>
        <button onClick={onBack} style={btnGhost}>Girişe dön</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Hesap oluştur" desc="Yetkili e-postanı gir; şifreni sen belirleyeceksin.">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={inputStyle} />
        </div>
        <button type="submit" disabled={loading} style={{ ...btnPrimary, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Gönderiliyor…' : 'Bağlantı gönder'}
        </button>
        <button type="button" onClick={onBack}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--adm-text-dim)', cursor: 'pointer', textAlign: 'center' }}>
          ← Girişe dön
        </button>
      </form>
    </AuthShell>
  );
}

// ─── Şifremi unuttum ────────────────────────────────────────────────────
function ForgotPasswordPage({ onBack }) {
  const [email, setEmail]     = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    // Markalı StartHub maili — invite-member 'recovery' linkini üretip
    // send-mail ile gönderir. Yanıt her durumda aynı.
    try { await supabase.functions.invoke('invite-member', { body: { email: email.trim(), area: 'hub', mode: 'recovery' } }); }
    catch (_) { /* yanıt her durumda aynı */ }
    setLoading(false);
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="İşlem alındı" desc="">
        <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
          Eğer bu e-posta yetkiliyse, şifre belirleme bağlantısı gönderildi. Gelen kutunuzu kontrol edin.
        </p>
        <button onClick={onBack} style={btnGhost}>Girişe dön</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Şifremi unuttum" desc="E-posta adresinize bir sıfırlama bağlantısı gönderelim.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={inputStyle} />
        </div>
        {error && <div style={errorBox}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...btnPrimary, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
        </button>
        <button type="button" onClick={onBack}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--adm-text-dim)', cursor: 'pointer', textAlign: 'center' }}>
          ← Girişe dön
        </button>
      </form>
    </AuthShell>
  );
}

// ─── Yeni şifre belirle (sıfırlama linkinden dönünce) ───────────────────
function SetNewPasswordPage({ onDone }) {
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
    if (password !== password2) { setError('Şifreler birbiriyle eşleşmiyor.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError('Şifre güncellenemedi: ' + err.message); return; }
    onDone();
  };

  return (
    <AuthShell title="Yeni şifre belirle" desc="Hesabınız için yeni bir şifre girin.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>YENİ ŞİFRE</label>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <label style={labelStyle}>YENİ ŞİFRE (TEKRAR)</label>
          <PasswordInput value={password2} onChange={e => setPassword2(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <div style={errorBox}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...btnPrimary, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Kaydediliyor…' : 'Şifreyi Kaydet'}
        </button>
      </form>
    </AuthShell>
  );
}

// ─── Giriş ──────────────────────────────────────────────────────────────
// Hub'da "Kayıt ol" bağlantısı YOKTUR (HUB_SPEC §5.1): yeni kullanıcı
// cofounder tarafından hub_members'a eklenir.
function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgot, setForgot]     = useState(false);
  const [signup, setSignup]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    // Oturumun nerede saklanacağını (localStorage/sessionStorage) girişten
    // ÖNCE ayarlıyoruz — /admin/ ile aynı "Beni hatırla" davranışı.
    setRememberMe(remember);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError('E-posta veya şifre hatalı.');
      setLoading(false);
    }
    // Başarılıysa onAuthStateChange oturumu HubRoot'ta günceller.
  };

  if (forgot) return <ForgotPasswordPage onBack={() => setForgot(false)} />;
  if (signup) return <CreateAccountPage onBack={() => setSignup(false)} />;

  return (
    <AuthShell title="Giriş Yap" desc="Yetkili hesabınızla devam edin.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>E-POSTA</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="ornek@starthub.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>ŞİFRE</label>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--adm-text-dim)', userSelect: 'none' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#DC2626', cursor: 'pointer' }} />
            Beni hatırla
          </label>
          <button type="button" onClick={() => setForgot(true)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: '#DC2626', fontWeight: 600, cursor: 'pointer' }}>
            Şifremi unuttum
          </button>
        </div>
        {error && <div style={errorBox}>{error}</div>}
        <button type="submit" disabled={loading} style={{ ...btnPrimary, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap →'}
        </button>
        <button type="button" onClick={() => setSignup(true)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--adm-text-dim)', cursor: 'pointer', textAlign: 'center' }}>
          Hesap oluştur
        </button>
      </form>
    </AuthShell>
  );
}

// ─── Yükleniyor ─────────────────────────────────────────────────────────
function AuthLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
    </div>
  );
}

// ─── Erişim yok (oturum var, rol yok) ──────────────────────────────────
function NoAccessPage({ email, onLogout }) {
  return (
    <AuthShell title="Bu alana erişiminiz yok" desc="Hesabınız Kurucu Hattı'na tanımlı değil.">
      <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
        <strong style={{ color: 'var(--adm-text)' }}>{email}</strong> ile giriş yaptınız, ancak bu
        alana erişim yetkiniz bulunmuyor. Yetkilendirme için bir kurucuyla iletişime geçin.
      </p>
      <button onClick={onLogout} style={btnGhost}>Çıkış</button>
    </AuthShell>
  );
}

// ─── Yetkiler yüklenirken (uygulama kabuğu içindeyken) ─────────────────
function HubLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>SH</div>
      <div style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Yükleniyor…</div>
    </div>
  );
}

// ─── Hiçbir bölüme yetki yok (oturum + rol var, izin listesi boş) ──────
function HubNoAccess({ email, onLogout }) {
  return (
    <AuthShell title="Bu alana erişim yetkiniz yok" desc="Kurucu Hattı'nda görebileceğiniz bir bölüm tanımlı değil.">
      <p style={{ fontSize: 14, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
        <strong style={{ color: 'var(--adm-text)' }}>{email}</strong> hesabınıza henüz yetki
        atanmamış. Bir kurucudan yetkilerinizi tanımlamasını isteyin.
      </p>
      <button onClick={onLogout} style={btnGhost}>Çıkış</button>
    </AuthShell>
  );
}

// ─── Uygulama kabuğu ─────────────────────────────────────────────────
// Sol menüde İKİ hat (2026-09-21): **Inbound** (web formundan gelen başvurular —
// applications tablosu, kendi aşamaları/notları) ve **Outbound** (bizim aradığımız
// adaylar — hub_candidates, 5 aşamalı hat). Ortak havuz YOK: site başvuruları
// artık hub_candidates'a düşmez (0036). Yönetim (şablon, metrik, yetki…) iki hat
// için ortak. Her öğe bir has_perm anahtarına bağlı; yetkisi olmayan öğe menüde
// HİÇ görünmez.
const OUTBOUND_NAV = [
  { id: 'today',        label: 'Bugün',            icon: 'dashboard', perm: null },
  { id: 'candidates',   label: 'Adaylar',          icon: 'layers',    perm: 'candidates.read' },
  { id: 'roles',        label: 'Açık Pozisyonlar', icon: 'rocket',    perm: 'roles.read' },
  { id: 'archive',      label: 'Arşiv',            icon: 'trash',     perm: 'candidates.read' },
];
const INBOUND_NAV = [
  { id: 'inbound-overview', label: 'Genel Bakış', icon: 'dashboard', perm: 'applications.read' },
  { id: 'inbound',          label: 'Başvurular',  icon: 'layers',    perm: 'applications.read' },
];
// İki hattı birlikte gösteren üst düzey özet (sol menüde ayrı düğme).
const OVERVIEW_ITEM = { id: 'overview', label: 'Genel Bakış', icon: 'dashboard', perm: null };
const GEAR_NAV = [
  { id: 'templates',    label: 'Şablonlar',       icon: 'penEdit',    perm: 'templates.read' },
  { id: 'metrics',      label: 'Metrikler',       icon: 'trendingUp', perm: 'metrics.read' },
  { id: 'sources',      label: 'Kaynaklar',       icon: 'layers',     perm: 'sources.read' },
  { id: 'sponsors',     label: 'Destekçiler',     icon: 'handshake',  perm: 'sponsors.read' },
  { id: 'members',      label: 'Yetkiler',        icon: 'users',      perm: 'members.manage' },
  { id: 'settings',     label: 'Ayarlar',         icon: 'settings',   perm: 'settings.write' },
];
const MODES = {
  inbound:  { label: 'Inbound',  sub: 'Form başvuruları' },
  outbound: { label: 'Outbound', sub: 'Aday avı' },
};
const modeOfPage = (id) => (INBOUND_NAV.some((n) => n.id === id) ? 'inbound' : OUTBOUND_NAV.some((n) => n.id === id) ? 'outbound' : null);
const ALL_NAV = [OVERVIEW_ITEM, ...OUTBOUND_NAV, ...INBOUND_NAV, ...GEAR_NAV];

// Sol menü rozeti: yanıt bekleyen (aşaması 'new') başvuru sayısı.
function useInboundNewCount(enabled) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = () => supabase.from('applications').select('id', { count: 'exact', head: true })
      .or('status.is.null,status.eq.new')
      .then(({ count }) => { if (active) setN(count || 0); });
    load();
    const t = setInterval(load, 60000);
    window.addEventListener(INBOUND_CHANGED, load);
    return () => { active = false; clearInterval(t); window.removeEventListener(INBOUND_CHANGED, load); };
  }, [enabled]);
  return n;
}

function HubApp({ email, onLogout }) {
  // Rules of Hooks: TÜM hook'lar koşulsuz ve her erken return'den ÖNCE.
  const role = useHubMember();
  const { can, loading: permsLoading } = usePerms();
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('sh_hub_page') || 'overview';
    return saved === 'applications' ? 'inbound' : saved; // eski "Diğer Başvurular" → Inbound
  });
  // B2 — çip/filtre seçimi sayfa yenilenince korunur.
  const [filters, setFilters] = useState(() => {
    try { return { ...EMPTY_FILTERS, ...JSON.parse(sessionStorage.getItem('sh_hub_filters') || '{}') }; }
    catch { return { ...EMPTY_FILTERS }; }
  });
  const [gearOpen, setGearOpen] = useState(false);
  useEffect(() => { sessionStorage.setItem('sh_hub_page', page); }, [page]);
  useEffect(() => {
    try { sessionStorage.setItem('sh_hub_filters', JSON.stringify(filters)); } catch { /* yoksay */ }
  }, [filters]);

  const allowed = (n) => !n.perm || can(n.perm);
  const outboundNav = OUTBOUND_NAV.filter(allowed);
  const inboundNav = INBOUND_NAV.filter(allowed);
  const gearNav = GEAR_NAV.filter(allowed);
  const hasOverview = outboundNav.length > 0 || inboundNav.length > 0; // en az bir hattı görebilen özet görür
  const nav = [...(hasOverview ? [OVERVIEW_ITEM] : []), ...outboundNav, ...inboundNav, ...gearNav];
  const activePage = nav.some((n) => n.id === page) ? page : (nav[0]?.id || 'today');
  // Hat (mod): sayfa bir hatta aitse o hat; ortak (Yönetim) sayfalarında son hat korunur.
  const [lastMode, setLastMode] = useState(() => sessionStorage.getItem('sh_hub_mode') || 'outbound');
  const pageMode = modeOfPage(activePage);
  const mode = pageMode || (lastMode === 'inbound' && inboundNav.length ? 'inbound' : outboundNav.length ? 'outbound' : 'inbound');
  useEffect(() => {
    if (!pageMode) return;
    setLastMode(pageMode);
    sessionStorage.setItem('sh_hub_mode', pageMode);
    sessionStorage.setItem('sh_hub_page_' + pageMode, activePage);
  }, [pageMode, activePage]);
  const newCount = useInboundNewCount(inboundNav.length > 0);
  const modeNav = mode === 'inbound' ? inboundNav : outboundNav;
  const switchMode = (m) => {
    if (m === mode && pageMode) return;
    const list = m === 'inbound' ? inboundNav : outboundNav;
    const remembered = sessionStorage.getItem('sh_hub_page_' + m);
    setPage(list.some((n) => n.id === remembered) ? remembered : (list[0]?.id || page));
  };

  // Hook'ların HEPSİNDEN sonra: yükleniyor / erişim yok dalları.
  if (permsLoading) return <HubLoading />;
  if (nav.length === 0) return <HubNoAccess email={email} onLogout={onLogout} />;

  const NavLink = (n) => (
    <button key={n.id}
      className={`hub-sidebar__link ${activePage === n.id ? 'hub-sidebar__link--active' : ''}`}
      onClick={() => setPage(n.id)}>
      <AIcon name={n.icon} size={17} />
      <span>{n.label}</span>
      {n.id === 'inbound' && newCount > 0 && (
        <span className="hub-mode__badge" style={{ position: 'static', marginLeft: 'auto' }}>{newCount > 99 ? '99+' : newCount}</span>
      )}
    </button>
  );
  const gearActive = gearNav.some((n) => n.id === activePage);

  return (
    <div className="hub-layout">
      <aside className="hub-sidebar">
        <div className="hub-sidebar__brand">
          <div className="hub-sidebar__logo">SH</div>
          <div>
            <div className="hub-sidebar__title">Kurucu Hattı</div>
            <div className="hub-sidebar__sub">{role}</div>
          </div>
        </div>
        {hasOverview && (
          <button className={`hub-overview-btn${activePage === 'overview' ? ' hub-overview-btn--on' : ''}`} onClick={() => setPage('overview')}>
            <AIcon name="dashboard" size={17} /> Genel Bakış
          </button>
        )}
        {inboundNav.length > 0 && outboundNav.length > 0 && (
          <div className="hub-mode" role="tablist" aria-label="Hat seçimi">
            {['inbound', 'outbound'].map((m) => (
              <button key={m} role="tab" aria-selected={mode === m}
                className={`hub-mode__btn${mode === m && pageMode ? ' hub-mode__btn--on' : ''}`} onClick={() => switchMode(m)}>
                {MODES[m].label}<small>{MODES[m].sub}</small>
                {m === 'inbound' && newCount > 0 && <span className="hub-mode__badge">{newCount > 99 ? '99+' : newCount}</span>}
              </button>
            ))}
          </div>
        )}
        <nav className="hub-sidebar__nav">
          <div className="hub-navlabel">{MODES[mode].label}</div>
          {modeNav.map(NavLink)}
          {gearNav.length > 0 && (
            <>
              <button className="hub-sidebar__link" onClick={() => setGearOpen((v) => !v)} style={{ marginTop: 8, opacity: 0.85 }}>
                <AIcon name="settings" size={17} />
                <span>Yönetim</span>
                <AIcon name={(gearOpen || gearActive) ? 'chevronDown' : 'chevronRight'} size={14} style={{ marginLeft: 'auto' }} />
              </button>
              {(gearOpen || gearActive) && <div style={{ paddingLeft: 12 }}>{gearNav.map(NavLink)}</div>}
            </>
          )}
        </nav>
        <div className="hub-sidebar__foot">
          <button className="hub-sidebar__link" onClick={onLogout}>
            <AIcon name="logout" size={17} /><span>Çıkış</span>
          </button>
        </div>
      </aside>

      <div className="hub-main">
        <div className="hub-topbar">
          <span style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>
            {pageMode ? `${MODES[pageMode].label} › ` : ''}{ALL_NAV.find((n) => n.id === activePage)?.label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>{email}</span>
        </div>
        <div className="hub-content">
          {activePage === 'overview' ? <OverviewPage onGoto={setPage} />
            : activePage === 'today' ? <TodayPage onGoto={setPage} />
            : activePage === 'candidates' ? <CandidatesListPage filters={filters} setFilters={setFilters} />
            : activePage === 'archive' ? <ArchivePage />
            : activePage === 'roles' ? <RolesPage onGoto={setPage} setFilters={setFilters} />
            : activePage === 'inbound-overview' ? <InboundOverviewPage onGoto={setPage} />
            : activePage === 'inbound' ? <InboundBoardPage />
            : activePage === 'templates' ? <TemplatesPage />
            : activePage === 'metrics' ? <MetricsPage />
            : activePage === 'sources' ? <SourcesPage />
            : activePage === 'sponsors' ? <SponsorsPage />
            : activePage === 'members' ? <PermissionsScreen area="hub" />
            : activePage === 'settings' ? <SettingsPage />
            : <div className="adm-empty">Bu ekran yok.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Hata sınırı ──────────────────────────────────────────────────────
// Render sırasında bir istisna olursa beyaz ekran yerine hatayı gösteren
// bir kutu üretir (Rules of Hooks ihlali gibi durumlar dahil).
class HubErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('HubErrorBoundary:', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--adm-bg)', fontFamily: 'var(--font-body)', padding: 20, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 520, width: '100%', background: 'var(--adm-bg-card)', border: '1px solid #FECACA', borderRadius: 16, padding: 28 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: '#DC2626', marginBottom: 8 }}>Bir şeyler ters gitti</div>
          <p style={{ fontSize: 13.5, color: 'var(--adm-text-dim)', lineHeight: 1.6, marginBottom: 14 }}>
            Kurucu Hattı yüklenirken bir hata oluştu. Sayfayı yenilemek çoğu zaman yeterli olur;
            sürerse bir kurucuya aşağıdaki mesajı iletin.
          </p>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--adm-bg)', border: '1px solid var(--adm-border-light)', borderRadius: 8, padding: '10px 12px', color: 'var(--adm-text)', marginBottom: 16 }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()} style={btnPrimary}>Sayfayı yenile</button>
        </div>
      </div>
    );
  }
}

// ─── Kök: açılış akışı (HUB_SPEC §5.2) ─────────────────────────────────
// 1) getSession → authLoading
// 2) oturum yok → LoginPage
// 3) oturum var → hub_role() RPC → roleLoading
// 4) rol null → NoAccessPage
// 5) rol var → HubApp
export default function HubRoot() {
  return (
    <HubErrorBoundary>
      <HubRootFlow />
    </HubErrorBoundary>
  );
}

function HubRootFlow() {
  const [session, setSession]         = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recovery, setRecovery]       = useState(false);
  const [role, setRole]               = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!active) return;
      setSession(s);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setSession(s); return; }
      if (event === 'SIGNED_OUT') { setSession(null); setRole(null); setRecovery(false); return; }
      setSession(s);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Oturum değişince rolü BİR KEZ çek. localStorage'a yazılmaz — yetki
  // değişirse bir sonraki açılışta güncellenir.
  useEffect(() => {
    if (!session) { setRole(null); return; }
    let active = true;
    setRoleLoading(true);
    supabase.rpc('hub_role').then(({ data, error }) => {
      if (!active) return;
      setRole(error ? null : (data ?? null));
      setRoleLoading(false);
    });
    return () => { active = false; };
  }, [session?.user?.id]);

  const handleLogout = () => supabase.auth.signOut();

  if (authLoading) return <AuthLoading />;
  if (recovery)    return <SetNewPasswordPage onDone={() => setRecovery(false)} />;
  if (!session)    return <LoginPage />;
  if (roleLoading) return <AuthLoading />;
  if (!role)       return <NoAccessPage email={session.user.email || ''} onLogout={handleLogout} />;

  return (
    <PermsProvider area="hub">
      <HubMemberContext.Provider value={role}>
        <HubStoreProvider>
          <HubApp email={session.user.email || ''} onLogout={handleLogout} />
        </HubStoreProvider>
      </HubMemberContext.Provider>
    </PermsProvider>
  );
}
