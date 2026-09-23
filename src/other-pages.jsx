// other-pages.jsx — Yazılar (Blog) & Katıl (Join)
import { useState as useStateOP, useEffect as useEffectOP } from 'react';
import { useLang, usePosts, useEvents, useStartups } from './data';
import { supabase } from './lib/supabase';
import { Icon, Button, PostCard, EventCard, Reveal, externalUrl } from './ui-components';
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

// Startup (LAB) tarafındaki ilgi alanları — HR'da Adaylar sayfasında kutucuk olur (INTEREST_AREAS ile aynı anahtarlar).
const JOIN_INTERESTS = [
  { key: 'frontend',  tr: 'Frontend',            en: 'Frontend' },
  { key: 'backend',   tr: 'Backend',             en: 'Backend' },
  { key: 'mobile',    tr: 'Mobil Uygulama',      en: 'Mobile apps' },
  { key: 'data',      tr: 'Veri & Yapay Zekâ',   en: 'Data & AI' },
  { key: 'design',    tr: 'UI/UX Tasarım',       en: 'UI/UX Design' },
  { key: 'product',   tr: 'Ürün & Proje Yönetimi', en: 'Product & Project Mgmt' },
  { key: 'marketing', tr: 'Pazarlama & Growth',  en: 'Marketing & Growth' },
  { key: 'business',  tr: 'İş Geliştirme',       en: 'Business Development' },
  { key: 'content',   tr: 'İçerik & Yazı',       en: 'Content & Writing' },
  { key: 'other',     tr: 'Diğer',               en: 'Other' },
];

// ── Topluluk mu, Startup mı? ──────────────────────────────────────────
// Üç kartın (Katıl / Mentör / Destekçi) altında tek bir ikili seçim çubuğu; başlıklar
// "Hub / Lab" jargonunu bilmeyen de anlasın diye sade Türkçe. Seçim
// applications.target'a ('community' | 'startup') yazılır. Topluluğa Katıl kartında
// seçimin altında ikinci adım (radyo satırları) niyeti (intent) belirler.
const TARGET_COPY = {
  tr: {
    community: {
      q: 'Nerede yer almak istersin?',
      community: ['Toplulukta Yer Al', 'Etkinlik, buluşma ve ekiplerle topluluğun içinde ol.'],
      startup:   ["Bir Startup'ta Yer Al", 'Bir girişim ekibine katıl ya da kendi fikrini hayata geçir.'],
    },
    mentor: {
      q: 'Kime mentörlük yapmak istersin?',
      community: ['Topluluğa Mentör Ol', 'Topluluğun destekçi mentörü olabilirsin.'],
      startup:   ["Bir Startup'a Mentör Ol", 'Bir girişim ekibine yol göster.'],
    },
    sponsor: {
      q: 'Kimi desteklemek istersin?',
      community: ['Topluluğa Sponsor Ol', 'Etkinlik ve topluluk faaliyetlerine sponsorluk sağla.'],
      startup:   ["Bir Startup'a Yatırım / Kaynak Sağla", 'Yatırım, hizmet ya da imkân sunarak bir girişimin büyümesine katkı ver.'],
    },
  },
  en: {
    community: {
      q: 'Where do you want to take part?',
      community: ['Join the Community', 'Be part of events, meetups and teams.'],
      startup:   ['Join a Startup', 'Join a venture team or build your own idea.'],
    },
    mentor: {
      q: 'Who do you want to mentor?',
      community: ['Mentor the Community', 'You will be a supporting mentor of the community.'],
      startup:   ['Mentor a Startup', 'Guide a venture team.'],
    },
    sponsor: {
      q: 'Who do you want to back?',
      community: ['Sponsor the Community', 'Sponsor our events and community activities.'],
      startup:   ['Invest in / Resource a Startup', 'Help a venture grow with investment, services or resources.'],
    },
  },
};

// İkinci adım (yalnızca Topluluğa Katıl kartı): [intent, etiket, ipucu]
const INTENT_COPY = {
  tr: {
    community: [
      ['community', 'Topluluğa katılmak istiyorum', ''],
      ['hub', 'Ekipte yer almak istiyorum', ''],
    ],
    startup: [
      ['project', 'Devam eden bir projeye katılmak istiyorum', ''],
      ['idea_application', 'Yeni bir fikrim var, toplulukla geliştirmek istiyorum', ''],
      ['pool_match', 'İlgi alanıma uygun bir proje çıkınca katılmak istiyorum',
        'İlgi alanını ve yeteneklerini paylaş; projelerde yer açıldığında seninle iletişime geçelim.'],
    ],
  },
  en: {
    community: [
      ['community', 'I want to join the community', ''],
      ['hub', 'I want to take a place in a team', ''],
    ],
    startup: [
      ['project', 'I want to join an ongoing project', ''],
      ['idea_application', 'I have a new idea I want to build with the community', ''],
      ['pool_match', 'I want to join when a project fits my interests',
        'Share your interests and skills; we will reach out when a project has room.'],
    ],
  },
};

// Ekipte yer almak isteyenlere gösterilen birimler (role alanına TR ad yazılır).
const HUB_UNITS = [
  { tr: 'Sosyal Medya', en: 'Social Media',
    descTr: 'Topluluğun sosyal medya hesaplarını yönetebilir, içerik üretebilir ve etkinlikleri duyurabilirsin.',
    descEn: 'Manage our social media accounts, create content and promote events.' },
  { tr: 'Tasarım', en: 'Design',
    descTr: 'Görsel kimliğimizi, etkinlik afişlerini ve sosyal medya tasarımlarını hazırlayabilirsin.',
    descEn: 'Create our visual identity, event posters and social media designs.' },
  { tr: 'Organizasyon', en: 'Events & Operations',
    descTr: 'Etkinlik, buluşma ve atölyelerin planlanmasında ve yürütülmesinde yer alabilirsin.',
    descEn: 'Help plan and run events, meetups and workshops.' },
  { tr: 'Sponsorluk', en: 'Sponsorship',
    descTr: 'Sponsor ve destekçi ilişkilerini yönetebilir, topluluk için yeni işbirliği fırsatları geliştirebilirsin.',
    descEn: 'Manage sponsor and partner relationships and develop new collaboration opportunities.' },
  { tr: 'Erasmus+', en: 'Erasmus+',
    descTr: 'Avrupa Birliği Erasmus+ proje yazma ekibimizde yer alabilir, bu ekiple birlikte proje yazıp hibe almaya yönelik çalışmalar yürütebilirsin.',
    descEn: 'Join our EU Erasmus+ project-writing team and help prepare grant applications to bring new funding to the community.' },
];

