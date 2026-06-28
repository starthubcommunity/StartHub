// admin-previews.jsx — Live preview renderers (site-like) for project & post forms
import { useState as useStatePv } from 'react';
import { AIcon } from './admin-ui';

const PV_STAGE = {
  idea:     { label: 'Fikir',    bg: '#EFF6FF', color: '#2563EB' },
  building: { label: 'Geliştirme', bg: '#FFF7ED', color: '#EA580C' },
  mvp:      { label: 'MVP',      bg: '#F5F3FF', color: '#7C3AED' },
  growth:   { label: 'Büyüme',   bg: '#FEF2F2', color: '#DC2626' },
  launch:   { label: 'Lansman',  bg: '#F0FDF4', color: '#16A34A' },
};

// ---- PROJECT PREVIEW (site kartı + detay görünümü) ----
function ProjectPreview({ f }) {
  const st = PV_STAGE[f.stage] || PV_STAGE.idea;
  return (
    <div className="adm-pv">
      <div className="adm-pv__label">Site kartı önizlemesi</div>
      <div className="adm-pv-card">
        <div className="adm-pv-card__head">
          <div className="adm-pv-card__logo" style={{ background: f.color }}>
            {f.logo ? <img src={f.logo} alt="" /> : (f.name || '?')[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span className="adm-pv-card__name">{f.name || 'Proje Adı'}</span>
              <span className="adm-pv-badge" style={{ background: st.bg, color: st.color }}>
                <span className="adm-pv-dot" style={{ background: st.color }}></span>{st.label}
              </span>
            </div>
            <p className="adm-pv-card__desc">{f.desc_tr || 'Kısa açıklama burada görünür.'}</p>
          </div>
        </div>
        <div className="adm-pv-tags">
          {(f.tags || []).map((t, i) => <span key={i} className="adm-pv-tag">{t}</span>)}
        </div>
        <div className="adm-pv-meta">
          <span>👥 {(f.leadId ? 1 : 0) + (f.memberIds || []).length || f.team || 0} kişi</span>
          {f.openRoles > 0 && <span style={{ color: '#16A34A' }}>💼 {f.openRoles} açık pozisyon</span>}
        </div>
      </div>

      {(f.about_tr || f.problem_tr || f.solution_tr) && (
        <div className="adm-pv-detail">
          {f.about_tr && <><div className="adm-pv-detail__h">Proje Nedir?</div><p>{f.about_tr}</p></>}
          {f.problem_tr && <><div className="adm-pv-detail__h">Problem</div><p>{f.problem_tr}</p></>}
          {f.solution_tr && <><div className="adm-pv-detail__h">Çözüm</div><p>{f.solution_tr}</p></>}
          {(f.openRolesList_tr || []).length > 0 && (
            <>
              <div className="adm-pv-detail__h">Açık Pozisyonlar</div>
              <div className="adm-pv-tags">{f.openRolesList_tr.map((r, i) => <span key={i} className="adm-pv-tag" style={{ background: '#F0FDF4', color: '#16A34A' }}>{r}</span>)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- POST PREVIEW (makale görünümü) ----
const PV_TAG = {
  blog:   { label: 'Blog',   color: '#7C3AED' },
  gundem: { label: 'Gündem', color: '#2563EB' },
};
function PostPreview({ f, authorName }) {
  const tg = PV_TAG[f.tag] || PV_TAG.gundem;
  const bgVar = (f.bg || '').replace('var(--blue-light)', '#EFF6FF').replace('var(--red-light)', '#FEF2F2')
    .replace('var(--green-light)', '#F0FDF4').replace('var(--purple-light)', '#F5F3FF').replace('var(--orange-light)', '#FFF7ED') || '#EFF6FF';
  return (
    <div className="adm-pv">
      <div className="adm-pv__label">Makale önizlemesi</div>
      <article className="adm-pv-article">
        <span className="adm-pv-tag" style={{ background: tg.color + '15', color: tg.color, alignSelf: 'flex-start' }}>{tg.label}</span>
        <h1 className="adm-pv-article__title">{f.title_tr || 'Yazı başlığı buraya gelir'}</h1>
        <div className="adm-pv-article__meta">
          <span style={{ fontWeight: 600 }}>{authorName || 'Yazar seçilmedi'}</span>
          <span>· {f.date || '—'} · {f.readTime || 0} dk okuma</span>
        </div>
        <div className="adm-pv-article__cover" style={{ background: bgVar }}>
          {f.cover ? <img src={f.cover} alt="" /> : <span>görsel / cover</span>}
        </div>
        <p className="adm-pv-article__lead">{f.excerpt_tr || 'Yazının giriş özeti burada görünür.'}</p>
        <div className="adm-pv-article__body">
          {(f.body_tr || []).length > 0
            ? f.body_tr.map((p, i) => <p key={i}>{p}</p>)
            : <p style={{ opacity: 0.5 }}>Yazı içeriği henüz eklenmedi.</p>}
        </div>
        {f.tag === 'gundem' && f.source && f.source.name && (
          <div className="adm-pv-article__src">Kaynak: {f.source.name}</div>
        )}
      </article>
    </div>
  );
}

// ---- Generic preview toggle wrapper button ----
function PreviewToggle({ on, onClick }) {
  return (
    <button type="button" className={`adm-btn adm-btn--ghost ${on ? 'adm-btn--active' : ''}`} onClick={onClick}>
      <AIcon name="eye" size={16} /> {on ? 'Formu Göster' : 'Önizleme'}
    </button>
  );
}

export { ProjectPreview, PostPreview, PreviewToggle, PV_STAGE, PV_TAG };
