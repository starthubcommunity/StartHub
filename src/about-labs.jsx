// about-labs.jsx — About (yönetim ekibi + mentörler + 2 buton) & Lab (proje listesi)
import React, { useState as useStateAL } from 'react';
import { useLang, people, startups, postsForProject, teamMembers, mentors } from './data';
import { Avatar, Icon, Reveal, Button, SectionHeader, StartupCard, PersonCard, PostCard, StageBadge, stageMap } from './ui-components';
import { CTASection, PageHeader } from './layout';
import { getRoleDescription } from './detail-pages';
import { JourneySection } from './home-page';

// ============================================
// ORG CHART — katmanlı yönetim şeması
// ============================================
function OrgCard({ person, tier }) {
  const { localized } = useLang();
  const goLinkedIn = () => { if (person.linkedin && person.linkedin !== '#') window.open(person.linkedin, '_blank', 'noopener,noreferrer'); };
  return (
    <div className={`org-card org-card--t${tier}`} onClick={goLinkedIn} style={{ cursor: person.linkedin && person.linkedin !== '#' ? 'pointer' : 'default' }}>
      <Avatar person={person} size={tier === 1 ? 64 : 54} />
      <div className="org-card__name">{person.name}</div>
      <div className="org-card__role" style={{ background: person.color + '18', color: person.color }}>
        {tier === 1 && <Icon name="star" size={12} />}
        {localized(person, 'role')}
      </div>
      {person.linkedin && (
        <a className="org-card__li" href={person.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><Icon name="linkedin" size={16} /></a>
      )}
    </div>
  );
}

function OrgChart() {
  const t1 = teamMembers.filter(p => p.tier === 1);
  const t2 = teamMembers.filter(p => p.tier === 2);
  const t3 = teamMembers.filter(p => p.tier === 3);
  return (
    <div className="org">
      <div className="org__tier org__tier--lead">{t1.map(p => <OrgCard key={p.id} person={p} tier={1} />)}</div>
      <div className="org__link" aria-hidden="true"></div>
      <div className="org__tier">{t2.map(p => <OrgCard key={p.id} person={p} tier={2} />)}</div>
      <div className="org__link" aria-hidden="true"></div>
      <div className="org__tier">{t3.map(p => <OrgCard key={p.id} person={p} tier={3} />)}</div>
    </div>
  );
}

// ============================================
// ABOUT PAGE
// ============================================
function AboutPage({ navigate }) {
  const { lang, t } = useLang();

  return (
    <div className="page-transition">
      <PageHeader label={t('about.label')} title={t('about.title')} desc={t('about.desc')} />

      {/* Intro lead */}
      <div className="container">
        <Reveal><p className="about-intro text-pretty">{t('about.intro')}</p></Reveal>
      </div>

      {/* Neden Varız? */}
      <section className="section">
        <div className="container">
          <div className="why">
            <Reveal>
              <div>
                <div className="section-header__label" style={{ marginBottom: 14 }}>{t('about.whyLabel')}</div>
                <h2 className="why__title text-pretty">{t('about.whyTitle')}</h2>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="why__body">
                <p className="why__p why__p--lead text-pretty">{t('about.whyDesc1')}</p>
                <p className="why__p text-pretty">{t('about.whyDesc2')}</p>
                <p className="why__p why__p--quote text-pretty">{t('about.whyDesc3')}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışıyoruz — 4 sütun (Community / Labs / Gelişim / Ekosistem) */}
      <section className="section section--alt">
        <div className="container">
          <Reveal>
            <SectionHeader label={t('about.pillarsLabel')} title={t('about.pillarsTitle')} desc={t('about.pillarsDesc')} center />
          </Reveal>
          <div className="pillar-grid">
            {t('about.pillars').map((p, i) => (
              <Reveal key={p.key} delay={i * 70}>
                <div className="pillar">
                  <div className="pillar__num">0{i + 1}</div>
                  <div className="pillar__icon" style={{ background: p.bg }}>
                    <Icon name={p.icon} size={24} style={{ color: p.color }} />
                  </div>
                  <div className="pillar__title">{p.title}</div>
                  <div className="pillar__tagline" style={{ color: p.color }}>{p.tagline}</div>
                  <p className="pillar__desc text-pretty">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Misyon & Vizyon */}
      <section className="section">
        <div className="container">
          <div className="grid grid-2" style={{ gap: 24 }}>
            <Reveal>
              <div className="card card--no-hover" style={{ height: '100%' }}>
                <div className="card__inner" style={{ padding: 32 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--r-lg)', background: 'var(--red-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Icon name="target" size={24} style={{ color: 'var(--red)' }} />
                  </div>
                  <h3 className="text-h3" style={{ marginBottom: 12 }}>{t('about.missionTitle')}</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 15.5 }}>{t('about.missionDesc')}</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div className="card card--no-hover" style={{ height: '100%' }}>
                <div className="card__inner" style={{ padding: 32 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 'var(--r-lg)', background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Icon name="rocket" size={24} style={{ color: 'var(--blue)' }} />
                  </div>
                  <h3 className="text-h3" style={{ marginBottom: 12 }}>{t('about.visionTitle')}</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 15.5 }}>{t('about.visionDesc')}</p>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Akış şeridi — İnsanlardan Takımlara → Startup'lara → Unicornlara */}
          <Reveal delay={120}>
            <div className="flow-strip" style={{ marginTop: 24 }}>
              {t('about.flowParts').map((part, i, arr) => (
                <React.Fragment key={i}>
                  <div className="flow-strip__item">
                    <span className="flow-strip__txt">{part}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flow-strip__item flow-strip__arrow" style={{ flex: '0 0 auto', minWidth: 0, padding: '0 4px' }}>
                      <Icon name="arrowRight" size={22} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Yönetim Ekibi — organizasyon şeması */}
      <section className="section section--alt">
        <div className="container">
          <Reveal>
            <SectionHeader label={t('about.teamTitle')} title={t('about.teamDesc')} center />
          </Reveal>
          <Reveal><OrgChart /></Reveal>
        </div>
      </section>

      {/* Mentörler */}
      <section className="section">
        <div className="container">
          <Reveal>
            <SectionHeader label={t('about.mentorsTitle')} title={t('about.mentorsDesc')} center />
          </Reveal>
          <div className="grid grid-4" style={{ maxWidth: 1000, margin: '0 auto' }}>
            {mentors.map((m, i) => (
              <Reveal key={m.id} delay={i * 60}><PersonCard person={m} roleField="role" /></Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır — aşağıda */}
      <section className="section section--alt" style={{ paddingTop: 8 }}>
        <JourneySection />
      </section>

      {/* İki yollu katılım — kompakt banner */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container">
          <div className="join-banner">
            <div className="join-banner__glow" aria-hidden="true"></div>
            <div className="join-banner__txt">
              <h2 className="join-banner__title">{t('about.joinHubTitle')}</h2>
              <p className="join-banner__desc">{t('about.joinHubDesc')}</p>
            </div>
            <div className="join-banner__actions">
              <Button variant="primary" iconRight="arrowRight" onClick={() => { navigate('join'); window.scrollTo({ top: 0 }); }}>
                {t('about.joinHubBtn')}
              </Button>
              <Button variant="dark" iconRight="arrowUpRight" onClick={() => { navigate('labs'); window.scrollTo({ top: 0 }); }}>
                {t('about.joinProjectBtn')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================
// OPPORTUNITIES TAB — tüm projelerdeki açık pozisyonlar
// ============================================
function OpportunitiesTab({ opportunities, navigate }) {
  const { lang, t, localized } = useLang();
  const [searchOpp, setSearchOpp] = React.useState('');

  const filtered = opportunities.filter(o => {
    if (!searchOpp) return true;
    const q = searchOpp.toLowerCase();
    return o.role.toLowerCase().includes(q) ||
      o.project.name.toLowerCase().includes(q) ||
      (o.project.tags || []).some(tag => tag.toLowerCase().includes(q));
  });

  // Projeye göre grupla
  const grouped = {};
  filtered.forEach(o => {
    const pid = o.project.id;
    if (!grouped[pid]) grouped[pid] = { project: o.project, roles: [] };
    grouped[pid].roles.push(o.role);
  });
  const groups = Object.values(grouped);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 400 }}>
            <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input type="text" className="form-input"
              placeholder={lang === 'tr' ? 'Pozisyon, proje veya teknoloji ara...' : 'Search role, project or technology...'}
              value={searchOpp} onChange={e => setSearchOpp(e.target.value)} style={{ paddingLeft: 42 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'var(--text-tertiary)' }}>
            <Icon name="briefcase" size={16} />
            <span>{filtered.length} {t('labs.opportunitiesCount')}</span>
          </div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {t('labs.opportunitiesDesc')}
        </p>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)' }}>
          <Icon name="briefcase" size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: 16 }}>{lang === 'tr' ? 'Arama kriterlerine uygun pozisyon bulunamadı.' : 'No positions match your search.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groups.map(g => (
            <div key={g.project.id} className="card" style={{ padding: 0 }}>
              <div className="card__inner" style={{ padding: 0 }}>
                {/* Proje başlığı */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                  onClick={() => { navigate('project', g.project.id); window.scrollTo({ top: 0 }); }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 'var(--r-md)', flexShrink: 0,
                    background: g.project.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17,
                    overflow: 'hidden',
                  }}>{g.project.logo ? <img src={g.project.logo} alt={g.project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : g.project.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16 }}>{g.project.name}</span>
                      <StageBadge stage={g.project.stage} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {localized(g.project, 'tagline') || localized(g.project, 'desc')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
                    {(g.project.tags || []).slice(0, 3).map(tag => <span key={tag} className="badge badge--tag">{tag}</span>)}
                  </div>
                </div>
                {/* Pozisyon listesi */}
                <div>
                  {g.roles.map((role, i) => {
                    const desc = getRoleDescription(role, lang);
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px',
                        borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
                      }}>
                        <span style={{
                          width: 36, height: 36, borderRadius: 'var(--r-md)', flexShrink: 0,
                          background: `color-mix(in srgb, ${g.project.color} 12%, var(--card-bg))`,
                          color: g.project.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon name="briefcase" size={17} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14.5 }}>{role}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
                        </div>
                        <Button variant="primary" size="sm" iconRight="arrowRight"
                          onClick={(e) => { e.stopPropagation(); sessionStorage.setItem('sh_join_role', role); navigate('join', g.project.id); window.scrollTo({ top: 0 }); }}>
                          {t('labs.applyTeam')}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// LAB PAGE — proje listesi (detaya yönlendirir)
// ============================================
function LabsPage({ navigate }) {
  const { lang, t, localized } = useLang();
  const [activeFilter, setActiveFilter] = useStateAL('all');
  const [searchQuery, setSearchQuery] = useStateAL('');
  const [activeTab, setActiveTab] = useStateAL('projects');

  const stages = ['all', 'idea', 'mvp', 'building', 'launch', 'growth'];
  const stageLabels = {
    all: t('labs.allStages'),
    idea: lang === 'tr' ? 'Fikir' : 'Idea', mvp: 'MVP',
    building: lang === 'tr' ? 'Geliştirme' : 'Building',
    launch: lang === 'tr' ? 'Lansman' : 'Launch',
    growth: lang === 'tr' ? 'Büyüme' : 'Growth',
  };

  const filtered = startups.filter(s => {
    const matchesStage = activeFilter === 'all' || s.stage === activeFilter;
    const matchesSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStage && matchesSearch;
  });

  // Tüm açık pozisyonları topla
  const allOpportunities = startups.flatMap(s => {
    const roles = localized(s, 'openRolesList') || [];
    return roles.map(role => ({ role, project: s }));
  });

  const goProject = (id) => { navigate('project', id); window.scrollTo({ top: 0 }); };

  return (
    <div className="page-transition">
      <PageHeader label={t('labs.label')} title={t('labs.title')} desc={t('labs.desc')} />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {/* Tab switcher: Projeler / Opportunities */}
          <div className="lab-tabs" style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--bg-secondary)', borderRadius: 'var(--r-full)', padding: 4, width: 'fit-content' }}>
            <button className={`lab-tab ${activeTab === 'projects' ? 'lab-tab--active' : ''}`}
              onClick={() => setActiveTab('projects')}>
              <Icon name="layers" size={15} />
              {lang === 'tr' ? 'Projeler' : 'Projects'}
            </button>
            <button className={`lab-tab ${activeTab === 'opportunities' ? 'lab-tab--active' : ''}`}
              onClick={() => setActiveTab('opportunities')}>
              <Icon name="briefcase" size={15} />
              {t('labs.opportunities')}
              <span className="lab-tab__count">{allOpportunities.length}</span>
            </button>
          </div>

          {activeTab === 'projects' ? (
            <>
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 400 }}>
                    <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input type="text" className="form-input"
                      placeholder={lang === 'tr' ? 'Proje veya teknoloji ara...' : 'Search projects or technologies...'}
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 42 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: 'var(--text-tertiary)' }}>
                    <Icon name="filter" size={16} />
                    <span>{filtered.length} {lang === 'tr' ? 'proje' : 'projects'}</span>
                  </div>
                </div>
                <div className="filters">
                  {stages.map(s => (
                    <button key={s} className={`filter-btn ${activeFilter === s ? 'filter-btn--active' : ''}`} onClick={() => setActiveFilter(s)}>
                      {stageLabels[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-2">
                {filtered.map(s => (
                  <StartupCard key={s.id} startup={s} onClick={() => goProject(s.id)} />
                ))}
              </div>

              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)' }}>
                  <Icon name="search" size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                  <p style={{ fontSize: 16 }}>{lang === 'tr' ? 'Bu filtrelere uygun proje bulunamadı.' : 'No projects match these filters.'}</p>
                </div>
              )}
            </>
          ) : (
            /* Opportunities tab */
            <OpportunitiesTab opportunities={allOpportunities} navigate={navigate} />
          )}
        </div>
      </section>

      <CTASection navigate={navigate} />
    </div>
  );
}

export { AboutPage, LabsPage };
