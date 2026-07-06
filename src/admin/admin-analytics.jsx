// admin-analytics.jsx — Yazı okuma metrikleri (görüntülenme, benzersiz ziyaretçi, okuma süresi, tamamlanma)
import React, { useState, useEffect } from 'react';
import { useAdmin } from './admin-store';
import { AIcon, StatCard, PageHead } from './admin-ui';
import { supabase } from '../lib/supabase';

const SETUP_SQL = `create table if not exists post_views (
  id bigint generated always as identity primary key,
  post_slug text not null,
  session_id text not null,
  lang text,
  entered_at timestamptz not null default now(),
  duration_seconds int,
  max_scroll_pct int
);
create index if not exists post_views_slug_idx on post_views(post_slug);

alter table post_views enable row level security;
create policy "public insert" on post_views
  for insert to anon, authenticated with check (true);
create policy "public update" on post_views
  for update to anon, authenticated using (true) with check (true);
create policy "auth read" on post_views
  for select to authenticated using (true);`;

const fmtDuration = (s) => {
  if (s == null || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}dk ${sec}sn` : `${sec}sn`;
};

function AnalyticsPage() {
  const { data } = useAdmin();
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    supabase.from('post_views').select('*').then(({ data, error: e }) => {
      if (e) setError(e.message);
      else setRows(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--adm-text-dim)', fontSize: 14 }}>Yükleniyor…</div>;
  }

  if (error) {
    return (
      <div>
        <PageHead title="Analitik" desc="Yazı okuma metrikleri: görüntülenme, benzersiz ziyaretçi, okuma süresi, tamamlanma oranı." />
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

  // ── Yazı bazlı gruplama ──────────────────────────────────────────────────
  const bySlug = {};
  for (const r of rows) {
    const key = r.post_slug;
    if (!bySlug[key]) bySlug[key] = { slug: key, views: 0, sessions: new Set(), durations: [], scrolls: [] };
    const g = bySlug[key];
    g.views += 1;
    g.sessions.add(r.session_id);
    if (r.duration_seconds != null) g.durations.push(r.duration_seconds);
    if (r.max_scroll_pct != null) g.scrolls.push(r.max_scroll_pct);
  }

  const stats = Object.values(bySlug).map(g => {
    const post = data.posts.find(p => p.slug === g.slug);
    const avgDuration = g.durations.length
      ? g.durations.reduce((a, b) => a + b, 0) / g.durations.length
      : null;
    const completionRate = g.scrolls.length
      ? Math.round((g.scrolls.filter(s => s >= 70).length / g.scrolls.length) * 100)
      : null;
    return {
      slug:           g.slug,
      title:          post ? post.title_tr : g.slug,
      views:          g.views,
      uniqueVisitors: g.sessions.size,
      avgDuration,
      completionRate,
    };
  }).sort((a, b) => b.views - a.views);

  const totalViews  = rows.length;
  const totalUnique = new Set(rows.map(r => r.session_id)).size;
  const topPost     = stats[0];

  return (
    <div>
      <PageHead title="Analitik" desc="Yazı okuma metrikleri: görüntülenme, benzersiz ziyaretçi, okuma süresi, tamamlanma oranı." />

      <div className="adm-statctl-grid" style={{ marginBottom: 24 }}>
        <StatCard icon="eye" label="Toplam Görüntülenme" value={totalViews} color="#2563EB" />
        <StatCard icon="users" label="Benzersiz Ziyaretçi" value={totalUnique} color="#16A34A" />
        <StatCard icon="trendingUp" label="En Çok Okunan"
          value={topPost ? (topPost.title.length > 22 ? topPost.title.slice(0, 22) + '…' : topPost.title) : '—'}
          color="#7C3AED" />
      </div>

      <div className="adm-card">
        <div className="adm-card__header"><h3>Yazı Bazlı Metrikler</h3></div>
        <div className="adm-card__body" style={{ padding: 0 }}>
          {stats.length === 0 ? (
            <div className="adm-empty" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <AIcon name="trendingUp" size={40} style={{ opacity: 0.15, marginBottom: 12 }} />
              <p style={{ color: 'var(--adm-text-dim)' }}>Henüz veri yok — yazılar ziyaret edildikçe burada birikecek.</p>
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Yazı</th>
                    <th>Görüntülenme</th>
                    <th>Benzersiz Ziyaretçi</th>
                    <th>Ort. Okuma Süresi</th>
                    <th>Tamamlama (≥%70 scroll)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={s.slug}>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontWeight: 600, lineHeight: 1.35 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>/{s.slug}</div>
                      </td>
                      <td><span className="adm-badge adm-badge--tag">{s.views}</span></td>
                      <td>{s.uniqueVisitors}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDuration(s.avgDuration)}</td>
                      <td>{s.completionRate != null ? `%${s.completionRate}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { AnalyticsPage };
