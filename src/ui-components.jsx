// ui-components.jsx — Icons, Buttons, Badges, Cards, Section Headers
import { useState as useStateUI, useEffect as useEffectUI, useRef as useRefUI } from 'react';
import { useLang, usePeople } from './data';

// ============================================
// SCROLL REVEAL (YC-style fade-up on scroll)
// ============================================
function Reveal({ children, delay = 0, className = '', style = {}, as = 'div' }) {
  const ref = useRefUI(null);
  const [visible, setVisible] = useStateUI(false);
  useEffectUI(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1, rootMargin: '0px 0px -48px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref} className={`reveal ${visible ? 'reveal--in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </Tag>
  );
}

// ============================================
// ANIMATED COUNTER
// ============================================
function AnimatedCounter({ value, suffix = '', duration = 1600 }) {
  const ref = useRefUI(null);
  const [display, setDisplay] = useStateUI(0);
  const started = useRefUI(false);
  useEffectUI(() => {
    started.current = false;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          if (cancelled) return;
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.max(0, Math.round(eased * value)));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelled = true; };
  }, [value, duration]);
  return <span ref={ref}>{display}{suffix}</span>;
}

// ============================================
// SCORE BAR (Startup momentum indicator)
// ============================================
function ScoreBar({ score, color }) {
  const { lang } = useLang();
  const ref = useRefUI(null);
  const [w, setW] = useStateUI(0);
  useEffectUI(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setW(score); obs.disconnect(); }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [score]);
  return (
    <div ref={ref} className="score-row" title={lang === 'tr' ? 'Aktivite skoru' : 'Activity score'}>
      <Icon name="zap" size={13} style={{ color, flexShrink: 0 }} />
      <div className="score-bar">
        <div className="score-bar__fill" style={{ width: `${w}%`, background: color }}></div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 26, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

// ============================================
// ICON COMPONENT
// ============================================
const iconSvgs = {
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  externalLink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  penEdit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  graduationCap: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 6.5 3 12 0v-5"/>',
  handshake: '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14h2"/><path d="m7 18 4 4H3"/><path d="m17 18 4 4h-8"/>',
};

function Icon({ name, size = 20, className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      dangerouslySetInnerHTML={{ __html: iconSvgs[name] || '' }} />
  );
}

// ============================================
// BUTTON
// ============================================
function Button({ children, variant = 'primary', size = 'md', icon, iconRight, onClick, style, className = '' }) {
  const sizeClass = size === 'sm' ? 'btn--sm' : size === 'lg' ? 'btn--lg' : '';
  return (
    <button className={`btn btn--${variant} ${sizeClass} ${className}`} onClick={onClick} style={style}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

// ============================================
// BADGE
// ============================================
const stageMap = {
  idea: { label_tr: 'Fikir', label_en: 'Idea', class: 'badge--idea' },
  mvp: { label_tr: 'MVP', label_en: 'MVP', class: 'badge--mvp' },
  building: { label_tr: 'Geliştirme', label_en: 'Building', class: 'badge--building' },
  launch: { label_tr: 'Lansman', label_en: 'Launch', class: 'badge--launch' },
  growth: { label_tr: 'Büyüme', label_en: 'Growth', class: 'badge--growth' },
};

function StageBadge({ stage }) {
  const { lang } = useLang();
  const s = stageMap[stage];
  if (!s) return null;
  return <span className={`badge badge--dot ${s.class}`}>{lang === 'tr' ? s.label_tr : s.label_en}</span>;
}

// ============================================
// SECTION HEADER
// ============================================
function SectionHeader({ label, title, desc, center, children, className = '' }) {
  return (
    <div className={`section-header ${center ? 'section-header--center' : ''} ${className}`}>
      {label && <div className="section-header__label">{label}</div>}
      <h2 className="section-header__title text-h2">{title}</h2>
      {desc && <p className="section-header__desc text-pretty">{desc}</p>}
      {children}
    </div>
  );
}

// ============================================
// STARTUP CARD
// ============================================
function StartupCard({ startup, onClick }) {
  const { t, localized } = useLang();
  return (
    <div className="card startup-card" onClick={onClick}>
      <div className="card__inner">
        <div className="startup-card__header">
          <div className="startup-card__logo" style={{ background: startup.color, overflow: 'hidden', padding: startup.logo ? 0 : undefined }}>
            {startup.logo ? <img src={startup.logo} alt={startup.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : startup.name[0]}
          </div>
          <div className="startup-card__info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="startup-card__name">{startup.name}</span>
              <StageBadge stage={startup.stage} />
            </div>
            <p className="startup-card__desc">{localized(startup, 'desc')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {startup.tags.map(tag => (
            <span key={tag} className="badge badge--tag">{tag}</span>
          ))}
        </div>
        <div className="startup-card__meta">
          <div className="startup-card__meta-item">
            <Icon name="users" size={14} />
            <span>{startup.team} {t('sections.teamSize')}</span>
          </div>
          {startup.openRoles > 0 && (
            <div className="startup-card__meta-item" style={{ color: 'var(--green)', marginLeft: 'auto' }}>
              <Icon name="briefcase" size={14} />
              <span>{startup.openRoles} {t('sections.openRoles')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// EVENT CARD
// ============================================
function EventCard({ event, onClick }) {
  const { lang, t, localized } = useLang();
  return (
    <div className="card event-card" onClick={onClick}>
      <div className="card__inner" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div className="event-card__date-badge">
          <span className="day">{event.day}</span>
          <span className="month">{lang === 'tr' ? event.month_tr : event.month_en}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="badge badge--tag">{localized(event, 'tag')}</span>
          </div>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {localized(event, 'title')}
          </h4>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
            {localized(event, 'desc')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-tertiary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="mapPin" size={13} /> {localized(event, 'location')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="clock" size={13} /> {event.time}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BLOG CARD
// ============================================
function BlogCard({ post, onClick }) {
  const { lang, t, localized } = useLang();
  const catLabels = { news: lang === 'tr' ? 'Haber' : 'News', stories: lang === 'tr' ? 'Hikaye' : 'Story', guides: lang === 'tr' ? 'Rehber' : 'Guide', tech: lang === 'tr' ? 'Teknoloji' : 'Tech' };
  return (
    <div className="card blog-card" onClick={onClick} style={{ padding: 0 }}>
      <div className="blog-card__image" style={{ background: post.bg, overflow: 'hidden', position: 'relative' }}>
        {post.cover
          ? <img src={post.cover} alt={localized(post, 'title')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 32, opacity: 0.3 }}>SH</span>}
      </div>
      <div className="blog-card__body">
        <div className="blog-card__tag">{catLabels[post.category] || post.category}</div>
        <h4 className="blog-card__title">{localized(post, 'title')}</h4>
        <p className="blog-card__excerpt">{localized(post, 'excerpt')}</p>
        <div className="blog-card__meta">
          <span>{post.date}</span>
          <span>·</span>
          <span>{post.readTime} {t('sections.minRead')}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PERSON CARD
// ============================================
function PersonCard({ person, roleField = 'role' }) {
  const { localized } = useLang();
  const goLinkedIn = () => { if (person.linkedin && person.linkedin !== '#') window.open(person.linkedin, '_blank', 'noopener,noreferrer'); };
  return (
    <div className="mentor-card" onClick={goLinkedIn} style={{ cursor: person.linkedin && person.linkedin !== '#' ? 'pointer' : 'default' }}>
      <span className="mentor-card__accent" style={{ background: person.color }}></span>
      <div className="mentor-card__top">
        <Avatar person={person} size={56} />
        <div className="mentor-card__id">
          <div className="mentor-card__name">{person.name}</div>
          <span className="mentor-card__role" style={{ color: person.color, background: person.color + '15' }}>
            {localized(person, roleField)}
          </span>
        </div>
      </div>
      {localized(person, 'bio') && <p className="mentor-card__bio">{localized(person, 'bio')}</p>}
      {person.linkedin && (
        <a href={person.linkedin} className="mentor-card__li" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
          <Icon name="linkedin" size={15} /> LinkedIn
        </a>
      )}
    </div>
  );
}

// ============================================
// AVATAR — gerçek foto varsa onu, yoksa renkli baş harf
// ============================================
function Avatar({ person, size = 40, className = '' }) {
  const initials = person.name.split(' ').map(n => n[0]).slice(0, 2).join('');
  if (person.photo) {
    return <img className={`avatar ${className}`} src={person.photo} alt={person.name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  return (
    <div className={`avatar ${className}`} style={{
      width: size, height: size, borderRadius: '50%', background: person.color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: size * 0.34, flexShrink: 0
    }}>{initials}</div>
  );
}

// ============================================
// TAG CHIP — Gündem / Günlük / Görüş
// ============================================
const tagMap = {
  blog: { key: 'tags.blog', class: 'chip--blog' },
  gundem: { key: 'tags.gundem', class: 'chip--gundem' },
  etkinlik: { key: 'tags.etkinlik', class: 'chip--etkinlik' },
};
function TagChip({ tag, size }) {
  const { t } = useLang();
  const m = tagMap[tag];
  if (!m) return null;
  return <span className={`chip ${m.class} ${size === 'sm' ? 'chip--sm' : ''}`}>{t(m.key)}</span>;
}

// ============================================
// AUTHOR BYLINE — foto + isim + rol (+ tarih)
// ============================================
function AuthorByline({ author, date, readTime, compact }) {
  const { t, localized } = useLang();
  if (!author && !date && !readTime) return null;
  const metaParts = [
    author ? localized(author, 'role') : null,
    date || null,
    readTime ? `${readTime} ${t('sections.minRead')}` : null,
  ].filter(Boolean);
  return (
    <div className={`byline ${compact ? 'byline--compact' : ''}`}>
      {author && <Avatar person={author} size={compact ? 30 : 38} />}
      <div className="byline__txt">
        {author && <div className="byline__name">{author.name}</div>}
        <div className="byline__sub">
          {metaParts.map((p, i) => (
            <span key={i}>{i > 0 && <span className="byline__dot">·</span>}{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// POST CARD — kapak + etiket + başlık + byline
// ============================================
function PostCard({ post, onClick, feature, pinned }) {
  const { t, lang, localized } = useLang();
  const { people } = usePeople();
  const author = people.find(p => p.id === post.authorId);
  return (
    <div className={`card post-card ${feature ? 'post-card--feature' : ''}`} onClick={onClick}>
      <div className="post-card__cover" style={{ background: post.bg, overflow: 'hidden', position: 'relative' }}>
        {post.cover
          ? <img src={post.cover} alt={localized(post, 'title')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span className="post-card__cover-ph">{lang === 'tr' ? 'görsel / cover' : 'cover image'}</span>}
        {pinned && (
          <span className="post-card__pin"><Icon name="star" size={12} /> Tavsiye Edilen</span>
        )}
        {post.tag === 'gundem' && post.source && (
          <span className="post-card__source"><Icon name="globe" size={12} /> {post.source.name}</span>
        )}
      </div>
      <div className="post-card__body">
        <TagChip tag={post.tag} />
        <h3 className="post-card__title">{localized(post, 'title')}</h3>
        <p className="post-card__excerpt">{localized(post, 'excerpt')}</p>
        <AuthorByline author={author} date={post.date} readTime={post.readTime} compact />
      </div>
    </div>
  );
}

// ============================================
// SPONSORS MARQUEE — kayan destekçi şeridi
// ============================================
function SponsorsMarquee({ items }) {
  const loop = [...items, ...items];
  const inner = (s) => (
    <>
      {s.logo
        ? <span className="marquee__logo"><img src={s.logo} alt={s.name} /></span>
        : <span className="marquee__icon" style={{ background: s.color + '18', color: s.color }}>
            {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </span>}
      <span>{s.name}</span>
    </>
  );
  return (
    <div className="marquee">
      <div className="marquee__track">
        {loop.map((s, i) => s.url
          ? <a className="marquee__item" key={i} href={s.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{inner(s)}</a>
          : <div className="marquee__item" key={i}>{inner(s)}</div>
        )}
      </div>
    </div>
  );
}

export {
  Icon, iconSvgs, Button, StageBadge, SectionHeader,
  StartupCard, EventCard, BlogCard, PersonCard, stageMap,
  Reveal, AnimatedCounter, ScoreBar,
  Avatar, TagChip, tagMap, AuthorByline, PostCard, SponsorsMarquee,
};
