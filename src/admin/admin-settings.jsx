// admin-settings.jsx — Site Ayarları (kimlik, sosyal medya, duyuru, bakım modu)
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AIcon, Field, Input, Textarea } from './admin-ui';
import { DEFAULT_TEAM_AREAS, TEAM_AREA_ICONS } from '../join-defaults';

// Ekip alanı anahtarı: etiketten slug + kısa rastgele ek (aynı ada sahip iki ekip çakışmasın).
const areaKey = (label) =>
  (label || 'ekip').toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6);

const FIELD_LABEL_GROUPS = [
  { title: 'Topluluk Formu', fields: [
    ['c_name', 'Ad Soyad'], ['c_email', 'E-posta'], ['c_university', 'Üniversite'],
    ['c_department', 'Bölüm'], ['c_role', 'İlgi Alanı'], ['c_bio', 'Kısa Tanıtım'],
    ['c_skills', 'Yetenekler'], ['c_linkedin', 'LinkedIn'], ['c_portfolio', 'Portfolyo / GitHub'],
  ] },
  { title: 'Mentör Formu', fields: [
    ['m_name', 'Ad Soyad'], ['m_email', 'E-posta'], ['m_expertise', 'Uzmanlık Alanı'],
    ['m_experience', 'Deneyim Yılı'], ['m_hours', 'Haftalık Uygun Saat'], ['m_company', 'Mevcut Şirket / Kurum'],
    ['m_linkedin', 'LinkedIn'], ['m_note', 'Neden mentör olmak istiyorsunuz?'],
  ] },
  { title: 'Destekçi Formu', fields: [
    ['s_contact', 'İletişim Kişisi'], ['s_email', 'E-posta'], ['s_company', 'Şirket / Kurum Adı'],
    ['s_website', 'Web Sitesi'], ['s_collab', 'İşbirliği Türü'], ['s_message', 'Mesajınız'],
  ] },
];

