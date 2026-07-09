// other-pages.jsx — Yazılar (Blog) & Katıl (Join)
import { useState as useStateOP, useEffect as useEffectOP } from 'react';
import { useLang, getProject, usePosts, useEvents } from './data';
import { supabase } from './lib/supabase';
import { Icon, Button, PostCard, EventCard, Reveal, TagChip } from './ui-components';
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
          {/* Üç etiketin ne olduğunu anlatan tıklanabilir kartlar */}
          <div className="tag-intro">
            {['blog', 'gundem', 'etkinlik'].map(k => (
              <div className={`tag-intro__item ${active === k ? 'tag-intro__item--active' : ''}`} key={k}
                onClick={() => setActive(active === k ? 'all' : k)}
                style={{ cursor: 'pointer' }}>
                <h4><TagChip tag={k} /></h4>
                <p>{t(`tags.${k}Desc`)}</p>
              </div>
            ))}
          </div>

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
function JoinPage({ navigate, projectId }) {
  const { lang, t } = useLang();
  const [submitted, setSubmitted] = useStateOP(false);
  const [submittedType, setSubmittedType] = useStateOP('community');
  const [submitting, setSubmitting] = useStateOP(false);
  const [submitError, setSubmitError] = useStateOP('');

  // Panelden düzenlenebilir katılım formu metinleri — yüklenene kadar / boşsa
  // sabit çeviriler (t()) kullanılır, hiçbir zaman boş görünmez.
  const [formSettings, setFormSettings] = useStateOP(null);
  useEffectOP(() => {
    supabase.from('join_form_settings').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setFormSettings(data); })
      .catch(() => {});
  }, []);
  const fs = (key, fallback) => (formSettings && formSettings[key]) || fallback;

  const project = projectId ? getProject(projectId) : null;
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
  });
  const [mentorForm, setMentorForm] = useStateOP({
    name: '', email: '', expertise: '', experience_years: '',
    current_company: '', hours_per_week: '', linkedin: '', mentor_note: '',
  });
  const [sponsorForm, setSponsorForm] = useStateOP({
    contact_name: '', email: '', company: '', website: '',
    collab_types: [], sponsor_message: '',
  });

  const handleC = (f, v) => setCommunityForm(p => ({ ...p, [f]: v }));
  const handleM = (f, v) => setMentorForm(p => ({ ...p, [f]: v }));
  const handleS = (f, v) => setSponsorForm(p => ({ ...p, [f]: v }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const activeType = project ? 'community' : joinType;
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
        insertData = {
          name: communityForm.name, email: communityForm.email,
          university: communityForm.university || null,
          department: communityForm.department || null,
          role: communityForm.role || null,
          intent: communityForm.intent || 'community',
          bio: communityForm.bio || null,
          skills: communityForm.skills || null,
          linkedin: communityForm.linkedin || null,
          portfolio: communityForm.portfolio || null,
          project_id: project?.id || null,
          project_name: project?.name || null,
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
      <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', flexShrink: 0, background: project.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17 }}>{project.name[0]}</div>
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
    const desc = getRoleDescription(savedRole, lang);
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 36 }}>
              {typeCards.map(card => {
                const active = joinType === card.key;
                return (
                  <div
                    key={card.key}
                    onClick={() => selectType(card.key)}
                    style={{
                      padding: '22px 18px', borderRadius: 16, cursor: 'pointer',
                      border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                      background: active ? 'color-mix(in srgb, var(--accent) 5%, var(--card-bg))' : 'var(--card-bg)',
                      boxShadow: active ? '0 4px 20px rgba(220,38,38,0.12)' : 'none',
                      transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(220,38,38,0.08)'; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; } }}
                  >
                    <div style={{ fontSize: 30, marginBottom: 10 }}>{card.emoji}</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, marginBottom: 6, color: active ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1.3 }}>{card.title}</div>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{card.desc}</p>
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
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{t('join.name')}</label>
                      <input className="form-input" required value={communityForm.name} onChange={e => handleC('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('join.email')}</label>
                      <input type="email" className="form-input" required value={communityForm.email} onChange={e => handleC('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{t('join.university')}</label>
                      <input className="form-input" value={communityForm.university} onChange={e => handleC('university', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('join.department')}</label>
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
                  <div className="form-group">
                    <label className="form-label">{t('join.role')}</label>
                    <select className="form-input form-select" value={communityForm.role} onChange={e => handleC('role', e.target.value)}>
                      <option value="">—</option>
                      {Object.entries(t('join.roles')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('join.bio')}</label>
                    <textarea className="form-input" placeholder={t('join.bioPlaceholder')} value={communityForm.bio} onChange={e => handleC('bio', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('join.skills')}</label>
                    <input className="form-input" placeholder={t('join.skillsPlaceholder')} value={communityForm.skills} onChange={e => handleC('skills', e.target.value)} />
                  </div>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{t('join.linkedin')}</label>
                      <input className="form-input" placeholder="linkedin.com/in/..." value={communityForm.linkedin} onChange={e => handleC('linkedin', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('join.portfolio')}</label>
                      <input className="form-input" placeholder="github.com/..." value={communityForm.portfolio} onChange={e => handleC('portfolio', e.target.value)} />
                    </div>
                  </div>
                  {errorBanner}
                  {submitBtn}
                </form>
              )}

              {/* MENTOR FORM */}
              {joinType === 'mentor' && (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{t('join.name')}</label>
                      <input className="form-input" required value={mentorForm.name} onChange={e => handleM('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('join.email')}</label>
                      <input type="email" className="form-input" required value={mentorForm.email} onChange={e => handleM('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'tr' ? 'Uzmanlık Alanı' : 'Area of Expertise'}</label>
                    <input className="form-input" placeholder={lang === 'tr' ? 'ör. Fintech, Ürün Yönetimi, Pazarlama' : 'e.g. Fintech, Product Management, Marketing'} value={mentorForm.expertise} onChange={e => handleM('expertise', e.target.value)} />
                  </div>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{lang === 'tr' ? 'Deneyim Yılı' : 'Years of Experience'}</label>
                      <select className="form-input form-select" value={mentorForm.experience_years} onChange={e => handleM('experience_years', e.target.value)}>
                        <option value="">—</option>
                        <option value="1-3">1–3 {lang === 'tr' ? 'yıl' : 'years'}</option>
                        <option value="3-5">3–5 {lang === 'tr' ? 'yıl' : 'years'}</option>
                        <option value="5-10">5–10 {lang === 'tr' ? 'yıl' : 'years'}</option>
                        <option value="10+">10+ {lang === 'tr' ? 'yıl' : 'years'}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{lang === 'tr' ? 'Haftalık Uygun Saat' : 'Hours per Week'}</label>
                      <select className="form-input form-select" value={mentorForm.hours_per_week} onChange={e => handleM('hours_per_week', e.target.value)}>
                        <option value="">—</option>
                        <option value="1-2">1–2 {lang === 'tr' ? 'saat' : 'hours'}</option>
                        <option value="2-4">2–4 {lang === 'tr' ? 'saat' : 'hours'}</option>
                        <option value="4+">4+ {lang === 'tr' ? 'saat' : 'hours'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'tr' ? 'Mevcut Şirket / Kurum' : 'Current Company / Organization'}</label>
                    <input className="form-input" value={mentorForm.current_company} onChange={e => handleM('current_company', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">LinkedIn</label>
                    <input className="form-input" placeholder="linkedin.com/in/..." value={mentorForm.linkedin} onChange={e => handleM('linkedin', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'tr' ? 'Neden mentör olmak istiyorsunuz?' : 'Why do you want to mentor?'}</label>
                    <textarea className="form-input" maxLength={400} placeholder={lang === 'tr' ? 'Kısaca açıklayın…' : 'Briefly explain…'} value={mentorForm.mentor_note} onChange={e => handleM('mentor_note', e.target.value)} style={{ minHeight: 110 }} />
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 4 }}>{mentorForm.mentor_note.length}/400</div>
                  </div>
                  {errorBanner}
                  {submitBtn}
                </form>
              )}

              {/* SPONSOR FORM */}
              {joinType === 'sponsor' && (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{lang === 'tr' ? 'İletişim Kişisi' : 'Contact Name'}</label>
                      <input className="form-input" required value={sponsorForm.contact_name} onChange={e => handleS('contact_name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('join.email')}</label>
                      <input type="email" className="form-input" required value={sponsorForm.email} onChange={e => handleS('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{lang === 'tr' ? 'Şirket / Kurum Adı' : 'Company / Organization'}</label>
                      <input className="form-input" value={sponsorForm.company} onChange={e => handleS('company', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{lang === 'tr' ? 'Web Sitesi' : 'Website'}</label>
                      <input className="form-input" placeholder="https://..." value={sponsorForm.website} onChange={e => handleS('website', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ marginBottom: 10 }}>{lang === 'tr' ? 'İşbirliği Türü' : 'Collaboration Type'}</label>
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
                    <label className="form-label">{lang === 'tr' ? 'Mesajınız (opsiyonel)' : 'Message (optional)'}</label>
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
