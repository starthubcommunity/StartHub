-- ══════════════════════════════════════════════════════════
-- 0038_join_texts_reset.sql — Katıl sayfası metinleri varsayılana döndürüldü
-- ══════════════════════════════════════════════════════════
-- join_form_settings satırındaki başlık/açıklama alanları admin panelin
-- ÖRNEK (placeholder) metinleriyle dolmuştu ("Öğrenci, geliştirici...",
-- "Deneyimini paylaş..." gibi kesik cümleler). Kullanıcı isteği (2026-09-21):
-- kart açıklamaları eskisi gibi tam metin olsun. Alanlar NULL yapılınca sayfa
-- koddaki varsayılanları gösterir (other-pages.jsx `fs(key, fallback)` / t()).
--
-- Geri dönmek gerekirse (silinen değerler):
--   hero_title_tr='Start-Hub''a Katıl'            hero_title_en='Join Start-Hub'
--   hero_desc_tr='Türkiye girişim ekosistemine katıl.'
--   hero_desc_en='Join Turkey''s startup ecosystem.'
--   community_card_title_tr='Topluluğa Katıl'     community_card_desc_tr='Öğrenci, geliştirici...'
--   mentor_card_title_tr='Mentör Ol'              mentor_card_desc_tr='Deneyimini paylaş...'
--   sponsor_card_title_tr='Destekçi Ol'           sponsor_card_desc_tr='Startup ekosistemine katkı sağla.'
-- field_labels (soru etiketleri) DEĞİŞMEZ.

update join_form_settings set
  hero_title_tr = null, hero_title_en = null,
  hero_desc_tr = null,  hero_desc_en = null,
  community_card_title_tr = null, community_card_desc_tr = null,
  mentor_card_title_tr = null,    mentor_card_desc_tr = null,
  sponsor_card_title_tr = null,   sponsor_card_desc_tr = null,
  updated_at = now()
where id = 1;
