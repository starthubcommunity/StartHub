// mail-confirm.jsx — karar niteliğindeki her mail için çift onay (Adım 3/5).
// Kaynak: StartHub_Aday_Bulma_Senaryosu.md Bölüm J —
//   1) Önizleme: alıcı, konu, içerik net gösterilir (salt okunur).
//   2) Onay: "Gönder" ayrı bir tık, "Evet, eminim" ikinci tık.
// Her iki adımda da geri dönüş (Düzenle / Vazgeç) vardır. Bilgi mailleri
// (yeni aday geldi, süre doluyor) bu bileşeni KULLANMAZ — tek adımda gider.
import React, { useState } from 'react';
import { AIcon } from '../../admin/admin-ui';

export default function MailSendConfirm({ open, to, toName, subject, body, actionLabel, consequence, onSend, onClose }) {
  const [step, setStep] = useState('preview');   // 'preview' | 'confirm'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!open) return null;

  const close = () => { if (busy) return; setStep('preview'); setErr(''); onClose(); };
  const send = async () => {
    setBusy(true); setErr('');
    try { await onSend(); setStep('preview'); onClose(); }
    catch (e) { setErr(e?.message || 'Gönderilemedi.'); setStep('preview'); }
    setBusy(false);
  };

  return (
    <>
      {/* HubWizard (z 1100) içinden açılabildiği için kendi katmanı: 1150 / 1160 */}
      <div className="adm-modal-overlay" style={{ zIndex: 1150 }} onClick={close}>
        <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal__header">
          <h3>Mail önizlemesi</h3>
          <button className="adm-icon-btn" onClick={close}><AIcon name="x" size={18} /></button>
        </div>
        <div className="adm-modal__body" style={{ fontSize: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: '6px 10px', marginBottom: 12 }}>
            <span style={{ color: 'var(--adm-text-dim)' }}>Alıcı</span>
            <span><b>{toName || to}</b>{toName && <span style={{ color: 'var(--adm-text-dim)' }}> · {to}</span>}</span>
            <span style={{ color: 'var(--adm-text-dim)' }}>Konu</span>
            <span style={{ fontWeight: 600 }}>{subject}</span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', background: 'var(--adm-bg)', border: '1px solid var(--adm-border)', borderRadius: 10, padding: '12px 14px', lineHeight: 1.55, maxHeight: 360, overflowY: 'auto' }}>
            {body}
          </div>
          {consequence && <div style={{ fontSize: 12.5, color: 'var(--adm-text-secondary)', marginTop: 10 }}>{consequence}</div>}
          {err && <div style={{ fontSize: 12.5, color: 'var(--adm-red)', marginTop: 10 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={close} disabled={busy}>
              <AIcon name="edit" size={14} /> Düzenlemeye dön
            </button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => setStep('confirm')} disabled={busy}>
              <AIcon name="mail" size={14} /> Gönder
            </button>
          </div>
        </div>
        </div>
      </div>
      {step === 'confirm' && (
        <div className="adm-modal-overlay" style={{ zIndex: 1160 }} onClick={() => !busy && setStep('preview')}>
          <div className="adm-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal__header"><h3>Emin misin?</h3></div>
            <div className="adm-modal__body" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              <b>{actionLabel || 'Bu maili'}</b> {toName ? <><b>{toName}</b> ({to})</> : <b>{to}</b>} adresine gönderiyorsun. Gönderilen mail geri alınamaz.
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setStep('preview')} disabled={busy}>Vazgeç</button>
                <button type="button" className="adm-btn adm-btn--primary" onClick={send} disabled={busy}>
                  {busy ? 'Gönderiliyor…' : 'Evet, eminim'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
