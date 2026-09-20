// other-pages.jsx — Yazılar (Blog). Katıl sayfası: join-flow.jsx (buradan yeniden dışa aktarılır).
import { useState as useStateOP } from 'react';
import { useLang, usePosts, useEvents } from './data';
import { Icon, PostCard } from './ui-components';
import { CTASection, PageHeader } from './layout';
import { JoinPage } from './join-flow';

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

export { BlogPage, JoinPage, EventsTab };
