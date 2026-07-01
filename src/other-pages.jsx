// other-pages.jsx — Yazılar (Blog) & Katıl (Join)
import { useState as useStateOP } from 'react';
import { useLang, getProject, usePosts, useEvents } from './data';
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
  const { lang, t, localized } = useLang();
  const [submitted, setSubmitted] = useStateOP(false);

  // Resolve project context (if navigated from a project page)
  const project = projectId ? getProject(projectId) : null;
  const savedRole = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sh_join_role') : null;

  const [formData, setFormData] = useStateOP({
    name: '', email: '', university: '', department: '', role: '', 
    intent: project ? 'project' : '', 
    bio: '', linkedin: '', portfolio: '', skills: ''
  });

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const handleSubmit = (e) => { e.preventDefault(); setSubmitted(true); };
  const clearProject = () => { 
    sessionStorage.removeItem('sh_join_role'); 
    navigate('join'); 
  };

  if (submitted) {
    return (
      <div className="page-transition">
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 'var(--nav-h)' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Icon name="check" size={40} style={{ color: 'var(--green)' }} />
            </div>
            <h2 className="text-h2" style={{ marginBottom: 12 }}>{t('join.successTitle')}</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 32 }}>{t('join.successDesc')}</p>
            <Button variant="primary" onClick={() => { navigate('home'); window.scrollTo({ top: 0 }); }}>{t('nav.home')}</Button>
          </div>
        </div>
      </div>
    );
  }

  /* --- Project context badge --- */
  const projectContextCard = project ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px',
      background: `color-mix(in srgb, ${project.color} 6%, var(--card-bg))`,
      border: `1.5px solid color-mix(in srgb, ${project.color} 22%, var(--border))`,
      borderRadius: 'var(--r-lg)',
      marginBottom: 28,
    }}>
      {/* Project logo */}
      <div style={{
        width: 42, height: 42, borderRadius: 'var(--r-md)', flexShrink: 0,
        background: project.color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17,
      }}>{project.name[0]}</div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
            {project.name}
          </span>
          <span style={{
            fontSize: 11.5, fontWeight: 600, letterSpacing: '0.03em',
            color: project.color,
            background: `color-mix(in srgb, ${project.color} 12%, transparent)`,
            padding: '2px 8px', borderRadius: 'var(--r-full)',
          }}>
            {lang === 'tr' ? 'Proje Başvurusu' : 'Project Application'}
          </span>
        </div>
        {savedRole && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="briefcase" size={13} />
            <span>{savedRole}</span>
          </div>
        )}
      </div>
      {/* Remove button */}
      <button onClick={clearProject} title={lang === 'tr' ? 'Proje seçimini kaldır' : 'Remove project'} style={{
        width: 30, height: 30, borderRadius: 'var(--r-sm)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-tertiary)', transition: 'all 0.2s',
      }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
         onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}>
        <Icon name="x" size={16} />
      </button>
    </div>
  ) : null;

  /* --- Role description card (görev tanımı) --- */
  const roleDescCard = (project && savedRole) ? (() => {
    const desc = getRoleDescription(savedRole, lang);
    if (!desc) return null;
    return (
      <div style={{
        padding: '18px 20px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--r-lg)',
        marginBottom: 28,
        borderLeft: `3px solid ${project.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="briefcase" size={15} style={{ color: project.color }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
            {lang === 'tr' ? 'Görev Tanımı' : 'Role Description'}
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, marginBottom: 6, color: 'var(--text-primary)' }}>
          {savedRole}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{desc}</p>
      </div>
    );
  })() : null;

  return (
    <div className="page-transition">
      <PageHeader label={t('join.label')} title={project 
        ? (lang === 'tr' ? `${project.name} Ekibine Katıl` : `Join ${project.name} Team`) 
        : t('join.title')} 
        desc={project
          ? (lang === 'tr' 
              ? `${project.name} projesine başvurunu bu form ile gönderebilirsin.`
              : `Submit your application to join the ${project.name} project through this form.`)
          : t('join.desc')} />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container" style={{ maxWidth: 640 }}>
          {projectContextCard}
          {roleDescCard}
          <form onSubmit={handleSubmit}>
            {!project && (
              <div className="form-group">
                <label className="form-label">{t('join.intent')}</label>
                <select className="form-input form-select" value={formData.intent} onChange={e => handleChange('intent', e.target.value)}>
                  <option value="">—</option>
                  {Object.entries(t('join.intents')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">{t('join.name')}</label>
                <input className="form-input" required value={formData.name} onChange={e => handleChange('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('join.email')}</label>
                <input type="email" className="form-input" required value={formData.email} onChange={e => handleChange('email', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">{t('join.university')}</label>
                <input className="form-input" value={formData.university} onChange={e => handleChange('university', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('join.department')}</label>
                <input className="form-input" value={formData.department} onChange={e => handleChange('department', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('join.role')}</label>
              <select className="form-input form-select" value={formData.role} onChange={e => handleChange('role', e.target.value)}>
                <option value="">—</option>
                {Object.entries(t('join.roles')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('join.bio')}</label>
              <textarea className="form-input" placeholder={t('join.bioPlaceholder')} value={formData.bio} onChange={e => handleChange('bio', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('join.skills')}</label>
              <input className="form-input" placeholder={t('join.skillsPlaceholder')} value={formData.skills} onChange={e => handleChange('skills', e.target.value)} />
            </div>
            <div className="grid grid-2">
              <div className="form-group">
                <label className="form-label">{t('join.linkedin')}</label>
                <input className="form-input" placeholder="linkedin.com/in/..." value={formData.linkedin} onChange={e => handleChange('linkedin', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('join.portfolio')}</label>
                <input className="form-input" placeholder="github.com/..." value={formData.portfolio} onChange={e => handleChange('portfolio', e.target.value)} />
              </div>
            </div>
            <div style={{ paddingTop: 12 }}>
              <Button variant="primary" size="lg" iconRight="arrowRight" style={{ width: '100%' }}>{t('join.submit')}</Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export { BlogPage, JoinPage, EventsTab };
