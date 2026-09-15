-- ══════════════════════════════════════════════════════════
-- 0032_restore_tid_cevirici.sql — admin panelin "Yeni İşaretle" butonu
-- updateItem()'in tam-satır-ezme hatası yüzünden TİD Çevirici'nin (id
-- 1783765240065) tüm içerik alanlarını boşaltmıştı. updateItem artık
-- düzeltildi (bkz. src/admin/admin-store.jsx) — bu migration yalnızca
-- KAYBOLAN VERİYİ, bu oturumun önceki kayıtlarından (daha önce defalarca
-- okunup doğrulanmıştı) geri yüklüyor. featured/trending/is_new/published
-- durum alanlarına DOKUNULMUYOR (kullanıcının admin panelden en son
-- ayarladığı hâl korunuyor).
-- ══════════════════════════════════════════════════════════

update startups set
  slug = 'tid-cevirici',
  name = 'TİD Çevirici',
  color = '#2563EB',
  stage = 'mvp',
  tagline_tr = 'İşaret dili artık herkes için anlaşılır',
  tagline_en = 'Sign language, understood by everyone',
  desc_tr = 'Gerçek zamanlı Türk İşaret Dili tanıma ve çeviri uygulaması.',
  desc_en = 'Real-time Turkish Sign Language recognition and translation app.',
  about_tr = 'TİD Çevirici, kamera görüntüsünden Türk İşaret Dili''ni yapay zekâ ile anlık olarak tanıyıp metne ve sese dönüştüren çapraz platform bir mobil uygulamadır.',
  about_en = 'TİD Çevirici is a cross-platform mobile app that uses AI to recognize Turkish Sign Language from camera input in real time and convert it into text and speech.',
  problem_tr = 'İşitme engelli bireylerle işaret dili bilmeyenler arasındaki iletişim, tercüman gerektirdiği için günlük hayatta erişilemez kalıyor.',
  problem_en = 'Communication between deaf individuals and non-signers remains inaccessible in daily life, as it requires an interpreter.',
  solution_tr = 'Mobil kameradan alınan görüntüyü anlık sınıflandırarak işaret dilini metin ve sesli çıktıya dönüştüren yapay zekâ destekli bir uygulama.',
  solution_en = 'An AI-powered app that classifies live camera input in real time, turning sign language into text and speech output.',
  tags = ARRAY['AI','Mobil','Erişilebilirlik'],
  team = 4,
  lead_id = '1783861541278o8wtpd',
  member_ids = ARRAY['1783861541278o8wtpd'],
  team_app_id = 'A'
where id = 1783765240065;
