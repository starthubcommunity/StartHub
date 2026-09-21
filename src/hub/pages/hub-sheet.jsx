// hub-sheet.jsx — HR › Ayarlar › "Hub Başvuru Tablosu" (Google Sheets bağlantısı).
// HUB (topluluk) tarafı başvuruları HR'a düşmez; veritabanı tetikleyicisi her yeni
// başvuruyu bu bağlantıya (Google Apps Script web uygulaması) yollar, yönetim tabloda yapılır.
// Kimlik bilgisi (servis hesabı vb.) GEREKMEZ — yalnızca web adresi + gizli anahtar.
import React, { useState, useEffect } from 'react';
import { AIcon, Field, Input } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { usePerms } from '../../lib/use-perms';
import { buildAppsScript, SHEET_NAME } from '../hub-sheet-script';

const newSecret = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID().replace(/-/g, '')
  : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));

const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export default function HubSheetSettings() {
  const { can } = usePerms();
  const [cfg, setCfg] = useState(null);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [hubCount, setHubCount] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);      // { text, err }
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('hub_sheet_config').select('*').eq('id', 1).single();
    if (error) { setMsg({ text: 'Yüklenemedi: ' + error.message, err: true }); return; }
    setCfg(data);
    setUrl(data.webhook_url || '');
    setSecret(data.secret || newSecret());   // henüz yoksa kaydedince kalıcı olur
    setEnabled(data.webhook_url ? !!data.enabled : true);
  };
  useEffect(() => {
    load();
    supabase.from('applications').select('id', { count: 'exact', head: true })
      .or('target.eq.community,and(target.is.null,intent.in.(community,hub))')
      .then(({ count }) => setHubCount(count ?? null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('settings.write')) return null;

  const flash = (text, err = false) => { setMsg({ text, err }); setTimeout(() => setMsg(null), 6000); };
  const connected = !!(cfg && cfg.webhook_url && cfg.enabled);

  const save = async () => {
    const u = url.trim();
    if (u && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(u)) {
      flash('Adres "https://script.google.com/macros/s/…/exec" biçiminde olmalı.', true); return;
    }
    setBusy('save');
    const { error } = await supabase.from('hub_sheet_config').upsert({
      id: 1, webhook_url: u || null, secret, enabled: !!u && enabled, updated_at: new Date().toISOString(),
    });
    setBusy('');
    if (error) { flash('Kaydedilemedi: ' + error.message, true); return; }
    flash(u ? 'Bağlantı kaydedildi. Şimdi "Test satırı gönder" ile dene.' : 'Bağlantı kaldırıldı.');
    load();
  };

  const rpc = async (fn, label) => {
    setBusy(fn);
    const { data, error } = await supabase.rpc(fn);
    setBusy('');
    if (error) { flash(`${label} başarısız: ${error.message}`, true); return; }
    flash(fn === 'hub_sheet_backfill'
      ? `${data} başvuru tabloya gönderildi (tabloda zaten olanlar tekrar eklenmez).`
      : 'Test satırı gönderildi — birkaç saniye içinde tabloda görünmeli.');
    load();
  };

  const copyScript = async () => {
    try { await navigator.clipboard.writeText(buildAppsScript(secret)); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { flash('Kopyalanamadı — kodu elle seç ve kopyala.', true); }
  };

  const step = (n, title, body) => (
    <li style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: '#1C1917', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{n}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--adm-text-secondary)', lineHeight: 1.55 }}>{body}</div>
      </div>
    </li>
  );

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 className="hub-h4" style={{ margin: 0 }}>Hub Başvuru Tablosu (Google Sheets)</h3>
        <span className={`hub-pill ${connected ? 'hub-pill--ok' : 'hub-pill--warn'}`}>{connected ? '✓ bağlı' : 'kurulmadı'}</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', margin: '6px 0 12px', maxWidth: 720 }}>
        Katıl formunda <b>Topluluk (HUB)</b> tarafını dolduranlar HR'a düşmez; her yeni başvuru bu tabloya satır olarak eklenir ve
        yönetim orada yapılır. HR yalnızca <b>Startup (LAB)</b> başvurularını alır.
      </p>

      <div className="adm-card">
        <div className="adm-card__body">
          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 6px' }}>
            {step(1, 'Yeni bir Google Sheets dosyası aç',
              <>sheets.new adresinden boş bir tablo aç, adı örn. <b>Start-Hub — Hub Başvuruları</b> olsun.</>)}
            {step(2, 'Apps Script kodunu yapıştır',
              <>Tabloda <b>Uzantılar → Apps Script</b> aç, içindeki kodu silip aşağıdaki kodu yapıştır ve kaydet.
                Kodun içinde bu bağlantıya özel gizli anahtar hazır yazılı.
                <div style={{ marginTop: 8 }}>
                  <button className="adm-btn adm-btn--soft adm-btn--sm" onClick={copyScript}>
                    <AIcon name={copied ? 'check' : 'edit'} size={13} /> {copied ? 'Kopyalandı' : 'Kodu kopyala'}
                  </button>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--adm-text-dim)' }}>Kodu göster</summary>
                    <textarea readOnly value={buildAppsScript(secret)} rows={10}
                      style={{ width: '100%', marginTop: 6, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11.5, padding: 10, borderRadius: 8, border: '1px solid var(--adm-border)', background: '#FBF9F4' }} />
                  </details>
                </div></>)}
            {step(3, 'Web uygulaması olarak dağıt',
              <><b>Dağıt → Yeni dağıtım → Tür: Web uygulaması</b>. "Şu kullanıcı olarak çalıştır" = <b>Ben</b>, "Erişimi olan" = <b>Herkes</b>.
                Google izin isterse onayla. Çıkan <b>Web uygulaması URL'sini</b> kopyala.</>)}
            {step(4, 'Adresi buraya yapıştır ve kaydet',
              <>
                <Field label="Web uygulaması URL'si">
                  <Input value={url} onChange={setUrl} placeholder="https://script.google.com/macros/s/…/exec" />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10 }}>
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ accentColor: '#DC2626' }} />
                  Yeni başvuruları otomatik gönder
                </label>
                <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy === 'save'} onClick={save}>
                  <AIcon name="save" size={13} /> {busy === 'save' ? 'Kaydediliyor…' : 'Bağlantıyı kaydet'}
                </button>
              </>)}
          </ol>

          <div style={{ borderTop: '1px solid var(--adm-border-light)', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={!cfg?.webhook_url || !!busy} onClick={() => rpc('hub_sheet_test', 'Test')}>
              {busy === 'hub_sheet_test' ? 'Gönderiliyor…' : 'Test satırı gönder'}
            </button>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={!cfg?.webhook_url || !!busy} onClick={() => rpc('hub_sheet_backfill', 'Aktarım')}>
              {busy === 'hub_sheet_backfill' ? 'Aktarılıyor…' : `Mevcut Hub başvurularını tabloya aktar${hubCount != null ? ` (${hubCount})` : ''}`}
            </button>
            <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginLeft: 'auto' }}>
              Son gönderim: {fmt(cfg?.last_sent_at)}{cfg?.last_error ? ` · hata: ${cfg.last_error}` : ''}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 8 }}>
            Sayfa adı "{SHEET_NAME}" — yoksa otomatik oluşturulur. Satırın son sütunu ID'dir; aynı başvuru iki kez eklenmez.
          </div>
          {msg && (
            <div style={{ marginTop: 10, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.err ? '#FEF2F2' : '#F0FDF4', color: msg.err ? '#DC2626' : '#16A34A' }}>{msg.text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
