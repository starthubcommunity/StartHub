// other-pages.jsx — Yazılar (Blog) & Katıl (Join)
import { useState as useStateOP, useEffect as useEffectOP } from 'react';
import { useLang, usePosts, useEvents, useStartups } from './data';
import { supabase } from './lib/supabase';
import { Icon, Button, PostCard, EventCard, Reveal } from './ui-components';
import { CTASection, PageHeader } from './layout';
import { getRoleDescription } from './detail-pages';

// ============================================
// YAZILAR (BLOG) — etiket filtreleri: Tümü / Gündem / Günlük / Görüş
// ============================================
// ============================================
// EVENTS TAB — Etkinlik sekmesi (Yazılar sayfasında)
// ============================================
function EventsTab({ lang }) {
  const { events } = useEvents();
  const evList = (events || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const now = new Date().toISOString().slice(0, 10);
  const upcoming = evList.filter(e => e.date >= now);
  const past = evList.filter(e => e.date < now);

  const monthNames = lang === 'tr'
    ? ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const typeLabels = lang === 'tr'
    ? { workshop: 'Atölye', meetup: 'Buluşma', hackathon: 'Hackathon', webinar: 'Webinar', talk: 'Konuşma' }
    : { workshop: 'Workshop', meetup: 'Meetup', hackathon: 'Hackathon', webinar: 'Webinar', talk: 'Talk' };

  const renderEvent = (ev) => {
    const d = new Date(ev.date + 'T00:00:00');
    const day = d.getDate();
    const month = monthNames[d.getMonth()];
    const loc = lang === 'tr' ? (ev.location_tr || ev.location_en) : (ev.location_en || ev.location_tr);
    const title = lang === 'tr' ? (ev.title_tr || ev.title_en) : (ev.title_en || ev.title_tr);
    const desc = lang === 'tr' ? (ev.desc_tr || ev.desc_en) : (ev.desc_en || ev.desc_tr);
    return (
      <div key={ev.id} className="card event-card">
        <div className="card__inner" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div className="event-card__date-badge" style={{ background: `color-mix(in srgb, ${ev.color} 12%, transparent)`, color: ev.color }}>
            <span className="day">{day}</span>
            <span className="month">{month}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge badge--tag">{typeLabels[ev.type] || ev.type}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ev.organizer}</span>
            </div>
            <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</h4>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{desc}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="mapPin" size={13} /> {loc}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} /> {ev.time}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (evList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)' }}>
        <Icon name="calendar" size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
        <p style={{ fontSize: 16 }}>{lang === 'tr' ? 'Henüz etkinlik eklenmemiş.' : 'No events added yet.'}</p>
      </div>
    );
  }

  return (
    <div>
      {upcoming.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--text-primary)' }}>
            {lang === 'tr' ? 'Yaklaşan Etkinlikler' : 'Upcoming Events'}
          </h3>
          <div className="grid grid-2" style={{ marginBottom: 32 }}>
            {upcoming.map(renderEvent)}
          </div>
        </>
      )}
      {past.length > 0 && (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, marginBottom: 16, color: 'var(--text-tertiary)' }}>
            {lang === 'tr' ? 'Geçmiş Etkinlikler' : 'Past Events'}
          </h3>
          <div className="grid grid-2" style={{ opacity: 0.6 }}>
            {past.map(renderEvent)}
          </div>
        </>
      )}
    </div>
  );
}