function TargetPicker({ type, value, onPick, intent, onIntent, lang }) {
  const L = lang === 'tr' ? 'tr' : 'en';
  const c = TARGET_COPY[L][type];
  const rows = type === 'community' && value ? INTENT_COPY[L][value] : null;
  return (
    <div className="jsel" key={type} style={{ '--jt-c': JT_COLOR[type] }}>
      <div className="jsel__q">{c.q}</div>
      <div className="jseg" role="radiogroup" aria-label={c.q}>
        {['community', 'startup'].map(k => (
          <button key={k} type="button" role="radio" aria-checked={value === k}
            className={`jseg__btn${value === k ? ' jseg__btn--on' : ''}`} onClick={() => onPick(k)}>
            <span className="jseg__title">{c[k][0]} <span className={`jseg__tag jseg__tag--${k}`}>({k === 'community' ? 'HUB' : 'LAB'})</span></span>
            <span className="jseg__desc">{c[k][1]}</span>
          </button>
        ))}
      </div>
      {rows && (
        <div className="jrows" role="radiogroup" key={value}>
          <div className="jrows__q">{L === 'tr' ? 'Nasıl yer almak istersin?' : 'How would you like to take part?'}</div>
          {rows.map(([k, label, hint]) => (
            <button key={k} type="button" role="radio" aria-checked={intent === k}
              className={`jrow${intent === k ? ' jrow--on' : ''}`} onClick={() => onIntent(k)}>
              <span className="jrow__dot" />
              <span className="jrow__text">
                <span className="jrow__label">{label}</span>
                {hint && <span className="jrow__hint">{hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Ülke koduna göre beklenen yerel numara uzunluğu (ulusal numara haneleri —
// resmi E.164 hane sayıları). Fazla/eksik yazmayı önlemek için hem yazarken
// (fazlası kabul edilmez) hem gönderirken (validate) kullanılır. Listede
// olmayan / "Diğer ülke" için esnek bir üst sınır (DEFAULT_PHONE_MAX) geçerli.
const COUNTRY_PHONE_LEN = {
  '90': 10, '994': 9, '993': 8, '998': 9, '996': 9, '992': 9, '7': 10, '995': 9, '374': 8,
  '98': 10, '964': 10, '963': 9, '970': 9, '962': 9, '961': 8, '966': 9, '971': 9, '965': 8,
  '974': 8, '973': 8, '968': 8, '967': 9, '20': 10, '218': 9, '249': 9, '212': 9, '213': 9,
  '216': 8, '252': 8, '234': 10, '254': 9, '27': 9, '93': 9, '92': 10, '91': 10, '880': 10,
  '86': 11, '976': 8, '82': 10, '81': 10, '84': 9, '62': 11, '60': 9, '63': 10, '380': 9,
  '375': 9, '355': 9, '387': 8, '389': 8, '383': 8, '381': 9, '382': 8, '385': 9, '386': 8,
  '421': 9, '373': 8, '370': 8, '371': 8, '372': 8, '353': 9, '352': 9, '357': 8, '356': 8,
  '354': 7, '30': 10, '359': 9, '40': 9,
  '48': 9, '49': 11, '33': 9, '44': 10, '39': 10, '34': 9, '351': 9, '31': 9, '32': 9,
  '46': 9, '47': 8, '45': 8, '358': 9, '41': 9, '43': 11, '36': 9, '420': 9, '1': 10,
  '55': 11, '52': 10,
};
const DEFAULT_PHONE_MAX = 13;                              // "Diğer ülke…" — üst sınır
const phoneMaxFor = (cc) => COUNTRY_PHONE_LEN[cc] || DEFAULT_PHONE_MAX;

// Yerel numarayı normalize eder: rakam dışı her şeyi ve baştaki tek "0" (şehir/trunk
// öneki) düşer, ülkeye göre beklenenden fazla hane yazılmasına izin vermez. Ülke kodu
// ayrı bir seçiciyle alınıyor, burada karışmıyor.
const phoneLocalDigits = (v, max = DEFAULT_PHONE_MAX) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, max);
};

// Yazarken okunaklı olsun diye haneleri gruplar (TR/KZ/RU: 5xx xxx xx xx; diğerlerinde
// genel 3'erli gruplama) — gönderilen/saklanan değer yine yalnızca rakamlardır, bu
// yalnızca ekranda gösterim biçimi.
const formatPhoneDisplay = (digits, cc) => {
  if (!digits) return '';
  if (cc === '90' || cc === '7') {
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(' ');
  }
  return digits.match(/.{1,3}/g)?.join(' ') || digits;
};

// Uluslararası öğrenciler de başvuracağı için ülke kodu seçilebilir — varsayılan
// Türkiye (+90), listede olmayan bir ülke için "Diğer ülke…" ile elle kod girilir.
const PHONE_OTHER_CC = '__other';
const COUNTRY_CODES = [
  { code: '90', tr: 'Türkiye', en: 'Turkey' },
  { code: '994', tr: 'Azerbaycan', en: 'Azerbaijan' },
  { code: '993', tr: 'Türkmenistan', en: 'Turkmenistan' },
  { code: '998', tr: 'Özbekistan', en: 'Uzbekistan' },
  { code: '996', tr: 'Kırgızistan', en: 'Kyrgyzstan' },
  { code: '992', tr: 'Tacikistan', en: 'Tajikistan' },
  { code: '7', tr: 'Kazakistan / Rusya', en: 'Kazakhstan / Russia' },
  { code: '995', tr: 'Gürcistan', en: 'Georgia' },
  { code: '374', tr: 'Ermenistan', en: 'Armenia' },
  { code: '98', tr: 'İran', en: 'Iran' },
  { code: '964', tr: 'Irak', en: 'Iraq' },
  { code: '963', tr: 'Suriye', en: 'Syria' },
  { code: '970', tr: 'Filistin', en: 'Palestine' },
  { code: '962', tr: 'Ürdün', en: 'Jordan' },
  { code: '961', tr: 'Lübnan', en: 'Lebanon' },
  { code: '966', tr: 'Suudi Arabistan', en: 'Saudi Arabia' },
  { code: '971', tr: 'BAE', en: 'UAE' },
  { code: '965', tr: 'Kuveyt', en: 'Kuwait' },
  { code: '974', tr: 'Katar', en: 'Qatar' },
  { code: '973', tr: 'Bahreyn', en: 'Bahrain' },
  { code: '968', tr: 'Umman', en: 'Oman' },
  { code: '967', tr: 'Yemen', en: 'Yemen' },
  { code: '20', tr: 'Mısır', en: 'Egypt' },
  { code: '218', tr: 'Libya', en: 'Libya' },
  { code: '249', tr: 'Sudan', en: 'Sudan' },
  { code: '212', tr: 'Fas', en: 'Morocco' },
  { code: '213', tr: 'Cezayir', en: 'Algeria' },
  { code: '216', tr: 'Tunus', en: 'Tunisia' },
  { code: '252', tr: 'Somali', en: 'Somalia' },
  { code: '234', tr: 'Nijerya', en: 'Nigeria' },
  { code: '254', tr: 'Kenya', en: 'Kenya' },
  { code: '27', tr: 'Güney Afrika', en: 'South Africa' },
  { code: '93', tr: 'Afganistan', en: 'Afghanistan' },
  { code: '92', tr: 'Pakistan', en: 'Pakistan' },
  { code: '91', tr: 'Hindistan', en: 'India' },
  { code: '880', tr: 'Bangladeş', en: 'Bangladesh' },
  { code: '86', tr: 'Çin', en: 'China' },
  { code: '976', tr: 'Moğolistan', en: 'Mongolia' },
  { code: '82', tr: 'Güney Kore', en: 'South Korea' },
  { code: '81', tr: 'Japonya', en: 'Japan' },
  { code: '84', tr: 'Vietnam', en: 'Vietnam' },
  { code: '62', tr: 'Endonezya', en: 'Indonesia' },
  { code: '60', tr: 'Malezya', en: 'Malaysia' },
  { code: '63', tr: 'Filipinler', en: 'Philippines' },
  { code: '380', tr: 'Ukrayna', en: 'Ukraine' },
  { code: '375', tr: 'Belarus', en: 'Belarus' },
  { code: '355', tr: 'Arnavutluk', en: 'Albania' },
  { code: '387', tr: 'Bosna Hersek', en: 'Bosnia and Herzegovina' },
  { code: '389', tr: 'Kuzey Makedonya', en: 'North Macedonia' },
  { code: '383', tr: 'Kosova', en: 'Kosovo' },
  { code: '381', tr: 'Sırbistan', en: 'Serbia' },
  { code: '382', tr: 'Karadağ', en: 'Montenegro' },
  { code: '385', tr: 'Hırvatistan', en: 'Croatia' },
  { code: '386', tr: 'Slovenya', en: 'Slovenia' },
  { code: '421', tr: 'Slovakya', en: 'Slovakia' },
  { code: '373', tr: 'Moldova', en: 'Moldova' },
  { code: '370', tr: 'Litvanya', en: 'Lithuania' },
  { code: '371', tr: 'Letonya', en: 'Latvia' },
  { code: '372', tr: 'Estonya', en: 'Estonia' },
  { code: '353', tr: 'İrlanda', en: 'Ireland' },
  { code: '352', tr: 'Lüksemburg', en: 'Luxembourg' },
  { code: '357', tr: 'Kıbrıs (Rum)', en: 'Cyprus' },
  { code: '356', tr: 'Malta', en: 'Malta' },
  { code: '354', tr: 'İzlanda', en: 'Iceland' },
  { code: '30', tr: 'Yunanistan', en: 'Greece' },
  { code: '359', tr: 'Bulgaristan', en: 'Bulgaria' },
  { code: '40', tr: 'Romanya', en: 'Romania' },
  { code: '48', tr: 'Polonya', en: 'Poland' },
  { code: '49', tr: 'Almanya', en: 'Germany' },
  { code: '33', tr: 'Fransa', en: 'France' },
  { code: '44', tr: 'Birleşik Krallık', en: 'United Kingdom' },
  { code: '39', tr: 'İtalya', en: 'Italy' },
  { code: '34', tr: 'İspanya', en: 'Spain' },
  { code: '351', tr: 'Portekiz', en: 'Portugal' },
  { code: '31', tr: 'Hollanda', en: 'Netherlands' },
  { code: '32', tr: 'Belçika', en: 'Belgium' },
  { code: '46', tr: 'İsveç', en: 'Sweden' },
  { code: '47', tr: 'Norveç', en: 'Norway' },
  { code: '45', tr: 'Danimarka', en: 'Denmark' },
  { code: '358', tr: 'Finlandiya', en: 'Finland' },
  { code: '41', tr: 'İsviçre', en: 'Switzerland' },
  { code: '43', tr: 'Avusturya', en: 'Austria' },
  { code: '36', tr: 'Macaristan', en: 'Hungary' },
  { code: '420', tr: 'Çekya', en: 'Czechia' },
  { code: '1', tr: 'ABD / Kanada', en: 'USA / Canada' },
  { code: '55', tr: 'Brezilya', en: 'Brazil' },
  { code: '52', tr: 'Meksika', en: 'Mexico' },
];

// Kullanıcı numarayı ülke koduyla birlikte yazarsa/yapıştırırsa ("+385 91 234 5678"
// gibi — yurt dışından başvuranların doğal alışkanlığı), bunu farketmeden yerel
// numara alanına yazarsa numara, o an seçili ülkenin (genelde varsayılan +90,
// 10 hane) sınırına göre KESİLİYORDU (son haneler kayboluyordu) ve ülke kodu hiç
// değişmiyordu. Bu fonksiyon "+" veya "00" ile başlayan girdilerdeki bilinen kodu
// ayırıp seçiciyi otomatik günceller. En uzun eşleşen kod önce denenir (örn. "994"
// Azerbaycan, "90" Türkiye ile karışmasın).
const KNOWN_CC_SORTED = [...new Set(COUNTRY_CODES.map((c) => c.code))].sort((a, b) => b.length - a.length);
const splitIntlPrefix = (raw) => {
  const s = String(raw || '').trim();
  if (!/^(\+|00)/.test(s)) return null;
  const cleaned = s.replace(/[^\d+]/g, '');   // "+385 (91) 234-5678" → "+385912345678"
  const m = cleaned.match(/^\+(\d+)/) || cleaned.match(/^00(\d{6,})/);
  if (!m) return null;
  const digits = m[1];
  const cc = KNOWN_CC_SORTED.find((code) => digits.startsWith(code) && digits.length - code.length >= 4);
  return cc ? { cc, rest: digits.slice(cc.length) } : null;
};

// Ülke kodu seçilebilir telefon alanı — varsayılan Türkiye, listede yoksa "Diğer
// ülke…" ile elle kod girilir. Kullanıcı yalnızca yerel numarayı yazar (haneler
// yazarken gruplanır, örn. "532 123 45 67"), sayfa dili İngilizce'yse ülke isimleri
// de İngilizce gösterilir. Profesyonel sitelerdeki gibi: ülkeye göre beklenen hane
// sayısından fazlası yazılamaz, eksik/tam durumu canlı bir sayaçla gösterilir.
function PhoneField({ ccValue, onCcChange, value, onChange, invalid, lang, required }) {
  const known = COUNTRY_CODES.some(c => c.code === ccValue);
  const maxLen = phoneMaxFor(known ? ccValue : '');
  const complete = value.length === maxLen;

  // "+385…" TEK TUŞ TUŞ yazılırken (yapıştırma değil): her tuşta alan hemen rakamlara
  // indirgenip "+" atılırsa, kod hiçbir zaman tam oluşmadan kaybolur (kullanıcı "+3"
  // yazınca "3" olarak yerel numaraya karışır). Kod netleşene kadar ham metni
  // (rawIntl) OLDUĞU GİBİ ekranda tutuyoruz; netleşince ccValue/value'ya "sıçrıyor".
  const [rawIntl, setRawIntl] = useStateOP(null);

  const handleCc = (cc) => {
    setRawIntl(null);
    const nextCc = cc === PHONE_OTHER_CC ? '' : cc;
    onCcChange(nextCc);
    const nextMax = phoneMaxFor(cc === PHONE_OTHER_CC ? '' : nextCc);
    if (value.length > nextMax) onChange(value.slice(0, nextMax));
  };

  // Yerel numara alanına "+385…" gibi tam uluslararası biçimde yazılır/yapıştırılırsa,
  // kodu otomatik ayırıp seçiciyi günceller (yanlış ülkenin hane sınırına göre
  // kesilmesin diye) — bkz. splitIntlPrefix.
  const handleNumberInput = (raw) => {
    if (/^(\+|00)/.test(raw.trim())) {
      const split = splitIntlPrefix(raw);
      if (split) {
        setRawIntl(null);
        onCcChange(split.cc);
        onChange(phoneLocalDigits(split.rest, phoneMaxFor(split.cc)));
      } else {
        setRawIntl(raw);   // kod henüz netleşmedi — yazmaya devam edilsin, alan sıfırlanmasın
      }
      return;
    }
    setRawIntl(null);
    onChange(phoneLocalDigits(raw, maxLen));
  };

  return (
    <div className="form-group">
      <label className="form-label">
        {lang === 'tr' ? 'Telefon' : 'Phone'}{' '}
        {required
          ? <span style={{ color: 'var(--red, #DC2626)' }}>*</span>
          : <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({lang === 'tr' ? 'opsiyonel' : 'optional'})</span>}
      </label>
      <div className={`jphone${invalid ? ' jphone--invalid' : ''}`}>
        <select name="tel-country-code" autoComplete="tel-country-code" className="jphone__cc" value={known ? ccValue : PHONE_OTHER_CC} onChange={e => handleCc(e.target.value)}>
          {COUNTRY_CODES.map(c => <option key={c.code + c.tr} value={c.code}>+{c.code} {lang === 'tr' ? c.tr : c.en}</option>)}
          <option value={PHONE_OTHER_CC}>{lang === 'tr' ? 'Diğer ülke…' : 'Other country…'}</option>
        </select>
        {!known && (
          <span className="jphone__custom-wrap">
            <span className="jphone__plus" aria-hidden="true">+</span>
            <input className="jphone__cc-custom" placeholder={lang === 'tr' ? 'kod' : 'code'} inputMode="numeric"
              value={ccValue} onChange={e => onCcChange(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </span>
        )}
        <input type="tel" name="tel-national" autoComplete="tel-national" inputMode="tel" className="jphone__input"
          placeholder={ccValue === '90' || ccValue === '7' ? '(5xx) xxx xx xx' : '(xxx) xxx xx xx'}
          value={rawIntl ?? formatPhoneDisplay(value, ccValue)} onChange={e => handleNumberInput(e.target.value)} />
      </div>
      {value && (
        <div style={{ fontSize: 11.5, marginTop: 5, color: complete ? '#16A34A' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {complete && <AIconInline name="check" />}
          {value.length}/{maxLen} {lang === 'tr' ? 'hane' : 'digits'}
        </div>
      )}
    </div>
  );
}

// Küçük satır-içi onay ikonu — hane sayacı tamamlanınca (ui-components'teki AIcon'a
// bağımlı olmamak için burada minimal bir SVG, PhoneField dışında kullanılmıyor).
function AIconInline({ name }) {
  if (name !== 'check') return null;
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function JoinPage({ navigate, projectId }) {
  const { lang, t } = useLang();
  const { startups } = useStartups();
  const [submitted, setSubmitted] = useStateOP(false);
  const [submittedType, setSubmittedType] = useStateOP('community');
  const [submittedSide, setSubmittedSide] = useStateOP('hub');   // 'hub' | 'lab' → bitiş ekranındaki bağlantı kartları
  const [submitting, setSubmitting] = useStateOP(false);
  const [submitError, setSubmitError] = useStateOP('');
  const [invalidFields, setInvalidFields] = useStateOP(new Set());

  // Panelden düzenlenebilir katılım formu metinleri — yüklenene kadar / boşsa
  // sabit çeviriler (t()) kullanılır, hiçbir zaman boş görünmez.
  const [formSettings, setFormSettings] = useStateOP(null);
  const [siteLinks, setSiteLinks] = useStateOP({});   // Site Ayarları'ndaki Instagram / şirket LinkedIn (yedek)
  useEffectOP(() => {
    supabase.from('join_form_settings').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setFormSettings(data); })
      .catch(() => {});
    supabase.from('site_settings').select('instagram_url, company_linkedin').eq('id', 1).single()
      .then(({ data }) => { if (data) setSiteLinks(data); })
      .catch(() => {});
  }, []);
  const fs = (key, fallback) => (formSettings && formSettings[key]) || fallback;
  const fl = (key, fallback) => (formSettings?.field_labels && formSettings.field_labels[key]) || fallback;

  const project = projectId ? startups.find(s => s.id === projectId || s.slug === projectId) : null;
  const savedRole = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sh_join_role') : null;

  // Genel "Katıl" düğmesi (üstteki nav, footer, hero) hiçbir tip belirtmeden bu sayfaya
  // gelir — bu durumda varsayılan olarak Topluluğa Katıl kartı + HUB (topluluk) tarafı
  // zaten açık gelsin diye ikisi de "community" ile başlar. Bir önceki oturumdan kalan
  // seçim (sayfa yenilenmesi) veya proje deep-link'i her zaman bu varsayılanın önündedir.
  const initialType = (() => {
    if (project) return 'community';
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem('sh_join_type');
      if (s === 'community' || s === 'mentor' || s === 'sponsor') return s;
    }
    return 'community';
  })();

  const [joinType, setJoinType] = useStateOP(initialType);
  // Topluluk mu, startup mı? (kartın altındaki iki seçenek) — seçilmeden form açılmaz.
  const [joinTarget, setJoinTarget] = useStateOP(() => {
    try {
      const v = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sh_join_target') : null;
      if ((v === 'community' || v === 'startup') && initialType) return v;
    } catch { /* yok say */ }
    // Deep-link/proje bağlamı yokken (genel "Katıl") varsayılan HUB tarafı açık gelsin.
    return (!project && initialType === 'community') ? 'community' : null;
  });
  const [fxTick, setFxTick] = useStateOP(0); // her kart tıklamasında artar → animasyon yeniden başlar

  const [communityForm, setCommunityForm] = useStateOP({
    name: '', email: '', university: '', department: '', role: '',
    phone: '', phoneCC: '90', unit: '',   // HUB tarafı: telefon (+ülke kodu) + ekip birimi
    interest: '',          // LAB tarafı: ilgi alanı (JOIN_INTERESTS anahtarı)
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
  // Sayfa yenilenip hedef sessionStorage'dan geri gelirse niyet (intent) de hedefle uyumlu olsun.
  useEffectOP(() => {
    if (!joinTarget || project) return;
    const ok = joinTarget === 'startup' ? ['project', 'idea_application', 'pool_match'] : ['community', 'hub'];
    setCommunityForm(p => (ok.includes(p.intent) ? p : { ...p, intent: joinTarget === 'startup' ? 'project' : 'community' }));
  }, [joinTarget]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mentorForm, setMentorForm] = useStateOP({
    name: '', email: '', phone: '', phoneCC: '90', expertise: '', experience_years: '',
    current_company: '', hours_per_week: '', linkedin: '', mentor_note: '',
    projectId: '',   // hedef startup olan mentörlükte (opsiyonel)
  });
  const [sponsorForm, setSponsorForm] = useStateOP({
    contact_name: '', email: '', phone: '', phoneCC: '90', company: '', website: '',
    collab_types: [], sponsor_message: '',
    projectId: '',   // hedef startup olan desteklerde (opsiyonel) — telefon da opsiyonel
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

  // Kart tıklanınca sayfa KAYDIRILMAZ (kartın animasyonu görünür kalsın); form kartların altında açılır.
  const selectType = (type) => {
    if (type !== joinType) {           // kart değişince önceki "topluluk/startup" seçimi geçersiz
      setJoinTarget(null);
      try { sessionStorage.removeItem('sh_join_target'); } catch { /* yok say */ }
    }
    setJoinType(type);
    setFxTick(t => t + 1);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('sh_join_type', type);
  };

  const pickTarget = (target) => {
    setJoinTarget(target);
    try { sessionStorage.setItem('sh_join_target', target); } catch { /* yok say */ }
    if (target === joinTarget) return;
    // Seçime göre alan varsayılanları: topluluk → 'community'; startup → 'project'.
    setCommunityForm(p => {
      const ok = target === 'startup' ? ['project', 'idea_application', 'pool_match'] : ['community', 'hub'];
      return ok.includes(p.intent) ? p : { ...p, intent: target === 'startup' ? 'project' : 'community' };
    });
    setSponsorForm(p => ({ ...p, collab_types: [], projectId: '' }));   // seçenek listeleri farklı
    setMentorForm(p => ({ ...p, projectId: '' }));
  };

  const clearProject = () => {
    sessionStorage.removeItem('sh_join_role');
    sessionStorage.removeItem('sh_join_type');
    sessionStorage.removeItem('sh_join_target');
    navigate('join');
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = (activeType) => {
    const missing = [];
    const check = (ok, field, label) => { if (!ok) missing.push([field, label]); };
    if (activeType === 'mentor') {
      check(mentorForm.name.trim(), 'name', lang === 'tr' ? 'Ad Soyad' : 'Full Name');
      check(mentorForm.email.trim(), 'email', lang === 'tr' ? 'E-posta' : 'Email');
      check(mentorForm.phone.trim(), 'phone', lang === 'tr' ? 'Telefon' : 'Phone');
    } else if (activeType === 'sponsor') {
      check(sponsorForm.contact_name.trim(), 'contact_name', lang === 'tr' ? 'İletişim Kişisi' : 'Contact Name');
      check(sponsorForm.email.trim(), 'email', lang === 'tr' ? 'E-posta' : 'Email');
      // Telefon burada BİLEREK opsiyonel — destekçiler vermek istemeyebilir.
    } else {
      check(communityForm.name.trim(), 'name', lang === 'tr' ? 'Ad Soyad' : 'Full Name');
      check(communityForm.email.trim(), 'email', lang === 'tr' ? 'E-posta' : 'Email');
      check(communityForm.phone.trim(), 'phone', lang === 'tr' ? 'Telefon' : 'Phone');
      if (!project && communityForm.intent === 'idea_application') {
        check(communityForm.pitch.trim(), 'pitch', lang === 'tr' ? 'Fikrin' : 'Your idea');
      }
      if (!project && communityForm.intent === 'hub') check(communityForm.unit, 'unit', lang === 'tr' ? 'Birim' : 'Unit');
      if (!project && ['pool_match', 'project'].includes(communityForm.intent)) {
        check(communityForm.interest, 'interest', lang === 'tr' ? 'İlgi alanı' : 'Area of interest');
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
    const phoneVal = activeType === 'mentor' ? mentorForm.phone : activeType === 'sponsor' ? sponsorForm.phone : communityForm.phone;
    const phoneCcVal = activeType === 'mentor' ? mentorForm.phoneCC : activeType === 'sponsor' ? sponsorForm.phoneCC : communityForm.phoneCC;
    if (phoneVal.trim()) {
      const digits = phoneLocalDigits(phoneVal);
      const knownCc = Object.prototype.hasOwnProperty.call(COUNTRY_PHONE_LEN, phoneCcVal);
      // Listedeki bir ülke kodu seçiliyse o ülkenin tam hane sayısı aranır (fazla/eksik
      // yazma önlenmiş oluyor — arayüz zaten yazarken bu sayıyı aşırtmıyor). "Diğer
      // ülke" için (kodu bilmediğimiz için) yalnızca makul bir aralık (6–13 hane) kontrol edilir.
      const lenOk = knownCc ? digits.length === COUNTRY_PHONE_LEN[phoneCcVal] : digits.length >= 6 && digits.length <= DEFAULT_PHONE_MAX;
      if (!phoneCcVal.trim() || !lenOk) {
        setInvalidFields(new Set(['phone']));
        return lang === 'tr' ? 'Lütfen geçerli bir ülke kodu ve telefon numarası girin.' : 'Please enter a valid country code and phone number.';
      }
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
      const findStartup = (id) => (id ? startups.find(x => String(x.id) === String(id)) : null);
      if (activeType === 'mentor') {
        const mProject = joinTarget === 'startup' ? findStartup(mentorForm.projectId) : null;
        insertData = {
          target: joinTarget === 'startup' ? 'startup' : 'community',
          project_id: mProject?.id || null, project_name: mProject?.name || null,
          name: mentorForm.name, email: mentorForm.email,
          phone: mentorForm.phone ? '+' + (mentorForm.phoneCC || '90') + mentorForm.phone : null,
          expertise: mentorForm.expertise || null,
          experience_years: mentorForm.experience_years || null,
          company: mentorForm.current_company || null,
          weekly_hours: mentorForm.hours_per_week || null,
          linkedin_url: mentorForm.linkedin || null,
          bio: mentorForm.mentor_note || null,
          intent: 'mentor_application',
        };
      } else if (activeType === 'sponsor') {
        const sProject = joinTarget === 'startup' ? findStartup(sponsorForm.projectId) : null;
        insertData = {
          target: joinTarget === 'startup' ? 'startup' : 'community',
          project_id: sProject?.id || null, project_name: sProject?.name || null,
          name: sponsorForm.contact_name, email: sponsorForm.email,
          phone: sponsorForm.phone ? '+' + (sponsorForm.phoneCC || '90') + sponsorForm.phone : null,
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
          target: (project || ['project', 'founder_lead', 'idea_application', 'pool_match'].includes(communityForm.intent)) ? 'startup' : 'community',
          phone: communityForm.phone ? '+' + (communityForm.phoneCC || '90') + communityForm.phone : null,
          name: communityForm.name, email: communityForm.email,
          university: communityForm.university || null,
          department: communityForm.department || null,
          // Proje sayfasından belirli bir pozisyona tıklanarak gelindiyse
          // (savedRole), o daha spesifik bilgi genel kategori seçiminden
          // önceliklidir — tıklanan pozisyon adı artık kayboluyordu.
          role: communityForm.intent === 'hub' ? (communityForm.unit || null) : (savedRole || communityForm.role || null),
          ...(project || ['project', 'pool_match'].includes(communityForm.intent) ? { interest: communityForm.interest || null } : {}),
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
      setSubmittedSide(project || joinTarget === 'startup' ? 'lab' : 'hub');
      setSubmitted(true);
      if (typeof sessionStorage !== 'undefined') { sessionStorage.removeItem('sh_join_type'); sessionStorage.removeItem('sh_join_target'); }
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

    // Başvuru bitince tarafa göre iki bağlantı kartı (admin panel → Site Ayarları → Katılım Formu):
    //   HUB (topluluk): WhatsApp grubu + Instagram   ·   LAB (startup): WhatsApp grubu + LinkedIn
    // Boş bağlantının kartı gösterilmez; Instagram / LinkedIn boşsa Site Ayarları'ndaki adres yedektir.
    const isHub = submittedSide === 'hub';
    const tr = lang === 'tr';
    const waUrl = externalUrl(fs(isHub ? 'hub_whatsapp_url' : 'lab_whatsapp_url', ''));
    const secondUrl = externalUrl(isHub
      ? (fs('hub_instagram_url', '') || siteLinks.instagram_url)
      : (fs('lab_linkedin_url', '') || siteLinks.company_linkedin));
    const successNote = tr ? fs(isHub ? 'hub_success_note_tr' : 'lab_success_note_tr', '') : '';
    const linkCards = [];
    if (waUrl) linkCards.push({
      kind: 'whatsapp', icon: 'whatsapp', href: waUrl,
      title: isHub ? (tr ? 'WhatsApp Topluluk Grubu' : 'WhatsApp Community Group') : (tr ? 'WhatsApp Lab Grubu' : 'WhatsApp Lab Group'),
      desc: isHub ? (tr ? 'Duyurular ve sohbet için gruba katıl' : 'Join for announcements and chat') : (tr ? 'Startup ekipleri ve kurucularla tanış' : 'Meet startup teams and founders'),
    });
    if (secondUrl) linkCards.push(isHub
      ? { kind: 'instagram', icon: 'instagram', href: secondUrl, title: 'Instagram', desc: tr ? 'Etkinlikleri ve topluluk hayatını takip et' : 'Follow events and community life' }
      : { kind: 'linkedin', icon: 'linkedin', href: secondUrl, title: 'LinkedIn', desc: tr ? 'Sayfamızı takip et, ağını büyüt' : 'Follow our page and grow your network' });

    return (
      <div className="page-transition">
        <div className="jdone-wrap">
          <div className={`jdone jdone--${submittedSide}`}>
            <div className="jdone__ring"><Icon name="check" size={40} /></div>
            <h2 className="text-h2" style={{ marginBottom: 12 }}>{copy.title}</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto' }}>{copy.desc}</p>
            {successNote && <div className="jdone__note">{successNote}</div>}
            {linkCards.length > 0 && (
              <>
                <div className="jdone__label">
                  <span className="jdone__pill">{isHub ? 'HUB' : 'LAB'}</span>
                  {tr ? 'Bizimle bağlantıda kal' : 'Stay connected with us'}
                </div>
                <div className="jdone__cards">
                  {linkCards.map((k, i) => (
                    <a key={k.kind} className={`jlink jlink--${k.kind}`} style={{ '--i': i }} href={k.href} target="_blank" rel="noreferrer">
                      <span className="jlink__icon"><Icon name={k.icon} size={24} /></span>
                      <span className="jlink__body">
                        <span className="jlink__title">{k.title}</span>
                        <span className="jlink__desc">{k.desc}</span>
                      </span>
                      <Icon name="arrowUpRight" size={18} className="jlink__go" />
                    </a>
                  ))}
                </div>
              </>
            )}
            <div style={{ marginTop: 34 }}>
              <Button variant="secondary" onClick={() => { navigate('home'); window.scrollTo({ top: 0 }); }}>{t('nav.home')}</Button>
            </div>
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

  // Destek türleri seçilen hedefe göre değişir (topluluk: etkinlik/mekân; startup: yatırım/staj).
  const collabOptions = joinTarget === 'startup'
    ? (lang === 'tr'
      ? ['Yatırım', 'Finansal Destek', 'Mentorluk', 'Staj İmkanı', 'Ürün / Hizmet Desteği', 'Diğer']
      : ['Investment', 'Financial Support', 'Mentorship', 'Internship', 'Product / Service', 'Other'])
    : (lang === 'tr'
      ? ['Etkinlik Sponsorluğu', 'Finansal Destek', 'Mekan / Ekipman', 'Ürün / Hizmet Desteği', 'Mentorluk', 'Diğer']
      : ['Event Sponsorship', 'Financial Support', 'Venue / Equipment', 'Product / Service', 'Mentorship', 'Other']);

  // Startup seçimi (mentör / destekçi formları): yayındaki startup'lar; boş = henüz belirli değil.
  const startupPick = (value, onChange, label) => (
    <div className="form-group">
      <label className="form-label">{label} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({lang === 'tr' ? 'opsiyonel' : 'optional'})</span></label>
      <select className="form-input form-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{lang === 'tr' ? 'Henüz belirli bir startup yok / birden fazlası' : 'No specific startup yet / several'}</option>
        {startups.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
    </div>
  );

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
                    {active && <CardFx key={fxTick} type={card.key} />}
                    <div className="jt-body">
                      <div className="jt-emo" key={active ? fxTick : 'off'}><span className="jt-glyph">{card.emoji}</span>{active && <EmojiFx type={card.key} />}</div>
                      <div className="jt-title">{card.title}</div>
                      <p className="jt-desc">{card.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Kartın altında: Topluluk mu, Startup mı? (seçilmeden form açılmaz) */}
          {!project && joinType && (
            <TargetPicker type={joinType} value={joinTarget} onPick={pickTarget} intent={communityForm.intent} onIntent={(k) => handleC('intent', k)} lang={lang} />
          )}

          {projectContextCard}
          {roleDescCard}

          {/* Forms — appear after type + target selection */}
          {(project || (joinType && joinTarget)) && (
            <div id="join-form-section">

              {/* COMMUNITY FORM */}
              {(joinType === 'community' || project) && (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('c_name', t('join.name'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input name="name" autoComplete="name" className={`form-input${invalidFields.has('name') ? ' form-input--invalid' : ''}`} value={communityForm.name} onChange={e => handleC('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('c_email', t('join.email'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input type="email" name="email" autoComplete="email" className={`form-input${invalidFields.has('email') ? ' form-input--invalid' : ''}`} value={communityForm.email} onChange={e => handleC('email', e.target.value)} />
                    </div>
                  </div>
                  <PhoneField value={communityForm.phone} onChange={v => handleC('phone', v)} ccValue={communityForm.phoneCC} onCcChange={v => handleC('phoneCC', v)} invalid={invalidFields.has('phone')} lang={lang} required />
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('c_university', t('join.university'))}</label>
                      <input name="organization" autoComplete="organization" className="form-input" value={communityForm.university} onChange={e => handleC('university', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('c_department', t('join.department'))}</label>
                      <input className="form-input" value={communityForm.department} onChange={e => handleC('department', e.target.value)} />
                    </div>
                  </div>
                  {!project && ['community', 'hub'].includes(communityForm.intent) && (
                    <div className="form-group">
                      <label className="form-label">{lang === 'tr' ? 'Kısa Bio' : 'Short Bio'} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({lang === 'tr' ? 'opsiyonel' : 'optional'})</span></label>
                      <textarea className="form-input" placeholder={t('join.bioPlaceholder')} value={communityForm.bio} onChange={e => handleC('bio', e.target.value)} />
                    </div>
                  )}
                  {/* "Nasıl yer almak istersin?" seçimi kartların altındaki TargetPicker'da */}

                  {/* Ekipte yer almak: birim seçimi (yetenek/GitHub/LinkedIn sorulmaz — onlar Lab'a özel) */}
                  {!project && communityForm.intent === 'hub' && (
                    <div className="form-group">
                      <label className="form-label">{lang === 'tr' ? 'Hangi birimde yer almak istiyorsun?' : 'Which unit do you want to join?'} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <div className={`jchips${invalidFields.has('unit') ? ' jchips--invalid' : ''}`} role="radiogroup" style={{ '--jt-c': JT_COLOR.community }}>
                        {HUB_UNITS.map(u => (
                          <button key={u.tr} type="button" role="radio" aria-checked={communityForm.unit === u.tr}
                            className={`jchip${communityForm.unit === u.tr ? ' jchip--on' : ''}`} onClick={() => handleC('unit', u.tr)}>
                            {lang === 'tr' ? u.tr : u.en}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const picked = HUB_UNITS.find(u => u.tr === communityForm.unit);
                        return picked && (
                          <p key={picked.tr} className="jchips__desc">{lang === 'tr' ? picked.descTr : picked.descEn}</p>
                        );
                      })()}
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
                            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>{lang === 'tr' ? 'Projede açık bir liderlik pozisyonu varsa buradan seçebilirsin.' : 'If the project has an open leadership role, you can pick it here.'}</p>
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
                        <input name="url" autoComplete="url" className="form-input" placeholder="linkedin.com/in/..." value={communityForm.linkedin} onChange={e => handleC('linkedin', e.target.value)} />
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

                  {/* Proje havuzu (ve deep-link proje bağlamı) — İlgi Alanı; HUB tarafında (topluluk/ekip) sorulmaz */}
                  {!project && communityForm.intent === 'pool_match' && (
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 18 }}>
                      {lang === 'tr'
                        ? 'Proje havuzuna ekleniyorsun. Bir projede senin ilgi alanına ve yeteneklerine uygun yer açıldığında seninle iletişime geçeceğiz.'
                        : 'You will be added to the project pool. When a project has a spot that fits your interests and skills, we will contact you.'}
                    </p>
                  )}
                  {(project || ['pool_match', 'project'].includes(communityForm.intent)) && (
                    <div className="form-group">
                      <label className="form-label">{fl('c_role', t('join.role'))}{!project
                        ? <> <span style={{ color: 'var(--red, #DC2626)' }}>*</span></>
                        : <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> ({lang === 'tr' ? 'opsiyonel' : 'optional'})</span>}</label>
                      <select className={`form-input form-select${invalidFields.has('interest') ? ' form-input--invalid' : ''}`} value={communityForm.interest} onChange={e => handleC('interest', e.target.value)}>
                        <option value="">—</option>
                        {JOIN_INTERESTS.map(o => <option key={o.key} value={o.key}>{lang === 'tr' ? o.tr : o.en}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Bio/Yetenekler/Linkler — yalnızca Lab kolları (proje / proje havuzu); HUB tarafında sorulmaz */}
                  {(project || ['project', 'pool_match'].includes(communityForm.intent)) && (
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
                          <input name="url" autoComplete="url" className="form-input" placeholder="linkedin.com/in/..." value={communityForm.linkedin} onChange={e => handleC('linkedin', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{fl('c_portfolio', t('join.portfolio'))}</label>
                          <input name="portfolio-url" autoComplete="url" className="form-input" placeholder="github.com/..." value={communityForm.portfolio} onChange={e => handleC('portfolio', e.target.value)} />
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
                      <input name="name" autoComplete="name" className={`form-input${invalidFields.has('name') ? ' form-input--invalid' : ''}`} value={mentorForm.name} onChange={e => handleM('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('m_email', t('join.email'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input type="email" name="email" autoComplete="email" className={`form-input${invalidFields.has('email') ? ' form-input--invalid' : ''}`} value={mentorForm.email} onChange={e => handleM('email', e.target.value)} />
                    </div>
                  </div>
                  <PhoneField value={mentorForm.phone} onChange={v => handleM('phone', v)} ccValue={mentorForm.phoneCC} onCcChange={v => handleM('phoneCC', v)} invalid={invalidFields.has('phone')} lang={lang} required />
                  {joinTarget === 'startup'
                    ? startupPick(mentorForm.projectId, v => handleM('projectId', v), lang === 'tr' ? "Hangi startup'a mentörlük yapmak istersin?" : 'Which startup do you want to mentor?')
                    : <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 18 }}>
                        {lang === 'tr' ? 'Topluluğun destekçi mentörü olarak etkinliklerde, atölyelerde ve buluşmalarda üyelere rehberlik edeceksin.' : 'As a supporting mentor of the community, you will guide members at events, workshops and meetups.'}
                      </p>}
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
                    <input name="organization" autoComplete="organization" className="form-input" value={mentorForm.current_company} onChange={e => handleM('current_company', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{fl('m_linkedin', 'LinkedIn')}</label>
                    <input name="url" autoComplete="url" className="form-input" placeholder="linkedin.com/in/..." value={mentorForm.linkedin} onChange={e => handleM('linkedin', e.target.value)} />
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
                      <input name="name" autoComplete="name" className={`form-input${invalidFields.has('contact_name') ? ' form-input--invalid' : ''}`} value={sponsorForm.contact_name} onChange={e => handleS('contact_name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('s_email', t('join.email'))} <span style={{ color: 'var(--red, #DC2626)' }}>*</span></label>
                      <input type="email" name="email" autoComplete="email" className={`form-input${invalidFields.has('email') ? ' form-input--invalid' : ''}`} value={sponsorForm.email} onChange={e => handleS('email', e.target.value)} />
                    </div>
                  </div>
                  <PhoneField value={sponsorForm.phone} onChange={v => handleS('phone', v)} ccValue={sponsorForm.phoneCC} onCcChange={v => handleS('phoneCC', v)} invalid={invalidFields.has('phone')} lang={lang} />
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label className="form-label">{fl('s_company', lang === 'tr' ? 'Şirket / Kurum Adı' : 'Company / Organization')}</label>
                      <input name="organization" autoComplete="organization" className="form-input" value={sponsorForm.company} onChange={e => handleS('company', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{fl('s_website', lang === 'tr' ? 'Web Sitesi' : 'Website')}</label>
                      <input name="url" autoComplete="url" className="form-input" placeholder="https://..." value={sponsorForm.website} onChange={e => handleS('website', e.target.value)} />
                    </div>
                  </div>
                  {joinTarget === 'startup'
                    ? startupPick(sponsorForm.projectId, v => handleS('projectId', v), lang === 'tr' ? "Hangi startup'a yatırım / kaynak sağlamak istersin?" : 'Which startup do you want to invest in / resource?')
                    : <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 18 }}>
                        {lang === 'tr' ? 'Topluluğun etkinliklerine, ekiplerine ve faaliyetlerine sponsor olarak katkı sağlayabilirsin.' : 'You will contribute as a sponsor to the community\'s events, teams and activities.'}
                      </p>}
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
