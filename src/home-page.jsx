// home-page.jsx — Homepage: Hero → Yazılar → Lab → Nasıl Çalışır → Sponsorlar
import React from 'react';
import { useLang, resolveStat, siteStats, usePosts, useStartups, useSponsors, usePeople } from './data';
import { Reveal, AnimatedCounter, Icon, Button, SectionHeader, PostCard, StartupCard, EventCard, StageBadge, stageMap, SponsorsMarquee, TagChip } from './ui-components';
import { CTASection } from './layout';

// Kayıtlı startup.team alanı yalnızca proje formundan "Kaydet" yapılınca
// güncellenir; panelden proje üyesi eklendiğinde/çıkarıldığında bu alan hemen
// güncellenmez. Bu yüzden lider + üyeler + proje üyelerinden canlı hesaplanır.
function liveTeamCount(project, people) {
  return new Set([
    ...(project.leadId ? [project.leadId] : []),
    ...(project.memberIds || []),
    ...people.filter(p => p.type === 'project_member' && p.projectId === project.id).map(p => p.id),
  ]).size || project.team;
}

function HomePage({ navigate }) {
  return (
    <div className="page-transition">
      <HeroSection navigate={navigate} />
      <LatestPosts navigate={navigate} />
      <LabProjects navigate={navigate} />
      <JourneySection />
      <SponsorsSection navigate={navigate} />
      <CTASection navigate={navigate} />
    </div>
  );
}

// ============================================
// HERO
// ============================================
function HeroSection({ navigate }) {
  const { lang, t } = useLang();
  return (
    <section className="hero">
      <div className="container">
        <div className="hero__grid">
          <div className="hero__content">
            <h1 className="hero__title text-display fade-up">
              {t('hero.title1')}<br />
              <span className="accent">{t('hero.title2')}</span>
            </h1>
            <p className="hero__desc text-pretty fade-up" style={{ animationDelay: '0.06s' }}>{t('hero.desc')}</p>
            <div className="hero__ctas fade-up" style={{ animationDelay: '0.12s' }}>
              <Button variant="primary" size="lg" iconRight="arrowRight"
                onClick={() => { navigate('join'); window.scrollTo({ top: 0 }); }}>
                {t('hero.cta1')}
              </Button>
              <Button variant="secondary" size="lg" iconRight="arrowUpRight"
                onClick={() => { navigate('labs'); window.scrollTo({ top: 0 }); }}>
                {t('hero.cta2')}
              </Button>
            </div>
            <div className="hero__stats fade-up" style={{ animationDelay: '0.18s' }}>
              <div className="hero__stat">
                <span className="hero__stat-icon" style={{ background: 'var(--red-light)', color: 'var(--red)' }}><Icon name="users" size={24} /></span>
                <div>
                  <div className="hero__stat-value"><AnimatedCounter value={resolveStat('members')} suffix={siteStats.members.suffix} /></div>
                  <div className="hero__stat-label">{t('hero.stat1')}</div>
                </div>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-icon" style={{ background: 'color-mix(in srgb, #7C3AED 12%, var(--card-bg))', color: '#7C3AED' }}><Icon name="rocket" size={24} /></span>
                <div>
                  <div className="hero__stat-value"><AnimatedCounter value={resolveStat('projects')} suffix={siteStats.projects.suffix} /></div>
                  <div className="hero__stat-label">{t('hero.stat2')}</div>
                </div>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><Icon name="penEdit" size={24} /></span>
                <div>
                  <div className="hero__stat-value"><AnimatedCounter value={resolveStat('posts')} suffix={siteStats.posts.suffix} /></div>
                  <div className="hero__stat-label">{t('hero.stat3')}</div>
                </div>
              </div>
              <div className="hero__stat">
                <span className="hero__stat-icon" style={{ background: 'var(--orange-light)', color: 'var(--orange)' }}><Icon name="star" size={24} /></span>
                <div>
                  <div className="hero__stat-value"><AnimatedCounter value={resolveStat('sponsors')} suffix={siteStats.sponsors.suffix} /></div>
                  <div className="hero__stat-label">{t('hero.stat4')}</div>
                </div>
              </div>
            </div>
          </div>

          <HeroVisual lang={lang} navigate={navigate} />
        </div>
      </div>
    </section>
  );
}

