// hub-sheet.jsx — HR › Ayarlar › "Başvuru Tablosu (Google Sheets)".
// HUB (topluluk) tarafı HR'a düşmez, tabloya (varsayılan "Hub Başvuruları" sekmesi)
// gider. LAB (startup) tarafı HR'a düşmeye devam eder — AMA 0043'ten itibaren aynı
// tabloda ayrı bir sekmeye (varsayılan "Sayfa1") yedek olarak da yazılır: site/DB'ye
// erişilemese bile başvurular Sheets'te durur. Servis hesabıyla otomatik çalışır —
// kullanıcı tarafında Apps Script/kod kurulumu GEREKMEZ.
import React, { useState, useEffect } from 'react';
import { AIcon, Field, Input } from '../../admin/admin-ui';
import { supabase } from '../../lib/supabase';
import { usePerms } from '../../lib/use-perms';

const fmt = (v) => (v ? new Date(v).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

// Sheets URL'sinden ("…/spreadsheets/d/<ID>/edit…") ID çıkar; zaten çıplak ID ise dokunma.
const extractId = (v) => {
  const s = v.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
};

export default function HubSheetSettings() {
  const { can } = usePerms();
  const [cfg, setCfg] = useState(null);
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('Hub Başvuruları');
  const [labSheetName, setLabSheetName] = useState('Sayfa1');
  const [enabled, setEnabled] = useState(true);
  const [hubCount, setHubCount] = useState(null);
  const [labCount, setLabCount] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);      // { text, err }
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('hub_sheet_config').select('*').eq('id', 1).single();
    if (error) { setMsg({ text: 'Yüklenemedi: ' + error.message, err: true }); return; }
    setCfg(data);
    setSheetId(data.spreadsheet_id || '');
    setSheetName(data.sheet_name || 'Hub Başvuruları');
    setLabSheetName(data.lab_sheet_name || 'Sayfa1');
    setEnabled(data.spreadsheet_id ? !!data.enabled : true);
  };
  useEffect(() => {
    load();
    supabase.from('applications').select('id', { count: 'exact', head: true })
      .or('target.eq.community,and(target.is.null,intent.in.(community,hub))')
      .then(({ count }) => setHubCount(count ?? null));
    supabase.from('applications').select('id', { count: 'exact', head: true })
      .or('target.eq.startup,and(target.is.null,intent.not.in.(community,hub))')
      .then(({ count }) => setLabCount(count ?? null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!can('settings.write')) return null;

  const flash = (text, err = false) => { setMsg({ text, err }); setTimeout(() => setMsg(null), 6000); };
  const connected = !!(cfg && cfg.spreadsheet_id && cfg.enabled);
  const saEmail = cfg?.service_account_email || '';

  const copyEmail = async () => {
    try { await navigator.clipboard.writeText(saEmail); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { flash('Kopyalanamadı — e-postayı elle seç ve kopyala.', true); }
  };

  const save = async () => {
    const id = extractId(sheetId);
    setBusy('save');
    const { error } = await supabase.from('hub_sheet_config').upsert({
      id: 1, spreadsheet_id: id || null, sheet_name: sheetName.trim() || 'Hub Başvuruları',
      lab_sheet_name: labSheetName.trim() || 'Sayfa1',
      enabled: !!id && enabled, updated_at: new Date().toISOString(),
    });
    setBusy('');
    if (error) { flash('Kaydedilemedi: ' + error.message, true); return; }
    flash(id ? 'Tablo ID\'si kaydedildi. Şimdi "Test satırı gönder" ile dene.' : 'Bağlantı kaldırıldı.');
    load();
  };

  const rpc = async (fn, label) => {
    setBusy(fn);
    const { data, error } = await supabase.rpc(fn);
    setBusy('');
    if (error) { flash(`${label} başarısız: ${error.message}`, true); return; }
    flash(fn === 'hub_sheet_backfill'
      ? `${data} başvuru tarandı, iki sekmeye dağıtıldı (tabloda zaten olanlar tekrar eklenmez).`
      : 'Test satırı gönderildi — birkaç saniye içinde tabloda görünmeli.');
    load();
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
        <h3 className="hub-h4" style={{ margin: 0 }}>Başvuru Tablosu (Google Sheets)</h3>
        <span className={`hub-pill ${connected ? 'hub-pill--ok' : 'hub-pill--warn'}`}>{connected ? '✓ bağlı' : 'kurulmadı'}</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--adm-text-dim)', margin: '6px 0 12px', maxWidth: 720 }}>
        Katıl formunda <b>Topluluk (HUB)</b> tarafını dolduranlar HR'a düşmez — bu tabloya (HUB sekmesi) yazılır, yönetim orada
        yapılır. <b>Startup (LAB)</b> başvuruları HR'a düşmeye devam eder, ama artık aynı tabloda ayrı bir sekmeye <b>yedek</b>
        olarak da yazılır — site veya veritabanına erişilemese bile başvurular elde kalır. Bağlantı bir servis hesabıyla otomatik
        çalışır — kod yapıştırma / Apps Script kurulumu yok.
      </p>

      <div className="adm-card">
        <div className="adm-card__body">
          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 6px' }}>
            {step(1, 'Yeni bir Google Sheets dosyası aç',
              <>sheets.new adresinden boş bir tablo aç, adı örn. <b>Start-Hub — Hub Başvuruları</b> olsun.</>)}
            {step(2, 'Tabloyu servis hesabıyla paylaş',
              <>Sağ üstteki <b>Paylaş</b> düğmesine tıkla, aşağıdaki e-postayı <b>Düzenleyen (Editor)</b> olarak ekle.
                {saEmail ? (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <code style={{ fontSize: 12.5, padding: '4px 8px', borderRadius: 6, background: '#FBF9F4', border: '1px solid var(--adm-border)' }}>{saEmail}</code>
                    <button className="adm-btn adm-btn--soft adm-btn--sm" onClick={copyEmail}>
                      <AIcon name={copied ? 'check' : 'edit'} size={13} /> {copied ? 'Kopyalandı' : 'Kopyala'}
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: '#B45309', background: '#FFFBEB', padding: '6px 10px', borderRadius: 6 }}>
                    Servis hesabı henüz tanımlı değil — bu adım için sistem tarafında bir kerelik kurulum bekleniyor.
                  </div>
                )}</>)}
            {step(3, 'Tablonun ID\'sini buraya yapıştır ve kaydet',
              <>
                Tarayıcıda açıkken adres çubuğundaki linki (veya sadece ID kısmını) buraya yapıştır.
                <div style={{ marginTop: 8 }}>
                  <Field label="Google Sheets linki veya ID">
                    <Input value={sheetId} onChange={setSheetId} placeholder="https://docs.google.com/spreadsheets/d/…/edit veya sadece ID" />
                  </Field>
                  <div className="grid grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="HUB sekmesi (topluluk)">
                      <Input value={sheetName} onChange={setSheetName} placeholder="Hub Başvuruları" />
                    </Field>
                    <Field label="LAB yedek sekmesi (startup)">
                      <Input value={labSheetName} onChange={setLabSheetName} placeholder="Sayfa1" />
                    </Field>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--adm-text-dim)', margin: '-2px 0 10px' }}>
                    LAB sekmesi yalnızca <b>yedek</b> — yönetim yine HR'da (Adaylar / Mentörler / Destekçiler / Fikirler) yapılır.
                    Genelde Sheets'in kendiliğinden oluşturduğu boş "Sayfa1" sekmesi bunun için kullanılabilir.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 10 }}>
                    <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ accentColor: '#DC2626' }} />
                    Yeni başvuruları otomatik gönder (HUB + LAB yedeği)
                  </label>
                  <button className="adm-btn adm-btn--primary adm-btn--sm" disabled={busy === 'save'} onClick={save}>
                    <AIcon name="save" size={13} /> {busy === 'save' ? 'Kaydediliyor…' : 'Bağlantıyı kaydet'}
                  </button>
                </div></>)}
          </ol>

          <div style={{ borderTop: '1px solid var(--adm-border-light)', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={!cfg?.spreadsheet_id || !!busy} onClick={() => rpc('hub_sheet_test', 'Test')}>
              {busy === 'hub_sheet_test' ? 'Gönderiliyor…' : 'Test satırı gönder'}
            </button>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={!cfg?.spreadsheet_id || !!busy} onClick={() => rpc('hub_sheet_backfill', 'Aktarım')}>
              {busy === 'hub_sheet_backfill' ? 'Aktarılıyor…' : `Mevcut tüm başvuruları tabloya aktar${hubCount != null && labCount != null ? ` (${hubCount} HUB, ${labCount} LAB)` : ''}`}
            </button>
            <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginLeft: 'auto' }}>
              Son gönderim: {fmt(cfg?.last_sent_at)}{cfg?.last_error ? ` · hata: ${cfg.last_error}` : ''}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 8 }}>
            Sayfa/sekme yoksa otomatik oluşturulur. Satırın son sütunu ID'dir; aynı başvuru iki kez eklenmez.
          </div>
          {msg && (
            <div style={{ marginTop: 10, fontSize: 13, padding: '8px 12px', borderRadius: 8, background: msg.err ? '#FEF2F2' : '#F0FDF4', color: msg.err ? '#DC2626' : '#16A34A' }}>{msg.text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
