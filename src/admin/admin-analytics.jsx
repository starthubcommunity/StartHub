// admin-analytics.jsx — Yazı okuma metrikleri: görüntülenme, benzersiz/geri dönen ziyaretçi,
// okuma süresi, tamamlanma oranı, sıçrama oranı, zaman içi trend, kategori/kaynak/cihaz/
// trafik kaynağı kırılımları, okuma derinliği dağılımı ve yazı bazlı etkileşim skoru.
import React, { useState, useEffect, useMemo } from 'react';
import { useAdmin } from './admin-store';
import { AIcon, StatCard, PageHead } from './admin-ui';
import { supabase } from '../lib/supabase';

const SETUP_SQL = `create table if not exists post_views (
  id bigint generated always as identity primary key,
  post_slug text not null,
  session_id text not null,
  visitor_id text,
  lang text,
  referrer_type text,
  device_type text,
  entered_at timestamptz not null default now(),
  duration_seconds int,
  max_scroll_pct int
);
create index if not exists post_views_slug_idx on post_views(post_slug);

-- Zaten "post_views" tablonuz varsa (eski surum), sadece yeni kolonlari ekler:
alter table post_views add column if not exists visitor_id text;
alter table post_views add column if not exists referrer_type text;
alter table post_views add column if not exists device_type text;

alter table post_views enable row level security;
drop policy if exists "public insert" on post_views;
create policy "public insert" on post_views
  for insert to anon, authenticated with check (true);
drop policy if exists "public update" on post_views;
create policy "public update" on post_views
  for update to anon, authenticated using (true) with check (true);
drop policy if exists "auth read" on post_views;
create policy "auth read" on post_views
  for select to authenticated using (true);`;

const TAG_LABELS = { blog: 'Günlük', gundem: 'Gündem', etkinlik: 'Etkinlik' };
const REFERRER_LABELS = { direct: 'Direkt', internal: 'Site İçi', search: 'Arama Motoru', social: 'Sosyal Medya', other: 'Diğer' };
const REFERRER_COLORS = { direct: '#2563EB', internal: '#16A34A', search: '#EA580C', social: '#7C3AED', other: '#DC2626' };
const DEVICE_LABELS = { desktop: 'Masaüstü', mobile: 'Mobil' };
const DEVICE_COLORS = { desktop: '#2563EB', mobile: '#16A34A' };
const BLUE = '#2563EB';

