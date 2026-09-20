// join-flow.jsx — Katıl sayfası: HUB (topluluk & kulüp) / LAB (girişim) akışı.
//
//   1. Seçim   → HUB mı LAB mı (altta: mentör / destekçi kısa yolları)
//   2. Yol     → HUB: Topluluğa katıl | Ekip üyesi (sosyal medya, tasarım, …)
//                LAB: Kurucu (fikre liderlik | yeni fikir) | Proje üyesi (projeye katıl | eşleşme havuzu)
//   3. Bilgiler→ seçilen yola göre form → `applications` tablosuna insert
//   4. Tamam   → tarafa göre WhatsApp / Instagram / LinkedIn bağlantıları
//
// Veri modeli: applications tablosuna YENİ KOLON YOK — taraf `intent`'ten çıkar
// (community/club_team = Hub; founder_lead/idea_application/project/pool_match = Lab).
// Kulüp ekip alanı `role`'a serbest metin olarak yazılır. Metinler, ekip alanları
// ve bağlantılar `join_form_settings`'ten gelir (admin panel → Site Ayarları →
// Katılım Formu); ayar yoksa sabit varsayılanlar kullanılır — sayfa asla boş kalmaz.
// Router yok: adım durumu useState + sessionStorage (proje kuralı).
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLang, useStartups } from './data';
import { supabase } from './lib/supabase';
import { Icon, externalUrl } from './ui-components';
import { PageHeader } from './layout';
import { getRoleDescription } from './detail-pages';
import { DEFAULT_TEAM_AREAS } from './join-defaults';
import './styles/join.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATH_KEY = 'sh_join_path';

// intent → taraf + ikon
const PATHS = {
  community:           { side: 'hub',   icon: 'users' },
  club_team:           { side: 'hub',   icon: 'megaphone' },
  founder_lead:        { side: 'lab',   icon: 'rocket' },
  idea_application:    { side: 'lab',   icon: 'lightbulb' },
  project:             { side: 'lab',   icon: 'briefcase' },
  pool_match:          { side: 'lab',   icon: 'target' },
  mentor_application:  { side: 'other', icon: 'graduationCap' },
  sponsor_application: { side: 'other', icon: 'handshake' },
};


function readSavedPath() {
  try {
    const s = JSON.parse(sessionStorage.getItem(PATH_KEY) || 'null');
    if (s && (!s.intent || PATHS[s.intent])) return { side: s.side || null, intent: s.intent || null, area: s.area || '' };
  } catch { /* sessionStorage yok / bozuk */ }
  return { side: null, intent: null, area: '' };
}

// ── küçük form bileşenleri (modül seviyesinde: yeniden mount olup odağı kaybettirmesin) ──
const Req = () => <span className="jn-req">*</span>;

function TextInput({ label, required, invalid, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <> <Req /></>}</label>
      <input type={type} className={`form-input${invalid ? ' form-input--invalid' : ''}`}
        value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function TextBox({ label, required, invalid, value, onChange, placeholder, maxLength, minHeight }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <> <Req /></>}</label>
      <textarea className={`form-input${invalid ? ' form-input--invalid' : ''}`} maxLength={maxLength}
        placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        style={minHeight ? { minHeight } : undefined} />
      {maxLength && <div className="jn-count">{value.length}/{maxLength}</div>}
    </div>
  );
}

function SelectBox({ label, required, invalid, value, onChange, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <> <Req /></>}</label>
      <select className={`form-input form-select${invalid ? ' form-input--invalid' : ''}`}
        value={value} onChange={e => onChange(e.target.value)}>{children}</select>
    </div>
  );
}

function OptionCard({ icon, title, desc, onClick, big }) {
  return (
    <button type="button" className={`jn-opt${big ? ' jn-opt--big' : ''}`} onClick={onClick}>
      <span className="jn-opt__icon"><Icon name={icon} size={big ? 26 : 22} /></span>
      <span className="jn-opt__body">
        <span className="jn-opt__title" style={{ display: 'block' }}>{title}</span>
        <span className="jn-opt__desc" style={{ display: 'block' }}>{desc}</span>
      </span>
      <Icon name="arrowRight" size={18} className="jn-opt__go" />
    </button>
  );
}

function LinkCard({ kind, icon, title, desc, href }) {
  return (
    <a className={`jn-link jn-link--${kind}`} href={href} target="_blank" rel="noreferrer">
      <span className="jn-link__icon"><Icon name={icon} size={24} /></span>
      <span className="jn-link__body">
        <span className="jn-link__title" style={{ display: 'block' }}>{title}</span>
        <span className="jn-link__desc" style={{ display: 'block' }}>{desc}</span>
      </span>
      <Icon name="arrowUpRight" size={18} className="jn-link__go" />
    </a>
  );
}

