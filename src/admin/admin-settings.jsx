// admin-settings.jsx — Site Ayarları (LinkedIn URL vb.)
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AIcon } from './admin-ui';

// SQL (Supabase SQL Editor'da bir kez çalıştır):
// CREATE TABLE IF NOT EXISTS site_settings (
//   key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW()
// );
// INSERT INTO site_settings(key,value) VALUES('company_linkedin','https://www.linkedin.com/company/111725833/') ON CONFLICT DO NOTHING;
// ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "public read" ON site_settings FOR SELECT USING (true);
// CREATE POLICY "auth write" ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

function SettingsPage() {
  const [linkedin, setLinkedin] = useState('');
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    supabase.from('site_settings').select('key, value').then(({ data, error: e }) => {
      if (e) { setError('site_settings tablosu bulunamadı. Lütfen SQL\'i çalıştırın.'); }
      else {
        const map = {};
        (data || []).forEach(r => { map[r.key] = r.value; });
        setLinkedin(map['company_linkedin'] || 'https://www.linkedin.com/company/111725833/');
      }
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    const { error: e } = await supabase.from('site_settings').upsert({ key: 'company_linkedin', value: linkedin.trim() });
    if (e) setError(e.message);
    else setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!loaded) return (
    <div style={{ padding: 32, color: 'var(--adm-text-dim)', fontSize: 14 }}>Yükleniyor…</div>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--adm-text)', marginBottom: 4, letterSpacing: '-0.02em' }}>Site Ayarları</div>
      <div style={{ fontSize: 14, color: 'var(--adm-text-dim)', marginBottom: 28 }}>Sitede dinamik olarak değişen bağlantı ve konfigürasyonlar.</div>

      <div style={{ background: 'var(--adm-card)', border: '1px solid var(--adm-border-light)', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, color: 'var(--adm-text)', marginBottom: 4 }}>Sosyal Medya</div>
        <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 18 }}>Siteye yansıyan bağlantılar.</div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            <AIcon name="linkedin" size={14} /> Şirket LinkedIn URL
          </label>
          <input
            type="url"
            value={linkedin}
            onChange={e => setLinkedin(e.target.value)}
            placeholder="https://www.linkedin.com/company/..."
            style={{ width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--adm-border-light)', background: 'var(--adm-bg)', fontSize: 14, color: 'var(--adm-text)', boxSizing: 'border-box', fontFamily: 'var(--font-body)', outline: 'none' }}
          />
          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 6 }}>
            Footer ve Hakkımızda sayfasındaki LinkedIn linkleri bu URL'i kullanır.
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 13px', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 9, border: 'none', background: saved ? 'var(--adm-green)' : '#DC2626', color: '#fff', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          <AIcon name={saved ? 'check' : 'save'} size={15} />
          {saving ? 'Kaydediliyor…' : saved ? 'Kaydedildi!' : 'Kaydet'}
        </button>
      </div>

      <div style={{ background: 'var(--adm-card)', border: '1px solid var(--adm-border-light)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 13, color: 'var(--adm-text)', marginBottom: 10 }}>
          <AIcon name="code" size={14} style={{ marginRight: 6 }} />Supabase SQL (bir kez çalıştır)
        </div>
        <pre style={{ fontSize: 11.5, color: 'var(--adm-text-dim)', background: 'var(--adm-bg)', borderRadius: 8, padding: 14, overflowX: 'auto', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{`CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO site_settings(key, value)
VALUES('company_linkedin', 'https://www.linkedin.com/company/111725833/')
ON CONFLICT DO NOTHING;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON site_settings FOR SELECT USING (true);
CREATE POLICY "auth write" ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);`}</pre>
      </div>
    </div>
  );
}

export { SettingsPage };
