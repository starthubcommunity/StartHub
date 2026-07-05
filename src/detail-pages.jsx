// detail-pages.jsx — Project detail & Post detail pages
import React, { useState } from 'react';
import { useLang, getProject, getPost, postsForProject, getPerson, people, startups, usePosts } from './data';
import { Icon, Button, Reveal, Avatar, PostCard, StageBadge, SectionHeader, TagChip, AuthorByline } from './ui-components';
import { CTASection } from './layout';

// Pozisyon bazlı kısa görev tanımları (rol adındaki anahtar kelimeye göre eşleşir)
const ROLE_DESCRIPTIONS = {
  tr: {
    'flutter': 'Cross-platform mobil uygulama geliştirme, UI implementasyonu ve API entegrasyonları.',
    'ui/ux': 'Kullanıcı araştırması, wireframe/prototip tasarımı ve tasarım sisteminin geliştirilmesi.',
    'tasarımcı': 'Ürün arayüzü tasarımı, görsel dil oluşturma ve kullanıcı deneyimi optimizasyonu.',
    'backend': 'Sunucu mimarisi, veritabanı tasarımı, API geliştirme ve performans optimizasyonu.',
    'frontend': 'Kullanıcı arayüzü geliştirme, responsive tasarım implementasyonu ve state yönetimi.',
    'full-stack': 'Hem frontend hem backend geliştirme, uçtan uca özellik implementasyonu.',
    'ml': 'Makine öğrenmesi modelleri geliştirme, veri pipeline\'ları ve model optimizasyonu.',
    'growth': 'Büyüme stratejisi, kullanıcı edinme kampanyaları ve metrik analizi.',
    'pazarlama': 'Büyüme stratejisi, kullanıcı edinme kampanyaları ve metrik analizi.',
    'mobil': 'Mobil uygulama geliştirme, platform-özel optimizasyon ve kullanıcı deneyimi.',
    'veri': 'Veri analizi, modelleme, görselleştirme ve veri tabanlı karar destek sistemleri.',
    'topluluk': 'Kullanıcı topluluğu yönetimi, etkinlik planlama ve geri bildirim döngüsü.',
    'sağlık': 'Sağlık alanında alan uzmanlığı, klinik süreç danışmanlığı ve uyumluluk denetimi.',
    'danışman': 'Alan uzmanlığı, strateji danışmanlığı ve sektörel rehberlik.',
  },
  en: {
    'flutter': 'Cross-platform mobile development, UI implementation and API integrations.',
    'ui/ux': 'User research, wireframing/prototyping and design system development.',
    'designer': 'Product interface design, visual language creation and UX optimization.',
    'backend': 'Server architecture, database design, API development and performance optimization.',
    'frontend': 'User interface development, responsive design implementation and state management.',
    'full-stack': 'End-to-end feature implementation across frontend and backend.',
    'ml': 'Machine learning model development, data pipelines and model optimization.',
    'growth': 'Growth strategy, user acquisition campaigns and metrics analysis.',
    'marketing': 'Growth strategy, user acquisition campaigns and metrics analysis.',
    'mobile': 'Mobile app development, platform-specific optimization and UX.',
    'data': 'Data analysis, modeling, visualization and data-driven decision support.',
    'community': 'User community management, event planning and feedback loops.',
    'health': 'Health domain expertise, clinical process consulting and compliance.',
    'advisor': 'Domain expertise, strategy consulting and industry guidance.',
  }
};

function getRoleDescription(roleName, lang) {
  const descriptions = ROLE_DESCRIPTIONS[lang] || ROLE_DESCRIPTIONS['tr'];
  const lower = (roleName || '').toLowerCase();
  for (const [key, desc] of Object.entries(descriptions)) {
    if (lower.includes(key)) return desc;
  }
  return lang === 'tr'
    ? 'Proje ekibine katılarak ürün geliştirme sürecinde aktif rol alma.'
    : 'Join the project team and take an active role in product development.';
}