function BlogPage({ navigate }) {
  const { lang, t } = useLang();
  const { posts, postsLoading } = usePosts();
  const [active, setActive] = useStateOP('all');

  const cats = [
    { key: 'all', label: t('tags.all') },
    { key: 'blog', label: t('tags.blog') },
    { key: 'gundem', label: t('tags.gundem') },
    { key: 'etkinlik', label: t('tags.etkinlik') },
  ];

  if (postsLoading) return <div className="page-transition" style={{ minHeight: '60vh' }} />;
  const sorted = [...posts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const filtered = active === 'all' ? sorted : sorted.filter(p => p.tag === active);
  const goPost = (id) => { navigate('post', id); window.scrollTo({ top: 0 }); };

  // Tavsiye edilen (recommended) yazılar — en fazla 3, yeniden eskiye.
  // En yeni tavsiye edilen büyük kartta, diğer 2'si gridin ilk iki sırasında.
  const recommended = sorted.filter(p => p.recommended).slice(0, 3);
  const featurePost = active === 'all' ? (recommended[0] || filtered[0]) : null;
  const recRest = active === 'all' ? recommended.slice(1, 3) : [];
  const recIds = new Set([featurePost, ...recRest].filter(Boolean).map(p => p.id));
  const gridPosts = active === 'all'
    ? [...recRest, ...filtered.filter(p => !recIds.has(p.id))]
    : filtered;

  return (
    <div className="page-transition">
      <PageHeader label={t('blog.label')} title={t('blog.title')} desc={t('blog.desc')} />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="filters" style={{ marginBottom: 32 }}>
            {cats.map(c => (
              <button key={c.key} className={`filter-btn ${active === c.key ? 'filter-btn--active' : ''}`} onClick={() => setActive(c.key)}>
                {c.label}
              </button>
            ))}
          </div>

          {active === 'etkinlik' ? (
            <EventsTab lang={lang} />
          ) : (
            <>
              {/* İlk yazı feature */}
              {featurePost && (
                <div style={{ marginBottom: 24 }}>
                  <PostCard post={featurePost} feature pinned={!!featurePost.recommended} onClick={() => goPost(featurePost.id)} />
                </div>
              )}

              <div className="grid grid-3">
                {gridPosts.map(post => (
                  <PostCard key={post.id} post={post} pinned={!!post.recommended} onClick={() => goPost(post.id)} />
                ))}
              </div>

              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)' }}>
                  <p>{lang === 'tr' ? 'Bu etikette henüz yazı yok.' : 'No posts with this tag yet.'}</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <CTASection navigate={navigate} />
    </div>
  );
}

// ============================================
// KATIL (JOIN)
// ============================================
// Kart tür renkleri (animasyon + vurgu için --jt-c).
const JT_COLOR = { community: '#DC2626', mentor: '#2563EB', sponsor: '#D97706' };

// Seçili kartta EMOJİNİN kendisi hareket eder ve emojiye uygun küçük bir efekt eşlik eder
// (yalnızca CSS animasyonu, dekoratif):
//   🚀 topluluk → motor titremesi, alev izi + duman ile fırlar, sol alttan geri süzülür
//   🎓 mentör   → kep havaya atılıp döner, inerken konfeti saçılır
//   🤝 destekçi → el sıkışır gibi sallanır, sonunda "anlaşma" halkası + kıvılcım
const CONFETTI = [['#2563EB', -34, -14, 200], ['#F59E0B', 34, -20, -160], ['#DC2626', -22, 12, 120], ['#16A34A', 30, 10, -220], ['#7C3AED', 2, -32, 90]];
function EmojiFx({ type }) {
  if (type === 'community') return (
    <>
      <i className="jt-flame" />
      {[['0s', '-16px', '22px'], ['.12s', '-4px', '30px'], ['.24s', '-28px', '12px']].map(([d, dx, dy]) => <i key={d} className="jt-smoke" style={{ '--d': d, '--dx': dx, '--dy': dy }} />)}
    </>
  );
  if (type === 'mentor') return (
    <>{CONFETTI.map(([c, dx, dy, r]) => <i key={c} className="jt-conf" style={{ '--c': c, '--dx': dx + 'px', '--dy': dy + 'px', '--r': r + 'deg' }} />)}</>
  );
  return (
    <>
      <i className="jt-deal" />
      {[['-30px', '-22px', '0s'], ['30px', '-18px', '.08s'], ['-24px', '18px', '.16s'], ['28px', '20px', '.04s']].map(([x, y, d], i) => <i key={i} className="jt-sprk" style={{ '--x': x, '--y': y, '--d': d }} />)}
    </>
  );
}

// Kart seviyesinde yalnızca topluluk için: gökyüzü gibi yanıp sönen küçük yıldızlar.
function CardFx({ type }) {
  if (type !== 'community') return null;
  return (
    <span className="jt-fx" aria-hidden="true">
      {[['78%', '22%', '0s'], ['58%', '46%', '.9s'], ['86%', '62%', '1.6s'], ['40%', '14%', '2.2s']].map(([x, y, d]) => (
        <i key={d} className="jt-star" style={{ '--x': x, '--y': y, '--d': d }} />
      ))}
    </span>
  );
}

function JoinPage({ navigate, projectId }) {
  const { lang, t } = useLang();
  const { startups } = useStartups();
  const [submitted, setSubmitted] = useStateOP(false);
  const [submittedType, setSubmittedType] = useStateOP('community');
  const [submitting, setSubmitting] = useStateOP(false);
  const [submitError, setSubmitError] = useStateOP('');
  const [invalidFields, setInvalidFields] = useStateOP(new Set());

  // Panelden düzenlenebilir katılım formu metinleri — yüklenene kadar / boşsa
  // sabit çeviriler (t()) kullanılır, hiçbir zaman boş görünmez.
  const [formSettings, setFormSettings] = useStateOP(null);
  useEffectOP(() => {
    supabase.from('join_form_settings').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setFormSettings(data); })
      .catch(() => {});
  }, []);
  const fs = (key, fallback) => (formSettings && formSettings[key]) || fallback;
  const fl = (key, fallback) => (formSettings?.field_labels && formSettings.field_labels[key]) || fallback;

  const project = projectId ? startups.find(s => s.id === projectId || s.slug === projectId) : null;
  const savedRole = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sh_join_role') : null;

  const initialType = (() => {
    if (project) return 'community';
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem('sh_join_type');
      if (s === 'community' || s === 'mentor' || s === 'sponsor') return s;
    }
    return null;
  })();

  const [joinType, setJoinType] = useStateOP(initialType);

  const [communityForm, setCommunityForm] = useStateOP({
    name: '', email: '', university: '', department: '', role: '',
    intent: project ? 'project' : 'community',
    bio: '', linkedin: '', portfolio: '', skills: '',
    // v3.1 — option 3 (devam eden projeye katıl) ve option 4 (liderlik) için:
    projectId: '', ideaProjectId: '',
    // option 4/5 serbest metinler:
    pitch: '', problem: '', progress: '',
  });
  // Fikir aşamasındaki projeler (stage:'idea') — "Lab"ta YAYINDA olmadıkları
  // için ContentProvider'ın (published:true filtreli) startups listesinde yok;
  // ayrı, tembel (yalnızca liderlik seçilince) bir sorgu gerekiyor. RLS zaten
  // startups SELECT'i herkese açık (pub_read_startups using(true)) — sorun yok.
  const [ideaProjects, setIdeaProjects] = useStateOP(null);
  useEffectOP(() => {
    if (communityForm.intent !== 'founder_lead' || ideaProjects !== null) return;
    supabase.from('startups').select('id, name').eq('stage', 'idea').order('name')
      .then(({ data }) => setIdeaProjects(data || []))
      .catch(() => setIdeaProjects([]));
  }, [communityForm.intent, ideaProjects]);
  // `project` deep-link'ten (projectId prop) türetiliyor ama `startups`
  // ContentProvider'dan ASENKRON geliyor — soğuk/yenilenmiş bir sayfa
  // yüklemesinde ilk render'da `project` henüz null olabiliyor, bu yüzden
  // `communityForm.intent`'in mount-anı varsayılanı ('community') kalıcı
  // olarak yanlış kalıyordu (görünür UI değil, yalnızca applications.intent
  // kaydı — 2026-09-16 bulgusu). `project` sonradan çözülünce düzelt; intent
  // dropdown'ı zaten proje bağlamında hiç render edilmiyor, kullanıcı
  // seçimini ezme riski yok.
  useEffectOP(() => {
    if (project) setCommunityForm(p => (p.intent === 'project' ? p : { ...p, intent: 'project' }));
  }, [project]);
  const [mentorForm, setMentorForm] = useStateOP({
    name: '', email: '', expertise: '', experience_years: '',
    current_company: '', hours_per_week: '', linkedin: '', mentor_note: '',
  });
  const [sponsorForm, setSponsorForm] = useStateOP({
    contact_name: '', email: '', company: '', website: '',
    collab_types: [], sponsor_message: '',
  });

  const clearInvalid = (f) => setInvalidFields(prev => { if (!prev.has(f)) return prev; const next = new Set(prev); next.delete(f); return next; });
  const handleC = (f, v) => { setCommunityForm(p => ({ ...p, [f]: v })); clearInvalid(f); };
  const handleM = (f, v) => { setMentorForm(p => ({ ...p, [f]: v })); clearInvalid(f); };
  const handleS = (f, v) => { setSponsorForm(p => ({ ...p, [f]: v })); clearInvalid(f); };
  const toggleCollab = (type) => setSponsorForm(p => ({
    ...p,
    collab_types: p.collab_types.includes(type)
      ? p.collab_types.filter(x => x !== type)
      : [...p.collab_types, type],
  }));

  const selectType = (type) => {
    setJoinType(type);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('sh_join_type', type);
    setTimeout(() => {
      const el = document.getElementById('join-form-section');
      if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 100; window.scrollTo({ top: y, behavior: 'smooth' }); }
    }, 60);
  };

  const clearProject = () => {
    sessionStorage.removeItem('sh_join_role');
    sessionStorage.removeItem('sh_join_type');
    navigate('join');
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = (activeType) => {
    const missing = [];
    const check = (ok, field, label) => { if (!ok) missing.push([field, label]); };
    if (activeType === 'mentor') {
      check(mentorForm.name.trim(), 'name', lang === 'tr' ? 'Ad Soyad' : 'Full Name');
      check(mentorForm.email.trim(), 'email', lang === 'tr' ? 'E-posta' : 'Email');
    } else if (activeType === 'sponsor') {
      check(sponsorForm.contact_name.trim(), 'contact_name', lang === 'tr' ? 'İletişim Kişisi' : 'Contact Name');
      check(sponsorForm.email.trim(), 'email', lang === 'tr' ? 'E-posta' : 'Email');
    } else {
      check(communityForm.name.trim(), 'name', lang === 'tr' ? 'Ad Soyad' : 'Full Name');
      check(communityForm.email.trim(), 'email', lang === 'tr' ? 'E-posta' : 'Email');
      if (!project && communityForm.intent === 'idea_application') {
        check(communityForm.pitch.trim(), 'pitch', lang === 'tr' ? 'Fikrin' : 'Your idea');
      }
    }
    if (missing.length) {
      setInvalidFields(new Set(missing.map(([f]) => f)));
      return lang === 'tr'
        ? `Lütfen zorunlu alanları doldurun: ${missing.map(([, l]) => l).join(', ')}.`
        : `Please fill in the required fields: ${missing.map(([, l]) => l).join(', ')}.`;
    }
    const email = activeType === 'sponsor' ? sponsorForm.email : activeType === 'mentor' ? mentorForm.email : communityForm.email;
    if (!EMAIL_RE.test(email.trim())) {
      setInvalidFields(new Set(['email']));
      return lang === 'tr' ? 'Lütfen geçerli bir e-posta adresi girin.' : 'Please enter a valid email address.';
    }
    setInvalidFields(new Set());
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const activeType = project ? 'community' : joinType;
    const validationMsg = validate(activeType);
    if (validationMsg) { setSubmitError(validationMsg); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      let insertData = {};
      if (activeType === 'mentor') {
        insertData = {
          name: mentorForm.name, email: mentorForm.email,
          expertise: mentorForm.expertise || null,
          experience_years: mentorForm.experience_years || null,
          company: mentorForm.current_company || null,
          weekly_hours: mentorForm.hours_per_week || null,
          linkedin_url: mentorForm.linkedin || null,
          bio: mentorForm.mentor_note || null,
          intent: 'mentor_application',
        };
      } else if (activeType === 'sponsor') {
        insertData = {
          name: sponsorForm.contact_name, email: sponsorForm.email,
          company_name: sponsorForm.company || null,
          website: sponsorForm.website || null,
          collaboration_types: sponsorForm.collab_types.length ? sponsorForm.collab_types : null,
          sponsor_message: sponsorForm.sponsor_message || null,
          intent: 'sponsor_application',
        };
      } else {
        // Proje bağlamı: deep-link (project prop) > option 3'teki in-form proje
        // seçimi > option 4'teki liderlik için seçilen fikir-aşaması proje.
        const inFormProject = communityForm.intent === 'project' && communityForm.projectId
          ? startups.find(s => String(s.id) === String(communityForm.projectId)) : null;
        const ideaProject = communityForm.intent === 'founder_lead' && communityForm.ideaProjectId
          ? (ideaProjects || []).find(s => String(s.id) === String(communityForm.ideaProjectId)) : null;
        const pickedProject = project || inFormProject || ideaProject;
        insertData = {
          name: communityForm.name, email: communityForm.email,
          university: communityForm.university || null,
          department: communityForm.department || null,
          // Proje sayfasından belirli bir pozisyona tıklanarak gelindiyse
          // (savedRole), o daha spesifik bilgi genel kategori seçiminden
          // önceliklidir — tıklanan pozisyon adı artık kayboluyordu.
          role: savedRole || communityForm.role || null,
          intent: communityForm.intent || 'community',
          bio: communityForm.bio || null,
          skills: communityForm.skills || null,
          linkedin: communityForm.linkedin || null,
          portfolio: communityForm.portfolio || null,
          project_id: pickedProject?.id || null,
          project_name: pickedProject?.name || null,
          // v3.1 — option 4 (liderlik, fikir seçilmediyse serbest metin) ve
          // option 5 (yeni fikir) için:
          pitch: (communityForm.pitch || '').trim() || null,
          problem: (communityForm.problem || '').trim() || null,
          progress: (communityForm.progress || '').trim() || null,
        };
      }
      const { error } = await supabase.from('applications').insert(insertData);
      if (error) throw error;
      setSubmittedType(activeType);
      setSubmitted(true);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('sh_join_type');
    } catch (err) {
      console.error('Form gönderim hatası:', err);
      setSubmitError(lang === 'tr'
        ? 'Bir hata oluştu: ' + (err?.message || 'Lütfen tekrar dene.')
        : 'An error occurred: ' + (err?.message || 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const successCopy = {
      mentor: {
        title: lang === 'tr' ? 'Mentörlük başvurun alındı!' : 'Your mentor application is in!',
        desc: lang === 'tr' ? 'İlgin için teşekkürler. Başvurunu inceleyip uygun ekiplerle eşleştiğinde seninle e-posta üzerinden iletişime geçeceğiz.' : 'Thanks for your interest. We\'ll review your application and reach out by email once we find a good match.',
      },
      sponsor: {
        title: lang === 'tr' ? 'Destekçi başvurun alındı!' : 'Your sponsor application is in!',
        desc: lang === 'tr' ? 'İlginiz için teşekkür ederiz. Ekibimiz en kısa sürede sizinle iletişime geçip iş birliği detaylarını konuşacak.' : 'Thank you for your interest. Our team will reach out shortly to discuss collaboration details.',
      },
      community: {
        title: t('join.successTitle'),
        desc: t('join.successDesc'),
      },
    };
    const copy = successCopy[submittedType] || successCopy.community;
    return (
      <div className="page-transition">
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--nav-h)' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Icon name="check" size={40} style={{ color: 'var(--green)' }} />
            </div>
            <h2 className="text-h2" style={{ marginBottom: 12 }}>{copy.title}</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>{copy.desc}</p>
            <Button variant="primary" onClick={() => { navigate('home'); window.scrollTo({ top: 0 }); }}>{t('nav.home')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const projectContextCard = project ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: `color-mix(in srgb, ${project.color} 6%, var(--card-bg))`, border: `1.5px solid color-mix(in srgb, ${project.color} 22%, var(--border))`, borderRadius: 'var(--r-lg)', marginBottom: 28 }}>
      <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', flexShrink: 0, overflow: 'hidden', background: project.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>
        {project.logo ? <img src={project.logo} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : project.name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{project.name}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.03em', color: project.color, background: `color-mix(in srgb, ${project.color} 12%, transparent)`, padding: '2px 8px', borderRadius: 'var(--r-full)' }}>{lang === 'tr' ? 'Proje Başvurusu' : 'Project Application'}</span>
        </div>
        {savedRole && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="briefcase" size={13} /><span>{savedRole}</span>
          </div>
        )}
      </div>
      <button onClick={clearProject} title={lang === 'tr' ? 'Proje seçimini kaldır' : 'Remove project'} style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
        <Icon name="x" size={16} />
      </button>
    </div>
  ) : null;

  const roleDescCard = (project && savedRole) ? (() => {
    const liveRole = (project.openRolesLive || []).find(r => r.title === savedRole);
    const desc = liveRole?.profile || getRoleDescription(savedRole, lang);
    if (!desc) return null;
    return (
      <div style={{ padding: '18px 20px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-lg)', marginBottom: 28, borderLeft: `3px solid ${project.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="briefcase" size={15} style={{ color: project.color }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>{lang === 'tr' ? 'Görev Tanımı' : 'Role Description'}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--text-primary)' }}>{savedRole}</div>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{desc}</p>
      </div>
    );
  })() : null;

  const typeCards = [
    { key: 'community', emoji: '🚀',
      title: lang === 'tr' ? fs('community_card_title_tr', 'Topluluğa Katıl') : 'Join the Community',
      desc:  lang === 'tr' ? fs('community_card_desc_tr', 'Öğrenci, mezun ya da genç profesyonel olarak ekosisteme dahil ol.') : 'Join as a student, graduate, or young professional.' },
    { key: 'mentor', emoji: '🎓',
      title: lang === 'tr' ? fs('mentor_card_title_tr', 'Mentör Ol') : 'Become a Mentor',
      desc:  lang === 'tr' ? fs('mentor_card_desc_tr', 'Deneyimini paylaş, ekiplere ve girişimcilere rehberlik et.') : 'Share your expertise and guide teams and founders.' },
    { key: 'sponsor', emoji: '🤝',
      title: lang === 'tr' ? fs('sponsor_card_title_tr', 'Destekçi / Sponsor Ol') : 'Become a Supporter',
      desc:  lang === 'tr' ? fs('sponsor_card_desc_tr', 'Finansal, mentorluk ya da etkinlik desteğiyle katkı sağla.') : 'Support via funding, mentorship, or events.' },
  ];

  const collabOptions = lang === 'tr'
    ? ['Finansal Destek', 'Mentorluk', 'Etkinlik Sponsorluğu', 'Staj İmkanı', 'Diğer']
    : ['Financial Support', 'Mentorship', 'Event Sponsorship', 'Internship', 'Other'];

  const submitBtn = (
    <div style={{ paddingTop: 12 }}>
      <Button variant="primary" size="lg" iconRight="arrowRight" style={{ width: '100%', opacity: submitting ? 0.7 : 1, pointerEvents: submitting ? 'none' : undefined }}>
        {submitting ? (lang === 'tr' ? 'Gönderiliyor…' : 'Sending…') : t('join.submit')}
      </Button>
    </div>
  );

  const errorBanner = submitError ? (
    <div style={{ padding: '10px 14px', background: 'var(--red-light, #FEF2F2)', border: '1px solid #FECACA', borderRadius: 8, fontSize: 14, color: 'var(--red, #DC2626)', marginBottom: 12 }}>{submitError}</div>
  ) : null;

  return (
    <div className="page-transition">
      <PageHeader
        label={t('join.label')}
        title={project
          ? (lang === 'tr' ? `${project.name} Ekibine Katıl` : `Join ${project.name} Team`)
          : (lang === 'tr' ? fs('hero_title_tr', t('join.title')) : fs('hero_title_en', t('join.title')))}
        desc={project
          ? (lang === 'tr' ? `${project.name} projesine başvurunu bu form ile gönderebilirsin.` : `Submit your application to join the ${project.name} project.`)
          : (lang === 'tr' ? fs('hero_desc_tr', t('join.desc')) : fs('hero_desc_en', t('join.desc')))} />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: 680 }}>

          {/* 3-card type selector — only when not project context */}
          {!project && (
            <div className="join-type-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 36 }}>
              {typeCards.map((card, i) => {
                const active = joinType === card.key;
                return (
                  <div
                    key={card.key}
                    className={`join-type-card jt-card jt-card--${card.key}${active ? ' jt-card--on' : ''}`}
                    style={{ '--jt-c': JT_COLOR[card.key], '--i': i }}
                    role="button" tabIndex={0} aria-pressed={active}
                    onClick={() => selectType(card.key)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectType(card.key); } }}
                  >
                    {active && <CardFx type={card.key} />}
                    <div className="jt-body">
                      <div className="jt-emo"><span className="jt-glyph">{card.emoji}</span>{active && <EmojiFx type={card.key} />}</div>
                      <div className="jt-title">{card.title}</div>
                      <p className="jt-desc">{card.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {projectContextCard}
          {roleDescCard}

          {/* Forms — appear after type selection */}
          {(joinType || project) && (
            <div id="join-form-section">

              {/* COMMUNITY FORM */}
              {(joinType === 'community' || project) && (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('c_name', t('join.name'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input className={`form-input${invalidFields.has('name') ? ' form-input--invalid' : ''}`} value={communityForm.name} onChange={e => handleC('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('c_email', t('join.email'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input type="email" className={`form-input${invalidFields.has('email') ? ' form-input--invalid' : ''}`} value={communityForm.email} onChange={e => handleC('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('c_university', t('join.university'))}</label>
                      <input className="form-input" value={communityForm.university} onChange={e => handleC('university', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('c_department', t('join.department'))}</label>
                      <input className="form-input" value={communityForm.department} onChange={e => handleC('department', e.target.value)} />
                    </div>
                  </div>
                  {!project && (
                    <div className="form-group">
                      <label className="form-label">{t('join.intent')}</label>
                      <select className="form-input form-select" value={communityForm.intent} onChange={e => handleC('intent', e.target.value)}>
                        <option value="community">{lang === 'tr' ? 'Topluluğa Katılmak İstiyorum' : 'Join the community'}</option>
                        {Object.entries(t('join.intents')).filter(([k]) => !['mentor','sponsor'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  )}

                  {/* option 3 — devam eden bir projeye üye ol: proje + (varsa) pozisyon seçici */}
                  {!project && communityForm.intent === 'project' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">{t('join.projectPick')}</label>
                        <select className="form-input form-select" value={communityForm.projectId}
                          onChange={e => { handleC('projectId', e.target.value); handleC('role', ''); }}>
                          <option value="">{t('join.projectPickPlaceholder')}</option>
                          {startups.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      {communityForm.projectId && (() => {
                        const picked = startups.find(s => String(s.id) === String(communityForm.projectId));
                        const roles = picked?.openRolesLive || [];
                        return roles.length === 0 ? (
                          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: -8, marginBottom: 20 }}>{t('join.noOpenRoles')}</p>
                        ) : (
                          <div className="form-group">
                            <label className="form-label">{t('join.rolePick')}</label>
                            <select className="form-input form-select" value={communityForm.role} onChange={e => handleC('role', e.target.value)}>
                              <option value="">{t('join.rolePickAny')}</option>
                              {roles.map(r => <option key={r.title} value={r.title}>{r.title}</option>)}
                            </select>
                          </div>
                        );
                      })()}
                    </>
                  )}

                  {/* option 4 — fikir aşamasında liderlik/ortaklık */}
                  {!project && communityForm.intent === 'founder_lead' && (
                    <>
                      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 18 }}>{t('join.founderNote')}</p>
                      {ideaProjects && ideaProjects.length > 0 && (
                        <div className="form-group">
                          <label className="form-label">{t('join.ideaProjectPick')}</label>
                          <select className="form-input form-select" value={communityForm.ideaProjectId} onChange={e => handleC('ideaProjectId', e.target.value)}>
                            <option value="">{t('join.ideaProjectNone')}</option>
                            {ideaProjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      )}
                      {!communityForm.ideaProjectId && (
                        <div className="form-group">
                          <label className="form-label">{t('join.founderPitch')}</label>
                          <textarea className="form-input" placeholder={t('join.founderPitchPlaceholder')} value={communityForm.pitch} onChange={e => handleC('pitch', e.target.value)} />
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">{t('join.founderExperience')}</label>
                        <textarea className="form-input" placeholder={t('join.bioPlaceholder')} value={communityForm.bio} onChange={e => handleC('bio', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{fl('c_linkedin', t('join.linkedin'))}</label>
                        <input className="form-input" placeholder="linkedin.com/in/..." value={communityForm.linkedin} onChange={e => handleC('linkedin', e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* option 5 — yeni fikir: aday değerlendirmesi değil, proje teklifi — rol/proje sorulmaz */}
                  {!project && communityForm.intent === 'idea_application' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">{t('join.pitchLabel')} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                        <textarea className={`form-input${invalidFields.has('pitch') ? ' form-input--invalid' : ''}`} placeholder={t('join.pitchPlaceholder')} value={communityForm.pitch} onChange={e => handleC('pitch', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('join.problemLabel')}</label>
                        <textarea className="form-input" placeholder={t('join.problemPlaceholder')} value={communityForm.problem} onChange={e => handleC('problem', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('join.progressLabel')}</label>
                        <textarea className="form-input" placeholder={t('join.progressPlaceholder')} value={communityForm.progress} onChange={e => handleC('progress', e.target.value)} />
                      </div>
                    </>
                  )}

                  {/* option 1/2 (topluluk/bölüm) ve deep-link proje bağlamı — İlgi Alanı kategori dropdown'ı */}
                  {(project || ['community', 'hub'].includes(communityForm.intent)) && (
                    <div className="form-group">
                      <label className="form-label">{fl('c_role', t('join.role'))}</label>
                      <select className="form-input form-select" value={communityForm.role} onChange={e => handleC('role', e.target.value)}>
                        <option value="">—</option>
                        {Object.entries(t('join.roles')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Bio/Yetenekler/Linkler — option 4/5 dışındaki tüm dallarda (kendi alanlarını yukarıda gösterdiler) */}
                  {(project || ['community', 'hub', 'project'].includes(communityForm.intent)) && (
                    <>
                      <div className="form-group">
                        <label className="form-label">{fl('c_bio', t('join.bio'))}</label>
                        <textarea className="form-input" placeholder={t('join.bioPlaceholder')} value={communityForm.bio} onChange={e => handleC('bio', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{fl('c_skills', t('join.skills'))}</label>
                        <input className="form-input" placeholder={t('join.skillsPlaceholder')} value={communityForm.skills} onChange={e => handleC('skills', e.target.value)} />
                      </div>
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">{fl('c_linkedin', t('join.linkedin'))}</label>
                          <input className="form-input" placeholder="linkedin.com/in/..." value={communityForm.linkedin} onChange={e => handleC('linkedin', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{fl('c_portfolio', t('join.portfolio'))}</label>
                          <input className="form-input" placeholder="github.com/..." value={communityForm.portfolio} onChange={e => handleC('portfolio', e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}
                  {errorBanner}
                  {submitBtn}
                </form>
              )}

              {/* MENTOR FORM */}
              {joinType === 'mentor' && (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('m_name', t('join.name'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input className={`form-input${invalidFields.has('name') ? ' form-input--invalid' : ''}`} value={mentorForm.name} onChange={e => handleM('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('m_email', t('join.email'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input type="email" className={`form-input${invalidFields.has('email') ? ' form-input--invalid' : ''}`} value={mentorForm.email} onChange={e => handleM('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{fl('m_expertise', lang === 'tr' ? 'Uzmanlık Alanı' : 'Area of Expertise')}</label>
                    <input className="form-input" placeholder={lang === 'tr' ? 'ör. Fintech, Ürün Yönetimi, Pazarlama' : 'e.g. Fintech, Product Management, Marketing'} value={mentorForm.expertise} onChange={e => handleM('expertise', e.target.value)} />
                  </div>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('m_experience', lang === 'tr' ? 'Deneyim Yılı' : 'Years of Experience')}</label>
                      <select className="form-input form-select" value={mentorForm.experience_years} onChange={e => handleM('experience_years', e.target.value)}>
                        <option value="">—</option>
                        <option value="1-3">1–3 {lang === 'tr' ? 'yıl' : 'years'}</option>
                        <option value="3-5">3–5 {lang === 'tr' ? 'yıl' : 'years'}</option>
                        <option value="5-10">5–10 {lang === 'tr' ? 'yıl' : 'years'}</option>
                        <option value="10+">10+ {lang === 'tr' ? 'yıl' : 'years'}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('m_hours', lang === 'tr' ? 'Haftalık Uygun Saat' : 'Hours per Week')}</label>
                      <select className="form-input form-select" value={mentorForm.hours_per_week} onChange={e => handleM('hours_per_week', e.target.value)}>
                        <option value="">—</option>
                        <option value="1-2">1–2 {lang === 'tr' ? 'saat' : 'hours'}</option>
                        <option value="2-4">2–4 {lang === 'tr' ? 'saat' : 'hours'}</option>
                        <option value="4+">4+ {lang === 'tr' ? 'saat' : 'hours'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{fl('m_company', lang === 'tr' ? 'Mevcut Şirket / Kurum' : 'Current Company / Organization')}</label>
                    <input className="form-input" value={mentorForm.current_company} onChange={e => handleM('current_company', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{fl('m_linkedin', 'LinkedIn')}</label>
                    <input className="form-input" placeholder="linkedin.com/in/..." value={mentorForm.linkedin} onChange={e => handleM('linkedin', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{fl('m_note', lang === 'tr' ? 'Neden mentör olmak istiyorsunuz?' : 'Why do you want to mentor?')}</label>
                    <textarea className="form-input" maxLength={400} placeholder={lang === 'tr' ? 'Kısaca açıklayın…' : 'Briefly explain…'} value={mentorForm.mentor_note} onChange={e => handleM('mentor_note', e.target.value)} style={{ minHeight: 110 }} />
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>{mentorForm.mentor_note.length}/400</div>
                  </div>
                  {errorBanner}
                  {submitBtn}
                </form>
              )}

              {/* SPONSOR FORM */}
              {joinType === 'sponsor' && (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('s_contact', lang === 'tr' ? 'İletişim Kişisi' : 'Contact Name')} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input className={`form-input${invalidFields.has('contact_name') ? ' form-input--invalid' : ''}`} value={sponsorForm.contact_name} onChange={e => handleS('contact_name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('s_email', t('join.email'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input type="email" className={`form-input${invalidFields.has('email') ? ' form-input--invalid' : ''}`} value={sponsorForm.email} onChange={e => handleS('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('s_company', lang === 'tr' ? 'Şirket / Kurum Adı' : 'Company / Organization')}</label>
                      <input className="form-input" value={sponsorForm.company} onChange={e => handleS('company', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('s_website', lang === 'tr' ? 'Web Sitesi' : 'Website')}</label>
                      <input className="form-input" placeholder="https://..." value={sponsorForm.website} onChange={e => handleS('website', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ marginBottom: 10 }}>{fl('s_collab', lang === 'tr' ? 'İşbirliği Türü' : 'Collaboration Type')}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {collabOptions.map(opt => {
                        const checked = sponsorForm.collab_types.includes(opt);
                        return (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', padding: '7px 14px', borderRadius: 8, border: checked ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', background: checked ? 'color-mix(in srgb, var(--accent) 8%, var(--card-bg))' : 'var(--card-bg)', transition: 'all 0.15s', userSelect: 'none' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleCollab(opt)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{fl('s_message', lang === 'tr' ? 'Mesajınız (opsiyonel)' : 'Message (optional)')}</label>
                    <textarea className="form-input" maxLength={500} placeholder={lang === 'tr' ? 'Nasıl katkı sağlamak istediğinizi anlatın…' : "Tell us how you'd like to contribute…"} value={sponsorForm.sponsor_message} onChange={e => handleS('sponsor_message', e.target.value)} style={{ minHeight: 110 }} />
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>{sponsorForm.sponsor_message.length}/500</div>
                  </div>
                  {errorBanner}
                  {submitBtn}
                </form>
              )}

            </div>
          )}

          {/* Prompt to select a type when none selected */}
          {!joinType && !project && (
            <div style={{ textAlign: 'center', padding: '24px 0 48px', color: 'var(--text-tertiary)', fontSize: 15 }}>
              {lang === 'tr' ? '↑ Katılım türünü seç' : '↑ Choose how you want to join'}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

export { BlogPage, JoinPage, EventsTab };
