// triage.jsx — Hızlı eleme (HUB_SPEC v3 §6.4, PROMPT_V3 D3).
// Tam ekran, tek aday, üç aksiyon. Kart içeriği KAYNAKTAN BAĞIMSIZ: nerede
// bulundu + neden bu kişi + serbest bağlantılar. GitHub sinyalleri (varsa)
// yalnızca küçük bir ek satır. Klavye: M gönder · A atla · E ele · Ctrl+Z geri.
import React, { useState, useEffect, useMemo } from 'react';
import { AIcon } from '../../admin/admin-ui';
import { useHubStore } from '../hub-store';
import { SOURCE_LABEL } from '../hub-constants';
import { canDraftAI } from '../hub-rules';
import { generateDraft } from '../hub-ai-draft';
import { lastChannel } from '../hub-channel';

const isToday = (iso) => iso && String(iso).slice(0, 10) === new Date().toISOString().slice(0, 10);

export default function Triage({ ids, onClose }) {
  const store = useHubStore();
  const [queue] = useState(() => (ids || []).slice());   // açılışta dondurulur
  const [idx, setIdx] = useState(0);
  const [hist, setHist] = useState([]);                  // [{ id, action }]
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };

  const total = queue.length;
  const cur = idx < total ? store.candidates.find((c) => c.id === queue[idx]) || null : null;
  const openRole = cur?.openRoleId ? store.openRoles.find((r) => r.id === cur.openRoleId) : null;

  const sentToday = useMemo(
    () => store.touches.filter((t) => t.senderId === store.currentMember?.id && isToday(t.sentAt)).length,
    [store.touches, store.currentMember]
  );

  useEffect(() => { setDraft(cur?.draftText || ''); }, [cur?.id]); // eslint-disable-line

  // Kullanıcı taslağı düzenleyip "Atla"ya basarsa yazdığı kaybolmasın diye
  // onBlur'da / atlamada draft_text'e yazılır.
  const commitDraft = async () => {
    if (cur && (draft || '') !== (cur.draftText || '')) {
      store.patchCandidate(cur.id, { draftText: draft });
      await store.updateCandidate(cur.id, { ...cur, draftText: draft }).catch(() => {});
    }
  };

  // "Mesajı attım" (aday kartı) ile BİREBİR aynı yol: yalnızca store.sendTouch.
  // O tek başına hub_touches + Havuz→Temas + takip tarihini yapar. Taslak metni
  // touch'ın note'una gider (ayrıca candidate.draft_text'e yazmaya gerek yok).
  const doMessage = async () => {
    if (!cur || busy) return;
    setBusy(true);
    const id = cur.id;
    try {
      await store.sendTouch(cur, { templateId: null, channel: lastChannel(), personalization: (draft || '').trim() || null });
      setHist((h) => [...h, { id, action: 'message' }]);
      setIdx((i) => i + 1);
      flash('Mesaj kaydedildi.');
    } catch (e) { flash('Hata: ' + e.message); }
    setBusy(false);
  };

  const doSkip = () => {
    if (!cur || busy) return;
    setHist((h) => [...h, { id: cur.id, action: 'skip' }]);
    setIdx((i) => i + 1);
  };

  const doEliminate = async () => {
    if (!cur || busy) return;
    setBusy(true);
    try {
      await store.advanceStage(cur.id, 'archived', { reason: 'hızlı eleme', extra: { archiveReason: 'below_bar' } });
      setHist((h) => [...h, { id: cur.id, action: 'eliminate' }]);
      setIdx((i) => i + 1);
      flash('Elendi.');
    } catch (e) { flash('Hata: ' + e.message); }
    setBusy(false);
  };

  const undo = async () => {
    if (!hist.length || busy) return;
    setBusy(true);
    const last = hist[hist.length - 1];
    try {
      if (last.action === 'eliminate') await store.undoLastStage(last.id);
      else if (last.action === 'message') await store.undoSend(last.id);
      setHist((h) => h.slice(0, -1));
      setIdx((i) => Math.max(0, i - 1));
      flash('Geri alındı.');
    } catch (e) { flash('Geri alınamadı: ' + e.message); }
    setBusy(false);
  };

  const runDraft = async () => {
    if (!cur || !canDraftAI(cur)) { flash('Veri yetersiz — elle yaz.'); return; }
    setDrafting(true);
    try { const { text } = await generateDraft(cur); setDraft(text); await store.updateCandidate(cur.id, { ...cur, draftText: text }); }
    catch (e) { flash(e.message); }
    setDrafting(false);
  };

  // Klavye — yalnızca bu ekranda; input/textarea odaktayken M/A/E devre dışı.
  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const inField = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (inField) return;
      const k = e.key.toLowerCase();
      if (k === 'm') { e.preventDefault(); doMessage(); }
      else if (k === 'a') { e.preventDefault(); doSkip(); }
      else if (k === 'e') { e.preventDefault(); doEliminate(); }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const counts = hist.reduce((a, h) => ((a[h.action] = (a[h.action] || 0) + 1), a), {});
  const evLinks = [
    ...(cur?.evidence || []).map((e) => e.url).filter(Boolean),
    cur?.github, cur?.linkedin, cur?.email && `mailto:${cur.email}`,
  ].filter(Boolean);
  const en = cur?.enrichment || {};
  const ghSignals = [
    en.finished_projects != null && `bitmiş proje ${en.finished_projects}`,
    en.activity_recency != null && `son aktiflik ${en.activity_recency}g`,
    en.consistency != null && `süreklilik ${en.consistency}/12`,
  ].filter(Boolean);

  return (
    <div className="hub-panel-overlay" style={{ alignItems: 'stretch', justifyContent: 'stretch' }}>
      <div className="hub-panel" style={{ position: 'relative', maxWidth: 'none', width: '100%', height: '100%', borderRadius: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="hub-panel__head">
          <div>
            <div className="hub-panel__title">Hızlı eleme</div>
            <div style={{ fontSize: 12, color: '#A29D94', marginTop: 4 }}>
              {Math.min(idx + (cur ? 1 : 0), total)}/{total} · bugün gönderilen: {sentToday}
            </div>
          </div>
          <button className="adm-icon-btn" onClick={onClose}><AIcon name="x" size={18} /></button>
        </div>

        {!cur ? (
          <div className="adm-empty" style={{ margin: 'auto', textAlign: 'center' }}>
            Parti bitti.<br />
            <span style={{ fontSize: 13, color: 'var(--adm-text-dim)' }}>
              {counts.message || 0} mesaj · {counts.eliminate || 0} elendi · {counts.skip || 0} atlandı
            </span>
            <div><button className="adm-btn adm-btn--primary adm-btn--sm" style={{ marginTop: 12 }} onClick={onClose}>Kapat</button></div>
          </div>
        ) : (
          <div className="hub-panel__body" style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 620, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, margin: '4px 0' }}>{cur.fullName}</h2>
              <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cur.university && <span>{cur.university}</span>}
                {openRole && <span className="hub-pill">{openRole.title}</span>}
              </div>

              <h4 className="hub-h4">Nerede bulundu</h4>
              <p style={{ fontSize: 14, margin: '2px 0 14px' }}>
                {SOURCE_LABEL[cur.source] || cur.source}{cur.sourceDetail ? ` — ${cur.sourceDetail}` : ''}
              </p>

              <h4 className="hub-h4">Neden bu kişi</h4>
              <p style={{ fontSize: 14, margin: '2px 0 14px', whiteSpace: 'pre-wrap' }}>
                {cur.whyThisOne || <span style={{ color: 'var(--adm-text-dim)' }}>—</span>}
              </p>

              <h4 className="hub-h4">Bağlantılar</h4>
              {evLinks.length ? (
                <ul style={{ fontSize: 13, margin: '2px 0 14px', paddingLeft: 18 }}>
                  {evLinks.map((u, i) => (
                    <li key={i}><a href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--adm-blue)' }}>{u}</a></li>
                  ))}
                </ul>
              ) : <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', margin: '2px 0 14px' }}>—</p>}

              {ghSignals.length > 0 && (cur.roleType === 'technical' || !cur.roleType) && (
                <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 14 }}>
                  GitHub: {ghSignals.join(' · ')}
                </div>
              )}

              <h4 className="hub-h4">
                Mesaj taslağı
                <button className="adm-btn adm-btn--ghost adm-btn--sm" style={{ marginLeft: 8 }}
                  disabled={drafting || !canDraftAI(cur)} onClick={runDraft}>
                  {drafting ? '…' : (draft ? 'Yeniden yaz (AI)' : 'Taslak oluştur')}
                </button>
              </h4>
              <textarea className="adm-input adm-textarea" rows={5} value={draft}
                onChange={(e) => setDraft(e.target.value)} onBlur={commitDraft}
                placeholder="Kısa kişiselleştirme cümlesi — M ile gönderilir." />
            </div>
          </div>
        )}

        {cur && (
          <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--adm-border)', background: 'var(--adm-bg-card)', justifyContent: 'center' }}>
            <button className="adm-btn adm-btn--primary" disabled={busy} onClick={doMessage}>Mesaj gönder <kbd>M</kbd></button>
            <button className="adm-btn adm-btn--ghost" disabled={busy} onClick={doSkip}>Atla <kbd>A</kbd></button>
            <button className="adm-btn adm-btn--ghost" disabled={busy} onClick={doEliminate}>Ele <kbd>E</kbd></button>
            <button className="adm-btn adm-btn--ghost" disabled={busy || !hist.length} onClick={undo}>↶ Geri <kbd>Ctrl+Z</kbd></button>
          </div>
        )}
        {/* Bug 4 — bildirim aksiyon alanının üstüne binmesin: üst-orta, tıklamayı geçirir. */}
        {toast && (
          <div style={{
            position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--adm-text)', color: 'var(--adm-bg)', fontSize: 13, fontWeight: 600,
            padding: '7px 16px', borderRadius: 999, pointerEvents: 'none', zIndex: 5,
            boxShadow: '0 2px 12px rgba(0,0,0,.18)',
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}