// ============================================
// PROJECT DETAIL
// ============================================
function ProjectDetailPage({ projectId, navigate }) {
  const { lang, t, localized } = useLang();
  const p = getProject(projectId);
  if (!p) return null;

  const lead = getPerson(p.leadId);
  const mentor = getPerson(p.mentorId);
  const members = (p.memberIds || []).map(getPerson).filter(Boolean);
  const related = postsForProject(p.id);
  const openList = localized(p, 'openRolesList') || [];

  const TeamRow = ({ person, tag, kind }) => (
    <div className={`team-row team-row--${kind}`}>
      <Avatar person={person} size={52} />
      <div className="team-row__info">
        <div className="team-row__name">{person.name}</div>
        <div className="team-row__role">{localized(person, 'role')}</div>
      </div>
      {tag && (
        <span className={`team-row__tag team-row__tag--${kind}`}>
          {kind === 'lead' && <Icon name="star" size={12} />}
          {tag}
        </span>
      )}
      {person.linkedin && (
        <a className="team-row__li" href={person.linkedin} target="_blank" rel="noreferrer"><Icon name="linkedin" size={18} /></a>
      )}
    </div>
  );

  return (
    <div className="page-transition">
      {/* Hero */}
      <div className="pd-hero">
        <div className="container">
          <span className="pd-back" onClick={() => { navigate('labs'); window.scrollTo({ top: 0 }); }}>
            <Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /> {t('labs.backToLab')}
          </span>
          <div className="pd-head">
            <div className="pd-logo" style={{ background: p.color, overflow: 'hidden' }}>{p.logo ? <img src={p.logo} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}</div>
            <div className="pd-head__main">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 className="pd-title">{p.name}</h1>
                <StageBadge stage={p.stage} />
              </div>
              <div className="pd-tagline">{localized(p, 'tagline')}</div>
              <div className="pd-links">
                {p.website && <a className="pd-link" href={p.website} target="_blank" rel="noreferrer"><Icon name="globe" size={15} /> {t('labs.website')}</a>}
                {p.demo && <a className="pd-link" href={p.demo} target="_blank" rel="noreferrer"><Icon name="externalLink" size={15} /> {t('labs.demo')}</a>}
                {p.github && <a className="pd-link" href={p.github} target="_blank" rel="noreferrer"><Icon name="github" size={15} /> GitHub</a>}
              </div>
            </div>
            <div className="pd-actions">
              {p.openRoles > 0 ? (
                <Button variant="primary" iconRight="chevronDown" onClick={() => { const el = document.getElementById('open-positions'); if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 100; window.scrollTo({ top: y, behavior: 'smooth' }); } }}>
                  {t('labs.joinThis')}
                </Button>
              ) : (
                <button className="btn btn--disabled" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 'var(--r-full)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', cursor: 'not-allowed', border: 'none', opacity: 0.7 }}>
                  {lang === 'tr' ? 'Açık pozisyon yok' : 'No open positions'}
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 22 }}>
            {p.tags.map(tag => <span key={tag} className="badge badge--tag">{tag}</span>)}
          </div>
        </div>
      </div>

      {/* Genel Bakış + metrikler (yan panel) */}
      <section className="section" style={{ paddingTop: 44 }}>
        <div className="container">
          <div className="pd-overview">
            <Reveal className="pd-overview__main">
              <h3 className="pd-block-label">{t('labs.overview')}</h3>
              <p className="pd-lead text-pretty">{localized(p, 'about') || localized(p, 'desc')}</p>
            </Reveal>
            {p.metrics && p.metrics.length > 0 && (
              <Reveal className="pd-stats-card" delay={80}>
                <div className="pd-stats-card__title">{t('labs.metrics')}</div>
                {p.metrics.map((m, i) => (
                  <div className="pd-stat-row" key={i}>
                    <span className="pd-stat-row__l">{localized(m, 'label')}</span>
                    <span className="pd-stat-row__v">{m.value}</span>
                  </div>
                ))}
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container">
          <div className="pd-body">
            <Reveal className="pd-block">
              <h3>{t('labs.problem')}</h3>
              <p className="text-pretty">{localized(p, 'problem')}</p>
            </Reveal>
            <Reveal className="pd-block" delay={80}>
              <h3>{t('labs.solution')}</h3>
              <p className="text-pretty">{localized(p, 'solution')}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="section section--alt" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="container">
          <SectionHeader label={t('labs.team')} title={lang === 'tr' ? 'Bu projeyi inşa eden ekip' : 'The team building this project'} />
          <div className="grid grid-2" style={{ gap: 16 }}>
            <Reveal><TeamRow person={lead} tag={t('labs.teamLead')} kind="lead" /></Reveal>
            {mentor && <Reveal delay={60}><TeamRow person={mentor} tag={t('labs.mentor')} kind="mentor" /></Reveal>}
            {members.map((m, i) => (
              <Reveal key={m.id} delay={120 + i * 60}><TeamRow person={m} tag={t('labs.developers')} kind="dev" /></Reveal>
            ))}
          </div>

          {/* Open positions */}
          <div id="open-positions" style={{ marginTop: 40, scrollMarginTop: 100 }}>
            <SectionHeader label={t('labs.openPositions')} title={p.openRoles > 0
              ? (lang === 'tr' ? `${p.openRoles} açık pozisyon` : `${p.openRoles} open positions`)
              : t('labs.noOpenPositions')} style={{ marginBottom: 20 }} />
            {openList.length > 0 ? (
              <div className="grid grid-2" style={{ gap: 16 }}>
                {openList.map((r, i) => (
                  <div className="open-role" key={i} onClick={() => { sessionStorage.setItem('sh_join_role', r); navigate('join', p.id); window.scrollTo({ top: 0 }); }}>
                    <span className="open-role__icon" style={{ background: `color-mix(in srgb, ${p.color} 12%, var(--card-bg))`, color: p.color }}>
                      <Icon name="briefcase" size={20} />
                    </span>
                    <div className="open-role__info">
                      <div className="open-role__name">{r}</div>
                      <div className="open-role__sub">
                        <span className="open-role__status"><span className="open-role__dot"></span>{lang === 'tr' ? 'Açık pozisyon' : 'Open position'}</span>
                      </div>
                    </div>
                    <Button variant="primary" size="sm" iconRight="arrowRight" onClick={(e) => { e.stopPropagation(); sessionStorage.setItem('sh_join_role', r); navigate('join', p.id); window.scrollTo({ top: 0 }); }}>
                      {t('labs.applyTeam')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)' }}>{t('labs.noOpenPositions')}</p>
            )}
          </div>
        </div>
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <SectionHeader label={t('labs.relatedPosts')} title={lang === 'tr' ? 'Bu projeden günlükler ve görüşler' : 'Logs & opinions from this project'} />
            <div className="grid grid-3">
              {related.map((post, i) => (
                <Reveal key={post.id} delay={i * 70}>
                  <PostCard post={post} onClick={() => { navigate('post', post.id); window.scrollTo({ top: 0 }); }} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTASection navigate={navigate} />
    </div>
  );
}

// ============================================
// POST DETAIL (article)
// ============================================
function PostDetailPage({ postId, navigate }) {
  const { lang, t, localized } = useLang();
  const { posts } = usePosts();
  const [shareCopied, setShareCopied] = useState(false);
  const post = getPost(postId);
  if (!post) return null;
  const author = getPerson(post.authorId);
  const project = post.projectId ? getProject(post.projectId) : null;
  const body = localized(post, 'body') || [];
  const more = posts.filter(x => x.id !== post.id && (x.tag === post.tag || x.projectId === post.projectId)).slice(0, 3);
  const moreFinal = more.length ? more : posts.filter(x => x.id !== post.id).slice(0, 3);

  return (
    <div className="page-transition">
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <div className="container">
          <span className="pd-back" onClick={() => { navigate('blog'); window.scrollTo({ top: 0 }); }}>
            <Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} /> {t('post.backToList')}
          </span>
        </div>
      </div>

      <article className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <div className="article">
            {/* Başlık bloğu */}
            <header className="article__head">
              <TagChip tag={post.tag} />
              <h1 className="article__title text-pretty">{localized(post, 'title')}</h1>
              <div className="article__meta">
                <AuthorByline author={author} />
                <div className="article__date">
                  <span>{post.date}</span><span className="article__dot">·</span><span>{post.readTime} {t('sections.minRead')}</span>
                </div>
              </div>
            </header>

            {/* Tam genişlik kapak */}
            <figure className="article__cover" style={{ background: post.bg, overflow: 'hidden', position: 'relative' }}>
              {post.cover
                ? <img src={post.cover} alt={localized(post, 'title')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span className="post-card__cover-ph">{lang === 'tr' ? 'görsel / cover' : 'cover image'}</span>}
            </figure>

            {/* Giriş */}
            <p className="article__lead text-pretty">{localized(post, 'excerpt')}</p>

            {/* Gövde */}
            <div className="article__body">
              {body.map((para, i) => <p key={i} className="text-pretty">{para}</p>)}
            </div>

            {/* İlgili proje */}
            {project && (
              <div className="article__projlink" onClick={() => { navigate('project', project.id); window.scrollTo({ top: 0 }); }}>
                <div className="pd-logo" style={{ background: project.color, width: 46, height: 46, fontSize: 21, borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>{project.logo ? <img src={project.logo} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : project.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 2 }}>{t('post.relatedProject')}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>{project.name}</div>
                </div>
                <Icon name="arrowRight" size={20} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              </div>
            )}

            {/* Footer: paylaş + kaynakça */}
            <footer className="article__footer">
              <div className="article__share">
                <span className="article__share-l">{t('post.share')}</span>
                <button className="article__share-btn" title={shareCopied ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : (lang === 'tr' ? 'Linki Kopyala' : 'Copy Link')}
                  style={{ border: 'none', cursor: 'pointer', background: shareCopied ? 'var(--green-light)' : undefined, color: shareCopied ? 'var(--green)' : undefined }}
                  onClick={async () => {
                    const url = window.location.href;
                    const title = localized(post, 'title');
                    if (navigator.share) {
                      try { await navigator.share({ title, url }); } catch {}
                    } else {
                      try {
                        await navigator.clipboard.writeText(url);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      } catch {}
                    }
                  }}>
                  <Icon name={shareCopied ? 'check' : 'externalLink'} size={16} />
                </button>
                <button className="article__share-btn"
                  title="LinkedIn'de Paylaş"
                  onClick={() => {
                    const shareUrl = `https://starthub-community.com/post/${post.slug || post.id}`;
                    window.open(
                      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
                      '_blank', 'noopener,noreferrer,width=600,height=600'
                    );
                  }}>
                  <Icon name="linkedin" size={16} />
                </button>
                <button className="article__share-btn"
                  title="X (Twitter)'da Paylaş"
                  onClick={() => {
                    const shareUrl = `https://starthub-community.com/post/${post.slug || post.id}`;
                    const text = localized(post, 'title');
                    window.open(
                      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
                      '_blank', 'noopener,noreferrer,width=600,height=500'
                    );
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>
              </div>

              {post.tag === 'gundem' && post.source && (
                <div className="article__refs">
                  <div className="article__refs-title"><Icon name="globe" size={15} /> {t('post.references')}</div>
                  <div className="article__ref-item">
                    <span className="article__ref-num">1</span>
                    <span>{t('post.auto')} — <a href={post.source.url} target="_blank" rel="noreferrer">{post.source.name}</a></span>
                  </div>
                </div>
              )}
            </footer>
          </div>
        </div>
      </article>

      {/* More posts */}
      {moreFinal.length > 0 && (
        <section className="section section--alt">
          <div className="container">
            <SectionHeader label={t('post.morePosts')} title={lang === 'tr' ? 'Bunları da oku' : 'Keep reading'} />
            <div className="grid grid-3">
              {moreFinal.map((p, i) => (
                <Reveal key={p.id} delay={i * 70}>
                  <PostCard post={p} onClick={() => { navigate('post', p.id); window.scrollTo({ top: 0 }); }} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export { getRoleDescription, ProjectDetailPage, PostDetailPage };
