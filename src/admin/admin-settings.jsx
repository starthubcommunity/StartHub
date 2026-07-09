// admin-settings.jsx — Site Ayarları (kimlik, sosyal medya, duyuru, bakım modu)
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AIcon, Field, Input, Textarea } from './admin-ui';

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
      updated_at: new Date().toISOString(),
    });
    if (e) setJoinError(e.message);
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
      <div style={{ fontSize: 13, color: 'var(--adm-text-dim)', marginBottom: 16 }}>Katıl sayfasındaki başlık, açıklama ve 3 kartın metinleri — boş bırakılan alanlar varsayılan metni kullanır.</div>

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
            <div className="adm-card__header"><h3>3 Kart Metinleri</h3></div>
            <div className="adm-card__body">
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