// Hero visual — living ecosystem: organic scattered cards, flow lines, decorations
function HeroVisual({ lang, navigate }) {
  const { t, localized } = useLang();
  const { posts, postsLoading } = usePosts();
  const { startups, contentLoading } = useStartups();
  const { people } = usePeople();
  const featured = startups.find(s => s.featured) || startups[0] || null;
  const latest = [...posts].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || null;

  const rolePairs = startups.flatMap(s => {
    const roles = s.openRolesLive || [];
    return roles.map(r => ({ project: s, role: r.title }));
  });
  const [rotIdx, setRotIdx] = React.useState(0);
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    if (rolePairs.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setRotIdx(i => (i + 1) % rolePairs.length); setVisible(true); }, 450);
    }, 210000);
    return () => clearInterval(id);
  }, [rolePairs.length]);
  const rotating = rolePairs.length ? rolePairs[rotIdx % rolePairs.length] : null;

  return (
    <div className="hero__visual">
      {/* Header */}
      <div className="hero__vhead">
        <span className="hero__live">
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" style={{ opacity: 0.35 }}><path d="M2 7h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" /><path d="M12 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="hero__live-dot"></span>
          {lang === 'tr' ? 'CANLI EKOSİSTEM' : 'LIVE ECOSYSTEM'}
        </span>
        <span className="hero__vhead-meta">{lang === 'tr' ? 'Bugün' : 'Today'}</span>
      </div>

      {/* Cards container — two independent flow columns, never overlap regardless of content height */}
      <div className="hero__cards">

        {/* Subtle live activity dot near growth card */}
        <div className="hero__activity-dot"></div>

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="hero__cards-col hero__cards-col--left">

          {/* ═══ 1. FEATURED CARD ═══ */}
          {featured ? (
            <div className="hero__sc hero__sc--feat" onClick={() => { navigate('project', featured.id); window.scrollTo({ top: 0 }); }}>
              <span className="hero__feat-badge">{lang === 'tr' ? 'Öne Çıkan' : 'Featured'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div className="hero__feat-logo" style={{ background: featured.color }}>
                  {featured.logo ? <img src={featured.logo} alt={featured.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : featured.name[0]}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>{featured.name}</div>
                  <StageBadge stage={featured.stage} />
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{localized(featured, 'tagline') || localized(featured, 'desc')}</p>
              <div className="hero__feat-foot">
                <span><Icon name="users" size={14} /> {liveTeamCount(featured, people)} {lang === 'tr' ? 'kişi' : 'people'}</span>
                {(featured.openRolesLive || []).length > 0 && <span><Icon name="briefcase" size={14} /> {featured.openRolesLive.length} {lang === 'tr' ? 'açık görev' : 'open'}</span>}
                <span style={{ marginLeft: 'auto' }}><span className="hero__sc-arrow"><Icon name="arrowRight" size={14} /></span></span>
              </div>
            </div>
          ) : !contentLoading && (
            <div className="hero__sc hero__sc--feat" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              {lang === 'tr' ? 'Henüz proje yok' : 'No projects yet'}
            </div>
          )}

          {/* ═══ 3. POST/NEWS CARD ═══ */}
          {latest ? (
            <div className="hero__sc hero__sc--post" onClick={() => { navigate('post', latest.id); window.scrollTo({ top: 0 }); }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div className="hero__post-cover" style={{ background: '#DBEAFE' }}>
                  <Icon name="globe" size={18} style={{ color: '#3B82F6' }} />
                </div>
                <TagChip tag={latest.tag} />
              </div>
              <div className="hero__post-title">{localized(latest, 'title')}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <span className="hero__sc-arrow"><Icon name="arrowRight" size={12} /></span>
              </div>
            </div>
          ) : !postsLoading && (
            <div className="hero__sc hero__sc--post" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              {lang === 'tr' ? 'Henüz yazı yok' : 'No posts yet'}
            </div>
          )}
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="hero__cards-col hero__cards-col--right">

          {/* ═══ 2. STATS CARD ═══ */}
          <div className="hero__sc hero__sc--stats">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none"><path d="M2 20L12 10L18 16L30 4" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M22 4H30V12" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div className="hero__strip-v">+22%</div>
            </div>
            <div className="hero__strip-l" style={{ marginTop: 2 }}>{lang === 'tr' ? 'aylık büyüme' : 'MoM growth'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <div className="hero__avatars">
                {['#DC2626', '#2563EB', '#7C3AED'].map((c, i) => (
                  <span key={i} className="hero__av" style={{ background: c, marginLeft: i ? -10 : 0 }}>{['A', 'M', 'Z'][i]}</span>
                ))}
                <span className="hero__av hero__av--more">+3</span>
              </div>
              <div className="hero__strip-l">{lang === 'tr' ? 'yeni üye' : 'new members'}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span className="hero__sc-arrow" style={{ width: 26, height: 26, transform: 'rotate(-45deg)' }}><Icon name="arrowRight" size={10} /></span>
            </div>
          </div>

          {/* ═══ 4. OPEN POSITION CARD ═══ */}
          {rotating && (
            <div className="hero__sc hero__sc--open" onClick={() => { sessionStorage.setItem('sh_join_role', rotating.role); navigate('join', rotating.project.id); window.scrollTo({ top: 0 }); }}>
              <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.45s ease, transform 0.45s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className="hero__open-icon"><Icon name="briefcase" size={16} /></span>
                  <div>
                    <div className="hero__open-role">{rotating.role}</div>
                    <div className="hero__open-meta">
                      <span className="hero__open-dot" style={{ background: rotating.project.color }}></span>
                      {rotating.project.name} · <span style={{ color: 'var(--green)', fontWeight: 700 }}>{lang === 'tr' ? 'açık pozisyon' : 'open role'}</span>
                    </div>
                  </div>
                </div>
                <div className="hero__open-foot">
                  <div className="hero__avatars">
                    {(rotating.project.teamMembers || []).slice(0, 4).map((m, i) => (
                      <span key={i} className="hero__av" style={{ background: m.color || rotating.project.color, marginLeft: i ? -10 : 0 }}>{m.avatar || m.name?.[0] || '?'}</span>
                    ))}
                    {liveTeamCount(rotating.project, people) > 4 && <span className="hero__av hero__av--more">+{liveTeamCount(rotating.project, people) - 4}</span>}
                  </div>
                  <span style={{ marginLeft: 'auto' }}><span className="hero__sc-arrow"><Icon name="arrowRight" size={14} /></span></span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ 5. MOTTO CARD ═══ */}
          <div className="hero__motto">
            <div className="hero__motto-text">
              {lang === 'tr'
                ? 'Fikirlerinizi projelere, projelerinizi etkiye dönüştürüyoruz.'
                : 'Turning ideas into projects, projects into impact.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// YAZILAR — feature post + grid
// ============================================
function LatestPosts({ navigate }) {
  const { t } = useLang();
  const { posts, postsLoading } = usePosts();
  if (postsLoading || posts.length === 0) return null;
  const sorted = [...posts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // Ana sayfada sabitlenen (homePinned) yazı en büyük kartta; yoksa en yeni
  const pinned = sorted.find(p => p.homePinned);
  const feature = pinned || sorted[0];
  const rest = sorted.filter(p => p.id !== feature.id);
  const goPost = (id) => { navigate('post', id); window.scrollTo({ top: 0 }); };

  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <div className="section-head-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, gap: 24, flexWrap: 'wrap' }}>
            <SectionHeader label={t('sections.latestContent')} title={t('sections.latestContentDesc')} style={{ marginBottom: 0 }} />
            <Button variant="ghost" size="sm" iconRight="arrowRight"
              onClick={() => { navigate('blog'); window.scrollTo({ top: 0 }); }} style={{ flexShrink: 0 }}>
              {t('sections.viewAll')}
            </Button>
          </div>
        </Reveal>

        <Reveal style={{ marginBottom: 24 }}>
          <PostCard post={feature} feature pinned={!!pinned} onClick={() => goPost(feature.id)} />
        </Reveal>

        <div className="grid grid-3">
          {rest.slice(0, 3).map((post, i) => (
            <Reveal key={post.id} delay={i * 70}>
              <PostCard post={post} onClick={() => goPost(post.id)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// LAB PROJELERİ
// ============================================
function LabProjects({ navigate }) {
  const { t, localized } = useLang();
  const { startups } = useStartups();
  const { people } = usePeople();
  // Bu bölüm artık featured/trending şartı aramadan tüm projeleri gösterir
  // (en fazla 3) — öne çıkan proje varsa, ilk sıraya sabitlenir.
  const featuredProject = startups.find(s => s.featured);
  const rest = startups.filter(s => s.id !== featuredProject?.id);
  const shown = [...(featuredProject ? [featuredProject] : []), ...rest].slice(0, 3);
  const goProject = (id) => { navigate('project', id); window.scrollTo({ top: 0 }); };

  return (
    <section className="section section--alt">
      <div className="container">
        <Reveal>
          <div className="section-head-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, gap: 24, flexWrap: 'wrap' }}>
            <SectionHeader label={t('sections.labProjects')} title={t('sections.labProjectsDesc')} style={{ marginBottom: 0 }} />
            <Button variant="ghost" size="sm" iconRight="arrowRight"
              onClick={() => { navigate('labs'); window.scrollTo({ top: 0 }); }} style={{ flexShrink: 0 }}>
              {t('sections.viewAll')}
            </Button>
          </div>
        </Reveal>
        <div className="grid grid-3">
          {shown.map((s, idx) => (
            <Reveal key={s.id} delay={idx * 80}>
              <div className="card" style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => goProject(s.id)}>
                <div style={{ padding: '28px 24px 24px', background: `linear-gradient(135deg, ${s.color}0F 0%, ${s.color}04 100%)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 'var(--r-lg)', background: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'white'
                    }}>{s.logo ? <img src={s.logo} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.name[0]}</div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>{s.name}</div>
                      <StageBadge stage={s.stage} />
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{localized(s, 'desc')}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {s.tags.map(tag => <span key={tag} className="badge badge--tag">{tag}</span>)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: 'var(--text-tertiary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="users" size={14} /> {liveTeamCount(s, people)}</span>
                      {(s.openRolesLive || []).length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)' }}><Icon name="briefcase" size={14} /> {s.openRolesLive.length} {t('sections.openRoles')}</span>}
                    </div>
                    <Icon name="arrowRight" size={16} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// NASIL ÇALIŞIR — Start-Hub evrim yol haritası
// ============================================
function JourneySection() {
  const { t } = useLang();
  const steps = [
    { icon: '🤝', title: t('journey.community'), desc: t('journey.communityDesc'), bg: 'var(--blue-light)', color: 'var(--blue)', phase: 'now' },
    { icon: '🧪', title: t('journey.labs'), desc: t('journey.labsDesc'), bg: 'var(--purple-light)', color: 'var(--purple)', phase: 'now' },
    { icon: '🏗️', title: t('journey.venture'), desc: t('journey.ventureDesc'), bg: 'var(--orange-light)', color: 'var(--orange)', phase: 'next' },
    { icon: '🚀', title: t('journey.exit'), desc: t('journey.exitDesc'), bg: 'var(--green-light)', color: 'var(--green)', phase: 'goal' },
    { icon: '🦄', title: t('journey.unicorn'), desc: t('journey.unicornDesc'), bg: 'var(--red-light)', color: 'var(--red)', phase: 'goal' },
  ];
  const phaseLabel = { now: t('journey.phaseNow'), next: t('journey.phaseNext'), goal: t('journey.phaseGoal') };

  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <SectionHeader label={t('journey.title')} title={t('journey.desc')} center />
        </Reveal>
        <Reveal className="roadmap">
          {steps.map((step, i) => (
            <div className={`roadmap__step roadmap__step--${step.phase}`} key={i}>
              <div className="roadmap__connector" aria-hidden="true"></div>
              <div className="roadmap__num">{String(i + 1).padStart(2, '0')}</div>
              <span className={`roadmap__phase roadmap__phase--${step.phase}`}>{phaseLabel[step.phase]}</span>
              <div className="roadmap__icon" style={{ background: step.bg, color: step.color }}>{step.icon}</div>
              <div className="roadmap__title">{step.title}</div>
              <div className="roadmap__desc text-pretty">{step.desc}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ============================================
// SPONSORLAR — kayan şerit
// ============================================
function SponsorsSection() {
  const { t } = useLang();
  const { sponsors } = useSponsors();
  // Gerçek destekçi eklenene kadar bölüm hiç gösterilmez — panelden bir
  // destekçi eklenir eklenmez otomatik olarak tekrar görünür hale gelir.
  if (!sponsors || sponsors.length === 0) return null;
  return (
    <section className="section section--alt" style={{ paddingTop: 64, paddingBottom: 64 }}>
      <div className="container">
        <Reveal>
          <SectionHeader label={t('sections.sponsors')} title={t('sections.sponsorsDesc')} center />
        </Reveal>
      </div>
      <Reveal>
        <SponsorsMarquee items={sponsors} />
      </Reveal>
    </section>
  );
}

export { HomePage, JourneySection };
