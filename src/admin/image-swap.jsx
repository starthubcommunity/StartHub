// Yazının görselini stoktan değiştirme + seçim özeti + "uygun" onayı.
// Skorlar image-score.js ile hesaplanır (matcher'ın JS karşılığı, filtresiz).
import React, { useEffect, useState } from 'react';
import { Modal, Field, Select, Input } from './admin-ui';
import { supabase } from '../lib/supabase';
import { IMAGE_STOCK_CATEGORIES, VISUAL_TYPES, VISUAL_TYPE_LABEL } from './image-constants';
import { rankImages } from './image-score';

// posts.bg → makale kategorisi (automation/dry_run_matcher.py ile aynı tahmin; posts'ta kategori kolonu yok).
const BG_TO_CATEGORY = {
  'var(--green-light)': 'Yatırım',
  'var(--purple-light)': 'AI',
  'var(--blue-light)': 'Teknoloji',
  'var(--orange-light)': 'Teknoloji',
};
export const articleCategoryOf = (post) => BG_TO_CATEGORY[post.bg] || 'Teknoloji';

const usageSince = () => new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

export function ImageSwapModal({ post, flash, onClose, onSaved }) {
  const [images, setImages] = useState([]);
  const [usage90, setUsage90] = useState({});
  const [loading, setLoading] = useState(true);
  const [fCat, setFCat] = useState('');
  const [fType, setFType] = useState('');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [imgRes, useRes] = await Promise.all([
        supabase.from('image_stock').select('*').order('id'),
        supabase.from('image_usage').select('image_id').gte('used_at', usageSince()),
      ]);
      if (cancelled) return;
      if (imgRes.error) flash('Görsel stoğu yüklenemedi: ' + imgRes.error.message, 'orange');
      const counts = {};
      for (const r of useRes.data || []) counts[r.image_id] = (counts[r.image_id] || 0) + 1;
      setImages(imgRes.data || []);
      setUsage90(counts);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [flash]);

  const ranked = rankImages(post, images, usage90, articleCategoryOf(post))
    .filter(r => (!fCat || r.image.category === fCat)
      && (!fType || r.image.visual_type === fType)
      && (!q || (r.image.alt_tr || '').toLowerCase().includes(q.toLowerCase())
        || (r.image.tags || []).some(t => String(t).toLowerCase().includes(q.toLowerCase()))));

  const choose = async (r) => {
    if (saving) return;
    setSaving(true);
    // Kullanım kaydı önce: yazan kayıt başarısızsa yazının görseli değişmez.
    const { error: useErr } = await supabase.from('image_usage').insert({
      image_id: r.image.id,
      post_id: post.id,
      score: r.score,
      reason: {
        manual: true,
        previous_image_url: post.image_url || null,
        best: { category: r.parts.cat, tags: r.tags, usage_window: r.parts.usage90, usage_bonus: r.parts.usageBonus, score: r.score },
      },
    });
    if (useErr) { setSaving(false); flash('Kullanım kaydı yazılamadı: ' + useErr.message, 'orange'); return; }
    const { error } = await supabase.from('posts')
      .update({ image_url: r.image.url, image_alt: r.image.alt_tr || null, needs_review: false })
      .eq('id', post.id);
    setSaving(false);
    if (error) { flash('Görsel güncellenemedi: ' + error.message, 'orange'); return; }
    flash('Görsel değiştirildi.');
    onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Görseli Değiştir" wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="adm-form-grid">
          <Field label="Kategori">
            <Select value={fCat} onChange={setFCat} placeholder="Tümü" options={IMAGE_STOCK_CATEGORIES.map(c => ({ value: c, label: c }))} />
          </Field>
          <Field label="Görsel tipi">
            <Select value={fType} onChange={setFType} placeholder="Tümü" options={VISUAL_TYPES.map(([value, label]) => ({ value, label }))} />
          </Field>
        </div>
        <Field label="Ara" hint="Alt metin veya etiket">
          <Input value={q} onChange={setQ} />
        </Field>
        {loading ? (
          <div className="adm-empty"><span className="adm-spinner"></span></div>
        ) : (
          <div style={{ maxHeight: 460, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {ranked.slice(0, 60).map(r => (
              <div key={r.image.id} className="adm-card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <img src={r.image.url} alt={r.image.alt_tr || ''} loading="lazy" width={190} height={106}
                  style={{ width: '100%', height: 106, objectFit: 'cover', borderRadius: 6 }} />
                <div style={{ fontSize: 12 }}>
                  <strong>skor {r.score}</strong> · {r.image.category || '—'} · {VISUAL_TYPE_LABEL[r.image.visual_type] || 'tip yok'}
                  {r.image.is_generic && <span className="adm-badge adm-badge--tag" style={{ marginLeft: 4 }}>klişe</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--adm-text-dim)' }}>
                  {r.tags.length ? `Eşleşen: ${r.tags.map(t => t.tag).join(', ')}` : 'Etiket eşleşmesi yok'}
                </div>
                <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={saving} onClick={() => choose(r)}>Bu görseli seç</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// Yazının son görsel seçim kaydını özetler (sade, katlanabilir).
export function ImageReasonBox({ post, flash, onChanged }) {
  const [row, setRow] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('image_usage')
        .select('score, used_at, reason').eq('post_id', post.id).order('used_at', { ascending: false }).limit(1);
      if (cancelled) return;
      setRow(data && data[0] ? data[0] : null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [post.id, post.image_url]);

  const approve = async () => {
    setSaving(true);
    const { error } = await supabase.from('posts').update({ needs_review: false }).eq('id', post.id);
    setSaving(false);
    if (error) { flash('Onaylanamadı: ' + error.message, 'orange'); return; }
    flash('Görsel uygun olarak işaretlendi.');
    onChanged();
  };

  const r = row?.reason || {};
  const best = r.best || {};
  return (
    <details className="adm-card" style={{ padding: '10px 14px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
        Görsel seçim özeti {row ? `· skor ${row.score ?? '—'}` : ''} {post.needs_review ? '· ⚠ kontrol edilmeli' : ''}
      </summary>
      <div style={{ fontSize: 13, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!loaded && <span>Yükleniyor…</span>}
        {loaded && !row && <span style={{ color: 'var(--adm-text-dim)' }}>Bu yazı için seçim kaydı yok (eski yazı ya da eşleştirme öncesi).</span>}
        {loaded && row && (
          <>
            <div>Kaynak: {r.manual ? 'elle seçildi' : (r.mode === 'legacy' ? 'eski algoritma' : r.mode === 'fallback' ? 'son çare görseli' : 'otomatik')}</div>
            <div>Eşleşen etiketler: {(best.tags || []).length ? best.tags.map(t => `${t.tag} (${t.w})`).join(', ') : 'yok'}</div>
            <div>Gevşetilen filtreler: {(r.filters_relaxed || []).length ? r.filters_relaxed.join(', ') : 'yok'}</div>
            {(r.top3 || []).length > 0 && (
              <div>İlk 3 aday: {r.top3.map(c => `#${c.id} (${c.score})`).join(' · ')}</div>
            )}
          </>
        )}
        {post.needs_review && (
          <div style={{ marginTop: 6 }}>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={saving} onClick={approve}>Görsel uygun — onayla</button>
          </div>
        )}
      </div>
    </details>
  );
}