function SettingsPage() {
  const [siteName,           setSiteName]           = useState('Start-Hub');
  const [siteTaglineTr,      setSiteTaglineTr]      = useState('');
  const [siteTaglineEn,      setSiteTaglineEn]      = useState('');
  const [contactEmail,       setContactEmail]       = useState('iletisim@starthub-community.com');
  const [companyLinkedin,    setCompanyLinkedin]    = useState('https://www.linkedin.com/company/111725833/');
  const [twitterUrl,         setTwitterUrl]         = useState('');
  const [instagramUrl,       setInstagramUrl]       = useState('');
  const [announcementText,   setAnnouncementText]   = useState('');
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [maintenanceMode,    setMaintenanceMode]    = useState(false);

  const [loaded,  setLoaded]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  // Katılım formu (join_form_settings tablosu — ayrı kayıt)
  const [heroTitleTr,  setHeroTitleTr]  = useState('');
  const [heroTitleEn,  setHeroTitleEn]  = useState('');
  const [heroDescTr,   setHeroDescTr]   = useState('');
  const [heroDescEn,   setHeroDescEn]   = useState('');
  const [communityTitleTr, setCommunityTitleTr] = useState('');
  const [communityDescTr,  setCommunityDescTr]  = useState('');
  const [mentorTitleTr,    setMentorTitleTr]    = useState('');
  const [mentorDescTr,     setMentorDescTr]     = useState('');
  const [sponsorTitleTr,   setSponsorTitleTr]   = useState('');
  const [sponsorDescTr,    setSponsorDescTr]    = useState('');
  const [joinLoaded, setJoinLoaded] = useState(false);
  const [joinSaving, setJoinSaving] = useState(false);
  const [joinSaved,  setJoinSaved]  = useState(false);
  const [joinError,  setJoinError]  = useState('');
  const [fieldLabels, setFieldLabels] = useState({});
  const setFieldLabel = (key, value) => setFieldLabels(prev => ({ ...prev, [key]: value }));

  // HUB / LAB (0035) — kart metinleri, kulüp ekip alanları, başvuru sonrası bağlantılar
  const [hubTitleTr, setHubTitleTr] = useState('');
  const [hubDescTr,  setHubDescTr]  = useState('');
  const [labTitleTr, setLabTitleTr] = useState('');
  const [labDescTr,  setLabDescTr]  = useState('');
  const [teamAreas,  setTeamAreas]  = useState(DEFAULT_TEAM_AREAS);
  const [hubWhatsapp,  setHubWhatsapp]  = useState('');
  const [hubInstagram, setHubInstagram] = useState('');
  const [labWhatsapp,  setLabWhatsapp]  = useState('');
  const [labLinkedin,  setLabLinkedin]  = useState('');
  const [hubNoteTr, setHubNoteTr] = useState('');
  const [labNoteTr, setLabNoteTr] = useState('');
  const patchArea = (i, patch) => setTeamAreas(prev => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const moveArea = (i, dir) => setTeamAreas(prev => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = prev.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const removeArea = (i) => setTeamAreas(prev => prev.filter((_, j) => j !== i));
  const addArea = () => setTeamAreas(prev => [...prev, { key: areaKey('ekip'), label: '', label_en: '', desc: '', icon: 'star', active: true }]);

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        if (data.site_name)          setSiteName(data.site_name);
        if (data.site_tagline_tr != null) setSiteTaglineTr(data.site_tagline_tr);
        if (data.site_tagline_en != null) setSiteTaglineEn(data.site_tagline_en);
        if (data.contact_email)      setContactEmail(data.contact_email);
        if (data.company_linkedin)   setCompanyLinkedin(data.company_linkedin);
        if (data.twitter_url != null) setTwitterUrl(data.twitter_url);
        if (data.instagram_url != null) setInstagramUrl(data.instagram_url);
        if (data.announcement_text != null) setAnnouncementText(data.announcement_text);
        setAnnouncementActive(data.announcement_active ?? false);
        setMaintenanceMode(data.maintenance_mode ?? false);
      }
      setLoaded(true);
    });
    supabase.from('join_form_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        if (data.hero_title_tr != null) setHeroTitleTr(data.hero_title_tr);
        if (data.hero_title_en != null) setHeroTitleEn(data.hero_title_en);
        if (data.hero_desc_tr != null)  setHeroDescTr(data.hero_desc_tr);
        if (data.hero_desc_en != null)  setHeroDescEn(data.hero_desc_en);
        if (data.community_card_title_tr != null) setCommunityTitleTr(data.community_card_title_tr);
        if (data.community_card_desc_tr != null)  setCommunityDescTr(data.community_card_desc_tr);
        if (data.mentor_card_title_tr != null)    setMentorTitleTr(data.mentor_card_title_tr);
        if (data.mentor_card_desc_tr != null)     setMentorDescTr(data.mentor_card_desc_tr);
        if (data.sponsor_card_title_tr != null)   setSponsorTitleTr(data.sponsor_card_title_tr);
        if (data.sponsor_card_desc_tr != null)    setSponsorDescTr(data.sponsor_card_desc_tr);
        if (data.field_labels && typeof data.field_labels === 'object') setFieldLabels(data.field_labels);
        if (data.hub_card_title_tr != null) setHubTitleTr(data.hub_card_title_tr);
        if (data.hub_card_desc_tr != null)  setHubDescTr(data.hub_card_desc_tr);
        if (data.lab_card_title_tr != null) setLabTitleTr(data.lab_card_title_tr);
        if (data.lab_card_desc_tr != null)  setLabDescTr(data.lab_card_desc_tr);
        if (Array.isArray(data.team_areas) && data.team_areas.length) setTeamAreas(data.team_areas);
        if (data.hub_whatsapp_url != null)  setHubWhatsapp(data.hub_whatsapp_url);
        if (data.hub_instagram_url != null) setHubInstagram(data.hub_instagram_url);
        if (data.lab_whatsapp_url != null)  setLabWhatsapp(data.lab_whatsapp_url);
        if (data.lab_linkedin_url != null)  setLabLinkedin(data.lab_linkedin_url);
        if (data.hub_success_note_tr != null) setHubNoteTr(data.hub_success_note_tr);
        if (data.lab_success_note_tr != null) setLabNoteTr(data.lab_success_note_tr);
      }
      setJoinLoaded(true);
    });
  }, []);

  const handleJoinSave = async () => {
    setJoinSaving(true); setJoinError(''); setJoinSaved(false);
    const { error: e } = await supabase.from('join_form_settings').upsert({
      id: 1,
      hero_title_tr: heroTitleTr,
      hero_title_en: heroTitleEn,
      hero_desc_tr:  heroDescTr,
      hero_desc_en:  heroDescEn,
      community_card_title_tr: communityTitleTr,
      community_card_desc_tr:  communityDescTr,
      mentor_card_title_tr:    mentorTitleTr,
      mentor_card_desc_tr:     mentorDescTr,
      sponsor_card_title_tr:   sponsorTitleTr,
      sponsor_card_desc_tr:    sponsorDescTr,
      field_labels: fieldLabels,
      hub_card_title_tr: hubTitleTr,
      hub_card_desc_tr:  hubDescTr,
      lab_card_title_tr: labTitleTr,
      lab_card_desc_tr:  labDescTr,
      // Adı boş bırakılan ekip satırları kaydedilmez.
      team_areas: teamAreas.filter(a => (a.label || '').trim()).map(a => ({ ...a, label: a.label.trim() })),
      hub_whatsapp_url:  hubWhatsapp.trim(),
      hub_instagram_url: hubInstagram.trim(),
      lab_whatsapp_url:  labWhatsapp.trim(),
      lab_linkedin_url:  labLinkedin.trim(),
      hub_success_note_tr: hubNoteTr,
      lab_success_note_tr: labNoteTr,
      updated_at: new Date().toISOString(),
    });
    if (e) setJoinError(/column|schema cache/i.test(e.message)
      ? `${e.message} — 0035_join_hub_lab.sql migration'ı henüz veritabanına uygulanmamış olabilir.`
      : e.message);
    else { setJoinSaved(true); setTimeout(() => setJoinSaved(false), 3000); }
    setJoinSaving(false);
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    const { error: e } = await supabase.from('site_settings').upsert({
      id: 1,
      site_name:           siteName,
      site_tagline_tr:     siteTaglineTr,
      site_tagline_en:     siteTaglineEn,
      contact_email:       contactEmail,
      company_linkedin:    companyLinkedin,
      twitter_url:         twitterUrl,
      instagram_url:       instagramUrl,
      announcement_text:   announcementText,
      announcement_active: announcementActive,
      maintenance_mode:    maintenanceMode,
      updated_at:          new Date().toISOString(),
    });
    if (e) setError(e.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  if (!loaded) return (
    <div style={{ padding: 32, color: 'var(--adm-text-dim)', fontSize: 14 }}>Yükleniyor…</div>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: 'var(--adm-text)', marginBottom: 4, letterSpacing: '-0.02em' }}>Site Ayarları</div>
      <div style={{ fontSize: 14, color: 'var(--adm-text-dim)', marginBottom: 24 }}>Sitede dinamik olarak değişen kimlik, bağlantı ve durum ayarları.</div>

      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div className="adm-card__header"><h3>Site Kimliği</h3></div>
        <div className="adm-card__body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Site Adı">
              <Input value={siteName} onChange={setSiteName} placeholder="Start-Hub" />
            </Field>
            <Field label="İletişim E-postası">
              <Input type="email" value={contactEmail} onChange={setContactEmail} placeholder="iletisim@..." />
            </Field>
            <Field label="Slogan (TR)">
              <Input value={siteTaglineTr} onChange={setSiteTaglineTr} placeholder="Fikirlerden girişimlere." />
            </Field>
            <Field label="Slogan (EN)">
              <Input value={siteTaglineEn} onChange={setSiteTaglineEn} placeholder="From ideas to startups." />
            </Field>
          </div>
        </div>
      </div>

      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div className="adm-card__header"><h3>Sosyal Medya</h3></div>
        <div className="adm-card__body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Şirket LinkedIn URL">
              <Input value={companyLinkedin} onChange={setCompanyLinkedin} placeholder="https://www.linkedin.com/company/..." />
            </Field>
            <Field label="Twitter / X URL">
              <Input value={twitterUrl} onChange={setTwitterUrl} placeholder="https://x.com/..." />
            </Field>
            <Field label="Instagram URL">
              <Input value={instagramUrl} onChange={setInstagramUrl} placeholder="https://instagram.com/..." />
            </Field>
          </div>
          <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginTop: 12 }}>
            Footer ve Hakkımızda sayfasındaki bağlantılar bu alanları kullanır.
          </div>
        </div>
      </div>

      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div className="adm-card__header"><h3>Duyuru Bandı</h3></div>
        <div className="adm-card__body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>Açıkken tüm site sayfalarının üstünde gösterilir.</div>
            <label className="adm-switch">
              <input type="checkbox" checked={announcementActive} onChange={e => setAnnouncementActive(e.target.checked)} />
              <span></span>
            </label>
          </div>
          <Field label="Duyuru Metni">
            <Textarea value={announcementText} onChange={setAnnouncementText} rows={2} placeholder="ör. Aylık buluşmamız 12 Temmuz Cumartesi 15:00'te!" />
          </Field>
        </div>
      </div>

      <div className="adm-card" style={{ marginBottom: 20 }}>
        <div className="adm-card__header"><h3>Bakım Modu</h3></div>
        <div className="adm-card__body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)' }}>Açıkken ziyaretçilere "Bakımdayız" sayfası gösterilir. Admin paneli etkilenmez.</div>
              {maintenanceMode && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
                  ⚠ Site şu an bakım modunda — ziyaretçiler sayfayı göremez!
                </div>
              )}
            </div>
            <label className="adm-switch">
              <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} />
              <span></span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 13px', marginBottom: 16 }}>
          Kaydedilemedi: {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="adm-btn adm-btn--primary">
        <AIcon name={saved ? 'check' : 'save'} size={15} />
        {saving ? 'Kaydediliyor…' : saved ? 'Kaydedildi!' : 'Tüm Ayarları Kaydet'}
      </button>

      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: 'var(--adm-text)', margin: '36px 0 4px', letterSpacing: '-0.01em' }}>Katılım Formu</div>
      <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 16 }}>Katıl sayfasındaki (HUB / LAB akışı) başlık, kart metinleri, kulüp ekipleri ve başvuru sonrası bağlantılar — boş bırakılan alanlar varsayılan metni kullanır.</div>

      {!joinLoaded ? (
        <div style={{ padding: 20, color: 'var(--adm-text-dim)', fontSize: 14 }}>Yükleniyor…</div>
      ) : (
        <>
          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Sayfa Başlığı</h3></div>
            <div className="adm-card__body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Başlık (TR)"><Input value={heroTitleTr} onChange={setHeroTitleTr} placeholder="Start-Hub'a Katıl" /></Field>
                <Field label="Başlık (EN)"><Input value={heroTitleEn} onChange={setHeroTitleEn} placeholder="Join Start-Hub" /></Field>
                <Field label="Açıklama (TR)"><Textarea value={heroDescTr} onChange={setHeroDescTr} rows={2} placeholder="Türkiye girişim ekosistemine katıl." /></Field>
                <Field label="Açıklama (EN)"><Textarea value={heroDescEn} onChange={setHeroDescEn} rows={2} placeholder="Join Turkey's startup ecosystem." /></Field>
              </div>
            </div>
          </div>

          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>HUB / LAB Seçim Kartları</h3></div>
            <div className="adm-card__body">
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 14 }}>
                Katıl sayfasının ilk ekranındaki iki büyük kart. "HUB" ve "LAB" yazıları sabittir; etiket ve açıklama buradan değişir.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="HUB — Etiket"><Input value={hubTitleTr} onChange={setHubTitleTr} placeholder="Topluluk & Kulüp" /></Field>
                <Field label="LAB — Etiket"><Input value={labTitleTr} onChange={setLabTitleTr} placeholder="Girişim Laboratuvarı" /></Field>
                <Field label="HUB — Açıklama"><Textarea value={hubDescTr} onChange={setHubDescTr} rows={3} placeholder="Start-Hub topluluğunun kalbi..." /></Field>
                <Field label="LAB — Açıklama"><Textarea value={labDescTr} onChange={setLabDescTr} rows={3} placeholder="Fikirlerin ekiplerle buluşup girişime dönüştüğü yer..." /></Field>
              </div>
            </div>
          </div>

          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Kulüp Ekip Alanları (HUB › Ekip Üyesi)</h3></div>
            <div className="adm-card__body">
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 14 }}>
                Katılımcıların başvurabileceği ekipler. Pasif yapılan ekip sitede görünmez; adı boş bırakılan satır kaydedilmez.
                Ekip adı başvuruyla birlikte HR'a düşer ("tasarım", "sosyal medya", "sponsor" gibi kelimeler aday türünü otomatik belirler).
              </div>
              {teamAreas.map((a, i) => (
                <div key={a.key || i} style={{ border: '1px solid var(--adm-border)', borderRadius: 10, padding: 14, marginBottom: 12, opacity: a.active === false ? 0.6 : 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 150px', gap: 12 }}>
                    <Field label="Ekip Adı (TR)"><Input value={a.label} onChange={v => patchArea(i, { label: v })} placeholder="Sosyal Medya" /></Field>
                    <Field label="Ekip Adı (EN)"><Input value={a.label_en} onChange={v => patchArea(i, { label_en: v })} placeholder="Social Media" /></Field>
                    <Field label="İkon">
                      <select className="adm-input adm-select" value={a.icon || 'star'} onChange={e => patchArea(i, { icon: e.target.value })}>
                        {TEAM_AREA_ICONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Kısa Açıklama"><Input value={a.desc} onChange={v => patchArea(i, { desc: v })} placeholder="Bu ekip ne yapar?" /></Field>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <label className="adm-switch" title="Sitede göster">
                      <input type="checkbox" checked={a.active !== false} onChange={e => patchArea(i, { active: e.target.checked })} />
                      <span></span>
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--adm-text-dim)', flex: 1 }}>{a.active === false ? 'Pasif' : 'Aktif'}</span>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => moveArea(i, -1)} disabled={i === 0}>↑</button>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => moveArea(i, 1)} disabled={i === teamAreas.length - 1}>↓</button>
                    <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => removeArea(i)}><AIcon name="trash" size={14} /> Sil</button>
                  </div>
                </div>
              ))}
              <button type="button" className="adm-btn adm-btn--ghost" onClick={addArea}><AIcon name="plus" size={15} /> Ekip Ekle</button>
            </div>
          </div>

          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Başvuru Sonrası Bağlantılar</h3></div>
            <div className="adm-card__body">
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 14 }}>
                Form gönderildikten sonra "Tamam" ekranında çıkan butonlar. Boş bırakılan bağlantı gösterilmez.
                HUB Instagram boşsa Site Ayarları'ndaki Instagram, LAB LinkedIn boşsa şirket LinkedIn'i kullanılır.
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>HUB</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <Field label="WhatsApp Grup Linki"><Input value={hubWhatsapp} onChange={setHubWhatsapp} placeholder="https://chat.whatsapp.com/..." /></Field>
                <Field label="Instagram"><Input value={hubInstagram} onChange={setHubInstagram} placeholder="https://instagram.com/..." /></Field>
              </div>
              <Field label="HUB — Ek Not (opsiyonel)"><Textarea value={hubNoteTr} onChange={setHubNoteTr} rows={2} placeholder="ör. Bu hafta perşembe 19:00'da tanışma buluşmamız var!" /></Field>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '18px 0 10px' }}>LAB</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <Field label="WhatsApp Grup Linki"><Input value={labWhatsapp} onChange={setLabWhatsapp} placeholder="https://chat.whatsapp.com/..." /></Field>
                <Field label="LinkedIn"><Input value={labLinkedin} onChange={setLabLinkedin} placeholder="https://www.linkedin.com/company/..." /></Field>
              </div>
              <Field label="LAB — Ek Not (opsiyonel)"><Textarea value={labNoteTr} onChange={setLabNoteTr} rows={2} placeholder="ör. Başvurunu 3 iş günü içinde değerlendiriyoruz." /></Field>
            </div>
          </div>

          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Topluluk / Mentör / Destekçi Metinleri</h3></div>
            <div className="adm-card__body">
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 14 }}>
                "Topluluğa Katıl" HUB yol ekranındaki büyük kartta; Mentör / Destekçi ise ilk ekranın altındaki kısa yol düğmelerinde görünür (başlık alanları).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <Field label="Topluluk — Başlık"><Input value={communityTitleTr} onChange={setCommunityTitleTr} placeholder="Topluluğa Katıl" /></Field>
                <Field label="Mentör — Başlık"><Input value={mentorTitleTr} onChange={setMentorTitleTr} placeholder="Mentör Ol" /></Field>
                <Field label="Destekçi — Başlık"><Input value={sponsorTitleTr} onChange={setSponsorTitleTr} placeholder="Destekçi Ol" /></Field>
                <Field label="Topluluk — Açıklama"><Textarea value={communityDescTr} onChange={setCommunityDescTr} rows={2} placeholder="Öğrenci, geliştirici..." /></Field>
                <Field label="Mentör — Açıklama"><Textarea value={mentorDescTr} onChange={setMentorDescTr} rows={2} placeholder="Deneyimini paylaş..." /></Field>
                <Field label="Destekçi — Açıklama"><Textarea value={sponsorDescTr} onChange={setSponsorDescTr} rows={2} placeholder="Startup ekosistemine katkı sağla." /></Field>
              </div>
            </div>
          </div>

          <div className="adm-card" style={{ marginBottom: 20 }}>
            <div className="adm-card__header"><h3>Form Soru Etiketleri</h3></div>
            <div className="adm-card__body">
              <div style={{ fontSize: 12, color: 'var(--adm-text-dim)', marginBottom: 16 }}>
                Formlardaki alan başlıklarını değiştir — boş bırakılırsa varsayılan metin kullanılır.
              </div>
              {FIELD_LABEL_GROUPS.map(group => (
                <div key={group.title} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>{group.title}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {group.fields.map(([key, defaultLabel]) => (
                      <Field key={key} label={defaultLabel}>
                        <Input value={fieldLabels[key] || ''} onChange={v => setFieldLabel(key, v)} placeholder={defaultLabel} />
                      </Field>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {joinError && (
            <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 13px', marginBottom: 16 }}>
              Kaydedilemedi: {joinError}
            </div>
          )}

          <button
            onClick={handleJoinSave}
            disabled={joinSaving}
            className="adm-btn adm-btn--primary">
            <AIcon name={joinSaved ? 'check' : 'save'} size={15} />
            {joinSaving ? 'Kaydediliyor…' : joinSaved ? 'Kaydedildi!' : 'Katılım Formunu Kaydet'}
          </button>
        </>
      )}
    </div>
  );
}

export { SettingsPage };