const fmtDuration = (s) => {
  if (s == null || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}dk ${sec}sn` : `${sec}sn`;
};
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const dateKey = (iso) => (iso || '').slice(0, 10);

function last30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ── Yatay çubuk listesi: tek renk, büyüklük sıralaması (kategori/kaynak/rank) ──
function BarList({ items, color = BLUE, formatValue }) {
  if (items.length === 0) return <p style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz veri yok.</p>;
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(it => (
        <div key={it.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 64px', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.label}>
            {it.label}
          </span>
          <div style={{ height: 14, background: 'var(--adm-border-light)', borderRadius: 7, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(3, (it.value / max) * 100)}%`, height: '100%', background: it.color || color, borderRadius: 7 }} />
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {formatValue ? formatValue(it.value) : it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Kategorik kırılım: birden fazla kimlik, sabit renk sırası + doğrudan yüzde etiketi ──
function CategoricalBreakdown({ items }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  if (total === 0) return <p style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>Henüz veri yok.</p>;
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
        {items.map(it => (
          <div key={it.label} style={{ width: `${Math.max(2, (it.value / total) * 100)}%`, background: it.color }} title={`${it.label}: %${pct(it.value, total)}`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(it => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--adm-text-secondary)', flex: 1 }}>{it.label}</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>%{pct(it.value, total)}</span>
            <span style={{ color: 'var(--adm-text-dim)', fontSize: 12, width: 44, textAlign: 'right' }}>({it.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Zaman içinde görüntülenme: tek seri alan+çizgi grafiği ──
function TrendChart({ data, color = BLUE }) {
  const w = 100, h = 36;
  const max = Math.max(1, ...data.map(d => d.value));
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data.map((d, i) => [i * stepX, h - (d.value / max) * (h - 4) - 2]);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const area = `${line} L${points[points.length - 1][0].toFixed(2)},${h} L0,${h} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 140, display: 'block' }}>
        <line x1="0" y1={h - 2} x2={w} y2={h - 2} stroke="var(--adm-border-light)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={color} opacity="0.1" stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="1.3" fill={color} vectorEffect="non-scaling-stroke">
            <title>{`${data[i].date}: ${data[i].value} görüntülenme`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--adm-text-dim)', marginTop: 4 }}>
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ── Okuma derinliği dağılımı: sıralı (histogram) dikey çubuklar ──
function DepthHistogram({ buckets, color = BLUE }) {
  const max = Math.max(1, ...buckets.map(b => b.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 120, padding: '0 4px' }}>
      {buckets.map(b => (
        <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--adm-text-secondary)' }}>{b.count}</span>
          <div style={{ width: '100%', maxWidth: 44, height: `${Math.max(4, (b.count / max) * 84)}px`, background: color, borderRadius: '6px 6px 2px 2px', transition: 'height 0.3s' }} />
          <span style={{ fontSize: 11, color: 'var(--adm-text-dim)' }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

const SORT_OPTIONS = [
  { key: 'views',      label: 'Görüntülenme' },
  { key: 'uniqueVisitors', label: 'Benzersiz Ziyaretçi' },
  { key: 'avgDuration', label: 'Ort. Süre' },
  { key: 'completionRate', label: 'Tamamlama' },
  { key: 'engagementScore', label: 'Etkileşim Skoru' },
];

function AnalyticsPage() {
  const { data } = useAdmin();
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [sortKey, setSortKey] = useState('views');

  useEffect(() => {
    supabase.from('post_views').select('*').then(({ data, error: e }) => {
      if (e) setError(e.message);
      else setRows(data || []);
      setLoading(false);
    });
  }, []);

  const agg = useMemo(() => {
    if (!rows.length) return null;

    // Genel bakış
    const visitorSessions = new Map();
    rows.forEach(r => {
      if (!r.visitor_id) return;
      if (!visitorSessions.has(r.visitor_id)) visitorSessions.set(r.visitor_id, new Set());
      visitorSessions.get(r.visitor_id).add(r.session_id);
    });
    const uniqueVisitors = visitorSessions.size;
    const returningVisitors = [...visitorSessions.values()].filter(s => s.size > 1).length;
    const withDuration = rows.filter(r => r.duration_seconds != null);
    const avgDurationSite = withDuration.length ? withDuration.reduce((a, r) => a + r.duration_seconds, 0) / withDuration.length : null;
    const withScroll = rows.filter(r => r.max_scroll_pct != null);
    const avgCompletionSite = withScroll.length ? withScroll.reduce((a, r) => a + r.max_scroll_pct, 0) / withScroll.length : null;
    const bounces = withDuration.filter(r => r.duration_seconds < 10).length;
    const bounceRate = withDuration.length ? pct(bounces, withDuration.length) : null;

    // Zaman içinde (son 30 gün)
    const days = last30Days();
    const dayCounts = {};
    rows.forEach(r => { const k = dateKey(r.entered_at); dayCounts[k] = (dayCounts[k] || 0) + 1; });
    const dailyViews = days.map(d => ({ date: d.slice(5), value: dayCounts[d] || 0 }));

    // Yazı başına post bilgisi
    const postBySlug = {};
    data.posts.forEach(p => { postBySlug[p.slug] = p; });

    // Kategori (tag) ve kaynak (source) kırılımı
    const tagCounts = {};
    const sourceCounts = {};
    rows.forEach(r => {
      const post = postBySlug[r.post_slug];
      const tag = post?.tag ? (TAG_LABELS[post.tag] || post.tag) : 'Bilinmiyor';
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      const src = post?.source?.name || null;
      if (src) sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });
    const byTag = Object.entries(tagCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const bySource = Object.entries(sourceCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    // Cihaz ve trafik kaynağı
    const deviceCounts = {};
    const refCounts = {};
    rows.forEach(r => {
      const d = r.device_type || 'desktop';
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
      const rt = r.referrer_type || 'direct';
      refCounts[rt] = (refCounts[rt] || 0) + 1;
    });
    const byDevice = Object.entries(deviceCounts).map(([key, value]) => ({ label: DEVICE_LABELS[key] || key, value, color: DEVICE_COLORS[key] || '#64748B' }));
    const byReferrer = Object.entries(refCounts).map(([key, value]) => ({ label: REFERRER_LABELS[key] || key, value, color: REFERRER_COLORS[key] || '#64748B' }))
      .sort((a, b) => b.value - a.value);

    // Okuma derinliği dağılımı
    const buckets = [
      { label: '0–25%',  min: 0,  max: 25 },
      { label: '25–50%', min: 25, max: 50 },
      { label: '50–75%', min: 50, max: 75 },
      { label: '75–100%', min: 75, max: 101 },
    ].map(b => ({ label: b.label, count: withScroll.filter(r => r.max_scroll_pct >= b.min && r.max_scroll_pct < b.max).length }));

    // Yazı bazlı istatistikler
    const bySlug = {};
    rows.forEach(r => {
      const key = r.post_slug;
      if (!bySlug[key]) bySlug[key] = { slug: key, views: 0, sessions: new Set(), visitors: new Set(), durations: [], scrolls: [] };
      const g = bySlug[key];
      g.views += 1;
      g.sessions.add(r.session_id);
      if (r.visitor_id) g.visitors.add(r.visitor_id);
      if (r.duration_seconds != null) g.durations.push(r.duration_seconds);
      if (r.max_scroll_pct != null) g.scrolls.push(r.max_scroll_pct);
    });
    const postStats = Object.values(bySlug).map(g => {
      const post = postBySlug[g.slug];
      const avgDuration = g.durations.length ? g.durations.reduce((a, b) => a + b, 0) / g.durations.length : null;
      const completionRate = g.scrolls.length ? Math.round(g.scrolls.reduce((a, b) => a + b, 0) / g.scrolls.length) : null;
      const bouncesPost = g.durations.filter(d => d < 10).length;
      const bounceRatePost = g.durations.length ? pct(bouncesPost, g.durations.length) : null;
      const durationScore = avgDuration != null ? Math.min(100, (avgDuration / 120) * 100) : 0;
      const engagementScore = Math.round(((completionRate || 0) + durationScore) / 2);
      return {
        slug: g.slug,
        title: post ? post.title_tr : g.slug,
        tag: post?.tag ? (TAG_LABELS[post.tag] || post.tag) : '—',
        source: post?.source?.name || '—',
        views: g.views,
        uniqueVisitors: g.visitors.size || g.sessions.size,
        avgDuration,
        completionRate,
        bounceRate: bounceRatePost,
        engagementScore,
      };
    });

    return {
      uniqueVisitors, returningVisitors, returningRate: pct(returningVisitors, uniqueVisitors),
      avgDurationSite, avgCompletionSite, bounceRate,
      dailyViews, byTag, bySource, byDevice, byReferrer, scrollBuckets: buckets,
      postStats,
    };
  }, [rows, data.posts]);

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--adm-text-dim)', fontSize: 14 }}>Yükleniyor…</div>;
  }

  if (error) {
    return (
      <div>
        <PageHead title="Analitik" desc="Yazı okuma metrikleri: görüntülenme, ziyaretçi, okuma süresi, tamamlanma, trafik kaynağı ve daha fazlası." />
        <div className="adm-card">
          <div className="adm-card__body">
            <p style={{ color: 'var(--adm-red)', marginBottom: 12, fontSize: 14 }}>Metrik tablosu bulunamadı: {error}</p>
            <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 12 }}>
              Aşağıdaki SQL'i Supabase SQL Editor'de bir kez çalıştırın, sonra sayfayı yenileyin.
            </p>
            <pre style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', background: 'var(--adm-bg)', borderRadius: 8, padding: 14, overflowX: 'auto', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{SETUP_SQL}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (!agg) {
    return (
      <div>
        <PageHead title="Analitik" desc="Yazı okuma metrikleri: görüntülenme, ziyaretçi, okuma süresi, tamamlanma, trafik kaynağı ve daha fazlası." />
        <div className="adm-card">
          <div className="adm-empty" style={{ padding: '32px 24px', textAlign: 'center' }}>
            <AIcon name="trendingUp" size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
            <p style={{ color: 'var(--adm-text-dim)' }}>Henüz veri yok — yazılar ziyaret edildikçe burada birikecek.</p>
          </div>
        </div>
      </div>
    );
  }

  const sortedPosts = [...agg.postStats].sort((a, b) => (b[sortKey] ?? -1) - (a[sortKey] ?? -1));
  const totalViews = rows.length;

  return (
    <div>
      <PageHead title="Analitik" desc="Yazı okuma metrikleri: görüntülenme, ziyaretçi, okuma süresi, tamamlanma, trafik kaynağı ve daha fazlası." />

      {/* Genel Bakış */}
      <div className="adm-statctl-grid" style={{ marginBottom: 24 }}>
        <StatCard icon="eye" label="Toplam Görüntülenme" value={totalViews} color="#2563EB" />
        <StatCard icon="users" label="Benzersiz Ziyaretçi" value={agg.uniqueVisitors} color="#16A34A"
          sub={`%${agg.returningRate} geri dönüyor`} />
        <StatCard icon="clock" label="Ort. Okuma Süresi" value={fmtDuration(agg.avgDurationSite)} color="#7C3AED" />
        <StatCard icon="trendingUp" label="Ort. Tamamlama" value={agg.avgCompletionSite != null ? `%${Math.round(agg.avgCompletionSite)}` : '—'} color="#EA580C" />
        <StatCard icon="x" label="Sıçrama Oranı" value={agg.bounceRate != null ? `%${agg.bounceRate}` : '—'} color="#DC2626"
          sub="10sn altı ziyaretler" />
      </div>

      {/* Zaman içinde görüntülenme */}
      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div className="adm-card__header"><h3>Son 30 Günde Görüntülenme</h3></div>
        <div className="adm-card__body">
          <TrendChart data={agg.dailyViews} />
        </div>
      </div>

      {/* Kategori + Kaynak + Derinlik */}
      <div className="adm-grid-2" style={{ gap: 16, marginBottom: 20 }}>
        <div className="adm-card">
          <div className="adm-card__header"><h3>İçerik Türüne Göre Görüntülenme</h3></div>
          <div className="adm-card__body">
            <BarList items={agg.byTag} />
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card__header">
            <h3>En Çok Okunan Kaynaklar</h3>
            <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', fontWeight: 400 }}>Otomasyonun haber aldığı yayınlar</span>
          </div>
          <div className="adm-card__body">
            <BarList items={agg.bySource} />
          </div>
        </div>
      </div>

      <div className="adm-grid-2" style={{ gap: 16, marginBottom: 20 }}>
        <div className="adm-card">
          <div className="adm-card__header"><h3>Cihaz &amp; Trafik Kaynağı</h3></div>
          <div className="adm-card__body">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Cihaz</div>
              <CategoricalBreakdown items={agg.byDevice} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Trafik Kaynağı</div>
              <CategoricalBreakdown items={agg.byReferrer} />
            </div>
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card__header">
            <h3>Okuma Derinliği Dağılımı</h3>
            <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', fontWeight: 400 }}>Sayfanın ne kadarı kaydırıldı</span>
          </div>
          <div className="adm-card__body">
            <DepthHistogram buckets={agg.scrollBuckets} />
          </div>
        </div>
      </div>

      {/* Yazı bazlı tablo */}
      <div className="adm-card">
        <div className="adm-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3>Yazı Bazlı Metrikler</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SORT_OPTIONS.map(o => (
              <button key={o.key} onClick={() => setSortKey(o.key)}
                style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${sortKey === o.key ? 'var(--adm-blue)' : 'var(--adm-border-light)'}`, background: sortKey === o.key ? 'var(--adm-blue-light)' : 'var(--adm-bg)', color: sortKey === o.key ? 'var(--adm-blue)' : 'var(--adm-text-dim)', fontSize: 12, fontWeight: sortKey === o.key ? 700 : 400, cursor: 'pointer' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="adm-card__body" style={{ padding: 0 }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Yazı</th>
                  <th>Tür</th>
                  <th>Kaynak</th>
                  <th>Görüntülenme</th>
                  <th>Benzersiz</th>
                  <th>Ort. Süre</th>
                  <th>Tamamlama</th>
                  <th>Sıçrama</th>
                  <th title="Tamamlama ve okuma süresinin birleşik skoru (0-100)">Etkileşim Skoru</th>
                </tr>
              </thead>
              <tbody>
                {sortedPosts.map(s => (
                  <tr key={s.slug}>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>/{s.slug}</div>
                    </td>
                    <td><span className="adm-badge adm-badge--tag">{s.tag}</span></td>
                    <td style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', whiteSpace: 'nowrap' }}>{s.source}</td>
                    <td style={{ fontWeight: 700 }}>{s.views}</td>
                    <td>{s.uniqueVisitors}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDuration(s.avgDuration)}</td>
                    <td>{s.completionRate != null ? `%${s.completionRate}` : '—'}</td>
                    <td style={{ color: s.bounceRate != null && s.bounceRate >= 50 ? 'var(--adm-red)' : 'var(--adm-text-secondary)' }}>
                      {s.bounceRate != null ? `%${s.bounceRate}` : '—'}
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: s.engagementScore >= 60 ? 'var(--adm-green)' : s.engagementScore >= 30 ? 'var(--adm-orange)' : 'var(--adm-red)' }}>
                        {s.engagementScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export { AnalyticsPage };