function JoinPage({ navigate, projectId }) {
  const { lang, t } = useLang();
  const L = (tr, en) => (lang === 'tr' ? tr : en);
  const { startups } = useStartups();

  // ── ayarlar (admin panelden) ──
  const [fsRow, setFsRow] = useState(null);
  const [site, setSite] = useState({});
  useEffect(() => {
    supabase.from('join_form_settings').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setFsRow(data); }).catch(() => {});
    supabase.from('site_settings').select('instagram_url, company_linkedin').eq('id', 1).single()
      .then(({ data }) => { if (data) setSite(data); }).catch(() => {});
  }, []);
  const fs = (key, fallback) => (fsRow && fsRow[key]) || fallback;
  const fl = (key, fallback) => (fsRow?.field_labels && fsRow.field_labels[key]) || fallback;
  // Metin ayarları TR yazılıyor; EN'de sabit İngilizce varsayılan kullanılır.
  const fsTr = (key, trDefault, enDefault) => (lang === 'tr' ? fs(key, trDefault) : enDefault);

  const areas = useMemo(() => {
    const raw = Array.isArray(fsRow?.team_areas) && fsRow.team_areas.length ? fsRow.team_areas : DEFAULT_TEAM_AREAS;
    return raw.filter(a => a && a.label && a.active !== false);
  }, [fsRow]);
  const areaLabel = (a) => (lang === 'en' && a.label_en) ? a.label_en : a.label;

  // ── proje deep-link ──
  const project = projectId ? startups.find(s => s.id === projectId || s.slug === projectId) : null;
  const savedRole = project && typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sh_join_role') : null;

  // ── akış durumu ──
  const [sel, setSel] = useState(readSavedPath);           // { side, intent, area }
  const [submitted, setSubmitted] = useState(null);         // gönderilen { side, intent }
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [invalid, setInvalid] = useState(new Set());

  const eff = project ? { side: 'lab', intent: 'project', area: '' } : sel;
  const step = submitted ? 'done' : !eff.side ? 'choose' : !eff.intent ? 'path' : 'form';
  const side = eff.side;

  const go = (next) => {
    setSel(next);
    setSubmitError(''); setInvalid(new Set());
    try { sessionStorage.setItem(PATH_KEY, JSON.stringify(next)); } catch { /* yok say */ }
  };
  const pick = (intent, area = '') => go({ side: PATHS[intent].side, intent, area });

  // adım değişince sayfanın başına
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, eff.intent, eff.side]);

  const clearProject = () => {
    try { sessionStorage.removeItem('sh_join_role'); sessionStorage.removeItem(PATH_KEY); } catch { /* yok say */ }
    setSel({ side: null, intent: null, area: '' });
    navigate('join');
  };

  // ── form durumları ──
  const [form, setForm] = useState({
    name: '', email: '', university: '', department: '', role: '',
    bio: '', linkedin: '', portfolio: '', skills: '',
    projectId: '', ideaProjectId: '', pitch: '', problem: '', progress: '',
  });
  const [mentorForm, setMentorForm] = useState({
    name: '', email: '', expertise: '', experience_years: '',
    current_company: '', hours_per_week: '', linkedin: '', mentor_note: '',
  });
  const [sponsorForm, setSponsorForm] = useState({
    contact_name: '', email: '', company: '', website: '', collab_types: [], sponsor_message: '',
  });
  const clearInvalid = (f) => setInvalid(prev => { if (!prev.has(f)) return prev; const n = new Set(prev); n.delete(f); return n; });
  const setF = (f) => (v) => { setForm(p => ({ ...p, [f]: v })); clearInvalid(f); };
  const setM = (f) => (v) => { setMentorForm(p => ({ ...p, [f]: v })); clearInvalid(f); };
  const setS = (f) => (v) => { setSponsorForm(p => ({ ...p, [f]: v })); clearInvalid(f); };
  const toggleCollab = (opt) => setSponsorForm(p => ({
    ...p, collab_types: p.collab_types.includes(opt) ? p.collab_types.filter(x => x !== opt) : [...p.collab_types, opt],
  }));

  // Fikir aşamasındaki projeler (yayında değil → ContentProvider'da yok): yalnızca liderlik seçilince çekilir.
  const [ideaProjects, setIdeaProjects] = useState(null);
  useEffect(() => {
    if (eff.intent !== 'founder_lead' || ideaProjects !== null) return;
    supabase.from('startups').select('id, name').eq('stage', 'idea').order('name')
      .then(({ data }) => setIdeaProjects(data || []))
      .catch(() => setIdeaProjects([]));
  }, [eff.intent, ideaProjects]);

  // ── doğrulama + gönderim ──
  const validate = () => {
    const intent = eff.intent;
    const missing = [];
    const need = (ok, field, label) => { if (!ok) missing.push([field, label]); };
    let email;
    if (intent === 'mentor_application') {
      need(mentorForm.name.trim(), 'name', L('Ad Soyad', 'Full Name'));
      need(mentorForm.email.trim(), 'email', L('E-posta', 'Email'));
      email = mentorForm.email;
    } else if (intent === 'sponsor_application') {
      need(sponsorForm.contact_name.trim(), 'contact_name', L('İletişim Kişisi', 'Contact Name'));
      need(sponsorForm.email.trim(), 'email', L('E-posta', 'Email'));
      email = sponsorForm.email;
    } else {
      need(form.name.trim(), 'name', L('Ad Soyad', 'Full Name'));
      need(form.email.trim(), 'email', L('E-posta', 'Email'));
      if (intent === 'idea_application') need(form.pitch.trim(), 'pitch', L('Fikrin', 'Your idea'));
      if (intent === 'club_team') need(eff.area, 'area', L('Ekip', 'Team'));
      if (intent === 'project' && !project) need(form.projectId, 'projectId', L('Proje', 'Project'));
      if (intent === 'pool_match') need(form.role, 'role', L('İlgi Alanı', 'Area of interest'));
      email = form.email;
    }
    if (missing.length) {
      setInvalid(new Set(missing.map(([f]) => f)));
      return L(`Lütfen zorunlu alanları doldurun: ${missing.map(([, l]) => l).join(', ')}.`,
               `Please fill in the required fields: ${missing.map(([, l]) => l).join(', ')}.`);
    }
    if (!EMAIL_RE.test(email.trim())) {
      setInvalid(new Set(['email']));
      return L('Lütfen geçerli bir e-posta adresi girin.', 'Please enter a valid email address.');
    }
    setInvalid(new Set());
    return null;
  };

  const buildPayload = () => {
    const intent = eff.intent;
    if (intent === 'mentor_application') {
      return {
        name: mentorForm.name, email: mentorForm.email,
        expertise: mentorForm.expertise || null,
        experience_years: mentorForm.experience_years || null,
        company: mentorForm.current_company || null,
        weekly_hours: mentorForm.hours_per_week || null,
        linkedin_url: mentorForm.linkedin || null,
        bio: mentorForm.mentor_note || null,
        intent, status: 'new',
      };
    }
    if (intent === 'sponsor_application') {
      return {
        name: sponsorForm.contact_name, email: sponsorForm.email,
        company_name: sponsorForm.company || null,
        website: sponsorForm.website || null,
        collaboration_types: sponsorForm.collab_types.length ? sponsorForm.collab_types : null,
        sponsor_message: sponsorForm.sponsor_message || null,
        intent, status: 'new',
      };
    }
    const inFormProject = intent === 'project' && form.projectId
      ? startups.find(s => String(s.id) === String(form.projectId)) : null;
    const ideaProject = intent === 'founder_lead' && form.ideaProjectId
      ? (ideaProjects || []).find(s => String(s.id) === String(form.ideaProjectId)) : null;
    const picked = project || inFormProject || ideaProject;
    const areaObj = intent === 'club_team' ? areas.find(a => a.key === eff.area) : null;
    // Hub tarafı `role`'ü serbest metin okur: kulüp ekibi için TR ekip adı (tetikleyici
    // "tasar/sosyal/sponsor" anahtar kelimelerinden role_type türetir).
    const role = intent === 'club_team' ? (areaObj?.label || null)
      : intent === 'project' ? (savedRole || form.role || null)
      : (intent === 'community' || intent === 'pool_match') ? (form.role || null)
      : null;
    return {
      name: form.name, email: form.email,
      university: form.university || null, department: form.department || null,
      role, intent, status: 'new',
      bio: form.bio || null, skills: form.skills || null,
      linkedin: form.linkedin || null, portfolio: form.portfolio || null,
      project_id: picked?.id || null, project_name: picked?.name || null,
      pitch: form.pitch.trim() || null, problem: form.problem.trim() || null, progress: form.progress.trim() || null,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();
    if (msg) { setSubmitError(msg); return; }
    setSubmitting(true); setSubmitError('');
    try {
      const { error } = await supabase.from('applications').insert(buildPayload());
      if (error) throw error;
      setSubmitted({ side: eff.side, intent: eff.intent });
      try { sessionStorage.removeItem(PATH_KEY); sessionStorage.removeItem('sh_join_role'); } catch { /* yok say */ }
    } catch (err) {
      console.error('Form gönderim hatası:', err);
      setSubmitError(L('Bir hata oluştu: ', 'An error occurred: ') + (err?.message || L('Lütfen tekrar dene.', 'Please try again.')));
    } finally {
      setSubmitting(false);
    }
  };

  const stepper = (n) => {
    const items = [L('Seçim', 'Choose'), L('Bilgiler', 'Details'), L('Tamam', 'Done')];
    return (
      <div className="jn-steps" aria-label="progress">
        {items.map((label, i) => (
          <span key={label} style={{ display: 'contents' }}>
            {i > 0 && <span className="jn-steps__bar" />}
            <span className={`jn-steps__item${i + 1 <= n ? ' jn-steps__item--on' : ''}`}>
              <span className="jn-steps__dot">{i + 1 < n ? <Icon name="check" size={12} /> : i + 1}</span>{label}
            </span>
          </span>
        ))}
      </div>
    );
  };

  // ════════════════════════════════════════
  // 4. TAMAM
  // ════════════════════════════════════════
  if (step === 'done') {
    const s = submitted.side;
    const intent = submitted.intent;
    const copy = {
      community: [L('Aramıza hoş geldin!', 'Welcome aboard!'),
        L('Başvurunu aldık. Topluluk gruplarımıza katılarak etkinliklerden ve duyurulardan ilk sen haberdar ol.', 'We got your application. Join our community groups to hear about events and news first.')],
      club_team: [L('Ekip başvurun alındı!', 'Your team application is in!'),
        L('Ekip liderleri başvurunu inceleyip seninle e-posta üzerinden iletişime geçecek. Beklerken gruplarımıza katıl.', 'Team leads will review your application and email you. Meanwhile, join our groups.')],
      founder_lead: [L('Başvurun Lab\'e ulaştı!', 'Your application reached the Lab!'),
        L('Kurucu ekibimiz başvurunu inceleyip seninle iletişime geçecek.', 'Our founder team will review your application and get back to you.')],
      idea_application: [L('Fikrin bize ulaştı!', 'We received your idea!'),
        L('Fikrini değerlendirip seninle iletişime geçeceğiz. Beklerken Lab topluluğuna katılabilirsin.', 'We will review your idea and get in touch. Meanwhile, you can join the Lab community.')],
      project: [L('Başvurun ekibe iletildi!', 'Your application was passed to the team!'),
        L('Proje ekibi başvurunu inceleyip seninle e-posta üzerinden iletişime geçecek.', 'The project team will review it and email you.')],
      pool_match: [L('Eşleşme havuzundasın!', "You're in the matching pool!"),
        L('İlgi alanına uygun bir proje çıktığında seninle iletişime geçeceğiz.', 'When a project matches your interests, we will reach out.')],
      mentor_application: [L('Mentörlük başvurun alındı!', 'Your mentor application is in!'),
        L('İlgin için teşekkürler. Başvurunu inceleyip uygun ekiplerle eşleştiğinde seninle e-posta üzerinden iletişime geçeceğiz.', "Thanks for your interest. We'll review your application and reach out by email once we find a good match.")],
      sponsor_application: [L('Destekçi başvurun alındı!', 'Your sponsor application is in!'),
        L('İlginiz için teşekkür ederiz. Ekibimiz en kısa sürede sizinle iletişime geçip iş birliği detaylarını konuşacak.', 'Thank you for your interest. Our team will reach out shortly to discuss collaboration details.')],
    }[intent] || [t('join.successTitle'), t('join.successDesc')];

    const note = s === 'hub' ? fsTr('hub_success_note_tr', '', '') : s === 'lab' ? fsTr('lab_success_note_tr', '', '') : '';
    const instagram = externalUrl(fs('hub_instagram_url', '') || site.instagram_url);
    const linkedin = externalUrl(fs('lab_linkedin_url', '') || site.company_linkedin);
    const hubWa = externalUrl(fs('hub_whatsapp_url', ''));
    const labWa = externalUrl(fs('lab_whatsapp_url', ''));
    const links = [];
    if (s === 'hub') {
      if (hubWa) links.push(<LinkCard key="wa" kind="whatsapp" icon="whatsapp" title={L('WhatsApp Topluluk Grubu', 'WhatsApp Community Group')} desc={L('Duyurular ve sohbet için gruba katıl', 'Join for announcements and chat')} href={hubWa} />);
      if (instagram) links.push(<LinkCard key="ig" kind="instagram" icon="instagram" title="Instagram" desc={L('Etkinlikleri ve günlük hayatı takip et', 'Follow events and behind the scenes')} href={instagram} />);
    } else if (s === 'lab') {
      if (labWa) links.push(<LinkCard key="wa" kind="whatsapp" icon="whatsapp" title={L('WhatsApp Lab Grubu', 'WhatsApp Lab Group')} desc={L('Kurucular ve proje ekipleriyle tanış', 'Meet founders and project teams')} href={labWa} />);
      if (linkedin) links.push(<LinkCard key="li" kind="linkedin" icon="linkedin" title="LinkedIn" desc={L('Sayfamızı takip et, ağını büyüt', 'Follow us and grow your network')} href={linkedin} />);
    } else {
      if (linkedin) links.push(<LinkCard key="li" kind="linkedin" icon="linkedin" title="LinkedIn" desc={L('Sayfamızı takip et', 'Follow our page')} href={linkedin} />);
      if (instagram) links.push(<LinkCard key="ig" kind="instagram" icon="instagram" title="Instagram" desc={L('Bizi takip et', 'Follow us')} href={instagram} />);
    }

    return (
      <div className={`page-transition jn ${s === 'lab' ? 'jn--lab' : 'jn--hub'}`}>
        <div style={{ minHeight: '80vh', paddingTop: 'calc(var(--nav-h) + 56px)', paddingBottom: 64 }}>
          <div className="container">
            <div className="jn-done jn-step">
              <div className="jn-done__ring"><Icon name="check" size={44} /></div>
              <h2 className="jn-done__title">{copy[0]}</h2>
              <p className="jn-done__desc">{copy[1]}</p>
              {note && <div className="jn-done__note">{note}</div>}
              {links.length > 0 && (
                <>
                  <div className="jn-links-title">{L('Bizi takip et', 'Stay connected')}</div>
                  <div className="jn-links">{links}</div>
                </>
              )}
              <div className="jn-done__home">
                <button type="button" className="btn btn--secondary" onClick={() => { navigate('home'); window.scrollTo({ top: 0 }); }}>{t('nav.home')}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════
  // 1. SEÇİM — HUB / LAB
  // ════════════════════════════════════════
  if (step === 'choose') {
    const cards = [
      { key: 'hub', word: 'HUB',
        chip: fsTr('hub_card_title_tr', 'Topluluk & Kulüp', 'Community & Club'),
        desc: fsTr('hub_card_desc_tr',
          'Start-Hub topluluğunun kalbi. Etkinlikler, buluşmalar ve kulübü ayakta tutan ekipler — herkes katılabilir, isteyen bir ekipte görev alır.',
          'The heart of the Start-Hub community. Events, meetups and the teams that run the club — anyone can join, and you can take a role in a team.'),
        bullets: [
          L('Herkese açık topluluk üyeliği', 'Open community membership for everyone'),
          L('Sosyal medya, tasarım, organizasyon, sponsorluk ekipleri', 'Social media, design, events and sponsorship teams'),
          L('Etkinlikler, buluşmalar ve WhatsApp grubu', 'Events, meetups and a WhatsApp group'),
        ],
        cta: L("Hub'a Katıl", 'Join the Hub') },
      { key: 'lab', word: 'LAB',
        chip: fsTr('lab_card_title_tr', 'Girişim Laboratuvarı', 'Startup Lab'),
        desc: fsTr('lab_card_desc_tr',
          'Fikirlerin ekiplerle buluşup girişime dönüştüğü yer. Kurucu olarak fikrini getir ya da bir projede üye olarak yerini al.',
          'Where ideas meet teams and become startups. Bring your idea as a founder, or take a seat in a project as a member.'),
        bullets: [
          L('Kurucu: fikrine liderlik et veya yeni fikir getir', 'Founder: lead an idea or bring a new one'),
          L('Üye: bir projeye katıl ya da ilgi alanına göre eşleş', 'Member: join a project or get matched by interest'),
          L('Ekip, mentör ve destekçi ağı', 'Team, mentor and supporter network'),
        ],
        cta: L("Lab'e Katıl", 'Join the Lab') },
    ];
    return (
      <div className="page-transition jn">
        <PageHeader label={t('join.label')}
          title={fsTr('hero_title_tr', t('join.title'), fs('hero_title_en', t('join.title')))}
          desc={fsTr('hero_desc_tr', t('join.desc'), fs('hero_desc_en', t('join.desc')))} />
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="jn-wrap jn-step">
              {stepper(1)}
              <div className="jn-sides">
                {cards.map(c => (
                  <button key={c.key} type="button" className={`jn-side jn--${c.key}`} onClick={() => go({ side: c.key, intent: null, area: '' })}>
                    <span className="jn-side__chip">{c.chip}</span>
                    <span className="jn-side__word">{c.word}</span>
                    <p className="jn-side__desc">{c.desc}</p>
                    <ul className="jn-side__list">
                      {c.bullets.map(b => <li key={b}><Icon name="check" size={16} />{b}</li>)}
                    </ul>
                    <span className="jn-side__cta">{c.cta}<Icon name="arrowRight" size={18} /></span>
                  </button>
                ))}
              </div>
              <div className="jn-other">
                <span>{L('Bunlar dışında:', 'Or:')}</span>
                <button type="button" className="jn-pill" onClick={() => pick('mentor_application')}>
                  <Icon name="graduationCap" size={16} />{fsTr('mentor_card_title_tr', 'Mentör Ol', 'Become a Mentor')}
                </button>
                <button type="button" className="jn-pill" onClick={() => pick('sponsor_application')}>
                  <Icon name="handshake" size={16} />{fsTr('sponsor_card_title_tr', 'Destekçi / Sponsor Ol', 'Become a Supporter')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ════════════════════════════════════════
  // 2. YOL SEÇİMİ
  // ════════════════════════════════════════
  if (step === 'path') {
    const isHub = side === 'hub';
    return (
      <div className={`page-transition jn jn--${side}`}>
        <PageHeader label={isHub ? 'HUB' : 'LAB'}
          title={isHub ? L('Nasıl katılmak istersin?', 'How do you want to join?') : L('Lab’de hangi rolle yer alacaksın?', 'What is your role in the Lab?')}
          desc={isHub
            ? L('Topluluğa üye ol ya da kulübü yürüten ekiplerden birinde görev al.', 'Become a community member or take a role in one of the teams that run the club.')
            : L('Fikri olan kurucu ya da üretmek isteyen bir üye olarak katıl.', 'Join as a founder with an idea or as a member who wants to build.')} />
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="jn-wrap jn-step">
              {stepper(1)}
              <button type="button" className="jn-back" onClick={() => go({ side: null, intent: null, area: '' })}>
                <Icon name="arrowLeft" size={16} />{L('Geri', 'Back')}
              </button>

              {isHub ? (
                <>
                  <OptionCard big icon="users"
                    title={fsTr('community_card_title_tr', 'Topluluğa Katıl', 'Join the Community')}
                    desc={fsTr('community_card_desc_tr', 'Öğrenci, mezun ya da genç profesyonel — herkes katılabilir. Etkinliklerden ve topluluktan haberdar ol.', 'Student, graduate or young professional — everyone can join. Stay in the loop on events and community.')}
                    onClick={() => pick('community')} />
                  <div className="jn-section">
                    <div className="jn-eyebrow">{L('Ekip üyesi ol', 'Become a team member')}</div>
                    <p className="jn-sub">{L('Kulübü birlikte yürütüyoruz. Bir ekip seç, başvurunu doğrudan o ekibe bırak.', 'We run the club together. Pick a team and apply to it directly.')}</p>
                    <div className="jn-areas">
                      {areas.map(a => (
                        <OptionCard key={a.key} icon={a.icon || 'star'} title={areaLabel(a)} desc={a.desc || ''} onClick={() => pick('club_team', a.key)} />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="jn-groups">
                  <div className="jn-group">
                    <div className="jn-group__head">
                      <span className="jn-group__badge"><Icon name="rocket" size={20} /></span>
                      <span className="jn-group__title">{L('Kurucu', 'Founder')}</span>
                    </div>
                    <p className="jn-group__desc">{L('Elinde bir fikir ya da bir girişime liderlik etme hevesi var.', 'You have an idea, or the drive to lead a venture.')}</p>
                    <OptionCard icon="target" title={L('Bir fikrin liderliğine talip ol', 'Lead an existing idea')}
                      desc={L('Fikir aşamasındaki bir projeye kurucu / ortak olarak liderlik et.', 'Lead an idea-stage project as founder or co-founder.')}
                      onClick={() => pick('founder_lead')} />
                    <OptionCard icon="lightbulb" title={L('Yeni fikrim var', 'I have a new idea')}
                      desc={L('Fikrini getir, toplulukla birlikte geliştirelim.', 'Bring your idea and let’s build it with the community.')}
                      onClick={() => pick('idea_application')} />
                  </div>
                  <div className="jn-group">
                    <div className="jn-group__head">
                      <span className="jn-group__badge"><Icon name="users" size={20} /></span>
                      <span className="jn-group__title">{L('Proje Üyesi', 'Project Member')}</span>
                    </div>
                    <p className="jn-group__desc">{L('Bir ekipte üretmek, öğrenmek ve katkı sağlamak istiyorsun.', 'You want to build, learn and contribute in a team.')}</p>
                    <OptionCard icon="briefcase" title={L('Bir projeye katıl', 'Join a project')}
                      desc={L('Açık pozisyonu olan devam eden bir projede yer al.', 'Take a seat in an ongoing project with open roles.')}
                      onClick={() => pick('project')} />
                    <OptionCard icon="sparkles" title={L('İlgi alanıma göre eşleşme havuzu', 'Match me by my interests')}
                      desc={L('İlgi alanını ve becerilerini bırak; uygun proje çıkınca seninle iletişime geçelim.', 'Leave your interests and skills; we will reach out when a project fits.')}
                      onClick={() => pick('pool_match')} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ════════════════════════════════════════
  // 3. FORM
  // ════════════════════════════════════════
  const intent = eff.intent;
  const activeArea = areas.find(a => a.key === eff.area);
  const titles = {
    community: L('Topluluğa Katıl', 'Join the Community'),
    club_team: activeArea ? `${areaLabel(activeArea)} — ${L('Ekip Başvurusu', 'Team Application')}` : L('Ekip Başvurusu', 'Team Application'),
    founder_lead: L('Kurucu — Liderlik Başvurusu', 'Founder — Leadership Application'),
    idea_application: L('Yeni Fikir', 'New Idea'),
    project: project ? L(`${project.name} Ekibine Katıl`, `Join ${project.name} Team`) : L('Projeye Katıl', 'Join a Project'),
    pool_match: L('Eşleşme Havuzu', 'Matching Pool'),
    mentor_application: L('Mentör Ol', 'Become a Mentor'),
    sponsor_application: L('Destekçi / Sponsor Ol', 'Become a Supporter'),
  };
  const sideName = { hub: 'HUB', lab: 'LAB', other: L('Diğer', 'Other') }[side];
  const pathLabel = {
    community: L('Topluluk', 'Community'), club_team: L('Ekip Üyesi', 'Team Member'),
    founder_lead: L('Kurucu › Liderlik', 'Founder › Leadership'), idea_application: L('Kurucu › Yeni Fikir', 'Founder › New Idea'),
    project: L('Proje Üyesi › Projeye Katıl', 'Member › Join a Project'), pool_match: L('Proje Üyesi › Eşleşme Havuzu', 'Member › Matching Pool'),
    mentor_application: L('Mentör', 'Mentor'), sponsor_application: L('Destekçi', 'Supporter'),
  }[intent];

  const submitBtn = (
    <button type="submit" className="btn btn--primary btn--lg jn-submit" disabled={submitting}>
      {submitting ? L('Gönderiliyor…', 'Sending…') : t('join.submit')}
      {!submitting && <Icon name="arrowRight" size={16} />}
    </button>
  );
  const errorBanner = submitError ? <div className="jn-error">{submitError}</div> : null;

  const nameEmail = (v, set, nameKey, nameLabel, emailLabel, nameField = 'name') => (
    <div className="grid grid-2">
      <TextInput label={nameLabel} required invalid={invalid.has(nameField)} value={v[nameKey]} onChange={set(nameKey)} />
      <TextInput label={emailLabel} required type="email" invalid={invalid.has('email')} value={v.email} onChange={set('email')} />
    </div>
  );

  const projectCard = project ? (
    <div className="jn-project" style={{ background: `color-mix(in srgb, ${project.color} 6%, var(--card-bg))`, border: `1.5px solid color-mix(in srgb, ${project.color} 22%, var(--border))` }}>
      <div className="jn-project__logo" style={{ background: project.color }}>
        {project.logo ? <img src={project.logo} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : project.name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15 }}>{project.name}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.03em', color: project.color, background: `color-mix(in srgb, ${project.color} 12%, transparent)`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{L('Proje Başvurusu', 'Project Application')}</span>
        </div>
        {savedRole && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="briefcase" size={13} /><span>{savedRole}</span>
          </div>
        )}
      </div>
      <button type="button" className="jn-project__x" onClick={clearProject} title={L('Proje seçimini kaldır', 'Remove project')}><Icon name="x" size={16} /></button>
    </div>
  ) : (
    <div className="jn-context">
      <span className="jn-context__icon"><Icon name={PATHS[intent].icon} size={18} /></span>
      <span className="jn-context__text"><b>{sideName} › {pathLabel}</b>{activeArea ? areaLabel(activeArea) : null}</span>
      <button type="button" className="jn-context__change" onClick={() => (side === 'other' ? go({ side: null, intent: null, area: '' }) : go({ side, intent: null, area: '' }))}>{L('Değiştir', 'Change')}</button>
    </div>
  );

  const roleDesc = (project && savedRole) ? (() => {
    const liveRole = (project.openRolesLive || []).find(r => r.title === savedRole);
    const desc = liveRole?.profile || getRoleDescription(savedRole, lang);
    if (!desc) return null;
    return (
      <div style={{ padding: '18px 20px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-lg)', marginBottom: 24, borderLeft: `3px solid ${project.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="briefcase" size={15} style={{ color: project.color }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{L('Görev Tanımı', 'Role Description')}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{savedRole}</div>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{desc}</p>
      </div>
    );
  })() : null;

  const roleSelect = (required) => (
    <SelectBox label={fl('c_role', t('join.role'))} required={required} invalid={invalid.has('role')} value={form.role} onChange={setF('role')}>
      <option value="">—</option>
      {Object.entries(t('join.roles')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </SelectBox>
  );
  const uniDept = (
    <div className="grid grid-2">
      <TextInput label={fl('c_university', t('join.university'))} value={form.university} onChange={setF('university')} />
      <TextInput label={fl('c_department', t('join.department'))} value={form.department} onChange={setF('department')} />
    </div>
  );
  const skillsField = <TextInput label={fl('c_skills', t('join.skills'))} placeholder={t('join.skillsPlaceholder')} value={form.skills} onChange={setF('skills')} />;
  const links = (
    <div className="grid grid-2">
      <TextInput label={fl('c_linkedin', t('join.linkedin'))} placeholder="linkedin.com/in/..." value={form.linkedin} onChange={setF('linkedin')} />
      <TextInput label={fl('c_portfolio', t('join.portfolio'))} placeholder="github.com/..." value={form.portfolio} onChange={setF('portfolio')} />
    </div>
  );

  const memberFields = () => {
    switch (intent) {
      case 'community':
        return (<>
          {uniDept}
          {roleSelect(false)}
          <TextBox label={fl('c_bio', t('join.bio'))} placeholder={t('join.bioPlaceholder')} value={form.bio} onChange={setF('bio')} />
          {skillsField}
          {links}
        </>);
      case 'club_team':
        return (<>
          {uniDept}
          <SelectBox label={L('Başvurduğun ekip', 'Team you are applying to')} required invalid={invalid.has('area')}
            value={eff.area} onChange={(v) => { go({ ...eff, area: v }); }}>
            <option value="">—</option>
            {areas.map(a => <option key={a.key} value={a.key}>{areaLabel(a)}</option>)}
          </SelectBox>
          <TextBox label={L('Neden bu ekipte olmak istiyorsun?', 'Why do you want to join this team?')}
            placeholder={L('Motivasyonunu ve varsa deneyimini kısaca anlat...', 'Briefly describe your motivation and any experience...')}
            value={form.bio} onChange={setF('bio')} />
          <TextInput label={L('Beceriler / Kullandığın araçlar', 'Skills / tools you use')} placeholder={L('Canva, Figma, Premiere, Excel...', 'Canva, Figma, Premiere, Excel...')} value={form.skills} onChange={setF('skills')} />
          {links}
        </>);
      case 'project':
        return (<>
          {uniDept}
          {!project && (<>
            <SelectBox label={t('join.projectPick')} required invalid={invalid.has('projectId')} value={form.projectId}
              onChange={(v) => { setF('projectId')(v); setF('role')(''); }}>
              <option value="">{t('join.projectPickPlaceholder')}</option>
              {startups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectBox>
            {form.projectId && (() => {
              const picked = startups.find(s => String(s.id) === String(form.projectId));
              const roles = picked?.openRolesLive || [];
              return roles.length === 0
                ? <p className="jn-note">{t('join.noOpenRoles')}</p>
                : (
                  <SelectBox label={t('join.rolePick')} value={form.role} onChange={setF('role')}>
                    <option value="">{t('join.rolePickAny')}</option>
                    {roles.map(r => <option key={r.title} value={r.title}>{r.title}</option>)}
                  </SelectBox>
                );
            })()}
          </>)}
          {project && !savedRole && roleSelect(false)}
          <TextBox label={fl('c_bio', t('join.bio'))} placeholder={t('join.bioPlaceholder')} value={form.bio} onChange={setF('bio')} />
          {skillsField}
          {links}
        </>);
      case 'pool_match':
        return (<>
          <p className="jn-note">{L('İlgi alanını ve becerilerini bırak — seni eşleşme havuzuna ekleyelim, uygun bir proje açıldığında ekiplerle tanıştıralım.', 'Leave your interests and skills — we add you to the matching pool and introduce you to teams when a fitting project opens.')}</p>
          {uniDept}
          {roleSelect(true)}
          {skillsField}
          <TextBox label={L('Kendini ve ne aradığını anlat', 'Tell us about yourself and what you look for')} placeholder={t('join.bioPlaceholder')} value={form.bio} onChange={setF('bio')} />
          {links}
        </>);
      case 'founder_lead':
        return (<>
          <p className="jn-note">{t('join.founderNote')}</p>
          {uniDept}
          {ideaProjects && ideaProjects.length > 0 && (
            <SelectBox label={t('join.ideaProjectPick')} value={form.ideaProjectId} onChange={setF('ideaProjectId')}>
              <option value="">{t('join.ideaProjectNone')}</option>
              {ideaProjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectBox>
          )}
          {!form.ideaProjectId && (
            <TextBox label={t('join.founderPitch')} placeholder={t('join.founderPitchPlaceholder')} value={form.pitch} onChange={setF('pitch')} />
          )}
          <TextBox label={t('join.founderExperience')} placeholder={t('join.bioPlaceholder')} value={form.bio} onChange={setF('bio')} />
          <TextInput label={fl('c_linkedin', t('join.linkedin'))} placeholder="linkedin.com/in/..." value={form.linkedin} onChange={setF('linkedin')} />
        </>);
      case 'idea_application':
        return (<>
          {uniDept}
          <TextBox label={t('join.pitchLabel')} required invalid={invalid.has('pitch')} placeholder={t('join.pitchPlaceholder')} value={form.pitch} onChange={setF('pitch')} />
          <TextBox label={t('join.problemLabel')} placeholder={t('join.problemPlaceholder')} value={form.problem} onChange={setF('problem')} />
          <TextBox label={t('join.progressLabel')} placeholder={t('join.progressPlaceholder')} value={form.progress} onChange={setF('progress')} />
          <TextInput label={fl('c_linkedin', t('join.linkedin'))} placeholder="linkedin.com/in/..." value={form.linkedin} onChange={setF('linkedin')} />
        </>);
      default:
        return null;
    }
  };

  const collabOptions = lang === 'tr'
    ? ['Finansal Destek', 'Mentorluk', 'Etkinlik Sponsorluğu', 'Staj İmkanı', 'Diğer']
    : ['Financial Support', 'Mentorship', 'Event Sponsorship', 'Internship', 'Other'];

  const mentorFields = (<>
    <div className="grid grid-2">
      <TextInput label={fl('m_name', t('join.name'))} required invalid={invalid.has('name')} value={mentorForm.name} onChange={setM('name')} />
      <TextInput label={fl('m_email', t('join.email'))} required type="email" invalid={invalid.has('email')} value={mentorForm.email} onChange={setM('email')} />
    </div>
    <TextInput label={fl('m_expertise', L('Uzmanlık Alanı', 'Area of Expertise'))} placeholder={L('ör. Fintech, Ürün Yönetimi, Pazarlama', 'e.g. Fintech, Product Management, Marketing')} value={mentorForm.expertise} onChange={setM('expertise')} />
    <div className="grid grid-2">
      <SelectBox label={fl('m_experience', L('Deneyim Yılı', 'Years of Experience'))} value={mentorForm.experience_years} onChange={setM('experience_years')}>
        <option value="">—</option>
        {['1-3', '3-5', '5-10', '10+'].map(v => <option key={v} value={v}>{v} {L('yıl', 'years')}</option>)}
      </SelectBox>
      <SelectBox label={fl('m_hours', L('Haftalık Uygun Saat', 'Hours per Week'))} value={mentorForm.hours_per_week} onChange={setM('hours_per_week')}>
        <option value="">—</option>
        {['1-2', '2-4', '4+'].map(v => <option key={v} value={v}>{v} {L('saat', 'hours')}</option>)}
      </SelectBox>
    </div>
    <TextInput label={fl('m_company', L('Mevcut Şirket / Kurum', 'Current Company / Organization'))} value={mentorForm.current_company} onChange={setM('current_company')} />
    <TextInput label={fl('m_linkedin', 'LinkedIn')} placeholder="linkedin.com/in/..." value={mentorForm.linkedin} onChange={setM('linkedin')} />
    <TextBox label={fl('m_note', L('Neden mentör olmak istiyorsunuz?', 'Why do you want to mentor?'))} maxLength={400}
      placeholder={L('Kısaca açıklayın…', 'Briefly explain…')} value={mentorForm.mentor_note} onChange={setM('mentor_note')} minHeight={110} />
  </>);

  const sponsorFields = (<>
    <div className="grid grid-2">
      <TextInput label={fl('s_contact', L('İletişim Kişisi', 'Contact Name'))} required invalid={invalid.has('contact_name')} value={sponsorForm.contact_name} onChange={setS('contact_name')} />
      <TextInput label={fl('s_email', t('join.email'))} required type="email" invalid={invalid.has('email')} value={sponsorForm.email} onChange={setS('email')} />
    </div>
    <div className="grid grid-2">
      <TextInput label={fl('s_company', L('Şirket / Kurum Adı', 'Company / Organization'))} value={sponsorForm.company} onChange={setS('company')} />
      <TextInput label={fl('s_website', L('Web Sitesi', 'Website'))} placeholder="https://..." value={sponsorForm.website} onChange={setS('website')} />
    </div>
    <div className="form-group">
      <label className="form-label" style={{ marginBottom: 10 }}>{fl('s_collab', L('İşbirliği Türü', 'Collaboration Type'))}</label>
      <div className="jn-chipset">
        {collabOptions.map(opt => {
          const on = sponsorForm.collab_types.includes(opt);
          return (
            <label key={opt} className={`jn-check${on ? ' jn-check--on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggleCollab(opt)} />{opt}
            </label>
          );
        })}
      </div>
    </div>
    <TextBox label={fl('s_message', L('Mesajınız (opsiyonel)', 'Message (optional)'))} maxLength={500}
      placeholder={L('Nasıl katkı sağlamak istediğinizi anlatın…', "Tell us how you'd like to contribute…")}
      value={sponsorForm.sponsor_message} onChange={setS('sponsor_message')} minHeight={110} />
  </>);

  return (
    <div className={`page-transition jn jn--${side === 'lab' ? 'lab' : 'hub'}`}>
      <PageHeader label={project ? t('join.label') : sideName} title={titles[intent]}
        desc={project
          ? L(`${project.name} projesine başvurunu bu form ile gönderebilirsin.`, `Submit your application to join the ${project.name} project.`)
          : L('Birkaç bilgi yeterli — başvurunu hemen ilgili ekibe iletelim.', 'A few details are enough — we will pass your application to the right team.')} />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="jn-wrap jn-wrap--narrow jn-step">
            {stepper(2)}
            {!project && (
              <button type="button" className="jn-back" onClick={() => go(side === 'other' ? { side: null, intent: null, area: '' } : { side, intent: null, area: '' })}>
                <Icon name="arrowLeft" size={16} />{L('Geri', 'Back')}
              </button>
            )}
            <div className="jn-card">
              {projectCard}
              {roleDesc}
              <form onSubmit={handleSubmit} noValidate>
                {intent === 'mentor_application' ? mentorFields
                  : intent === 'sponsor_application' ? sponsorFields
                  : (<>
                      {nameEmail(form, setF, 'name', fl('c_name', t('join.name')), fl('c_email', t('join.email')))}
                      {memberFields()}
                    </>)}
                {errorBanner}
                {submitBtn}
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export { JoinPage };
