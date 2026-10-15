-- ══════════════════════════════════════════════════════════
-- 0063_contract_test_email_3.sql — test izin listesine üçüncü adres
-- ══════════════════════════════════════════════════════════
-- Otomatik "Ekibe Al → sözleşme" zincirini uçtan uca denemek için: mevcut iki test
-- adresi HR'da eski test adaylarına kayıtlı (hub_candidates e-postası tekil), yeni
-- aday açılamıyor. Gmail "+" takma adı aynı gelen kutusuna düşer ama HR ve Team App
-- için ayrı bir e-postadır.
-- Liste arayüzden değiştirilemez (0060 contract_settings_guard yalnızca
-- authenticated/anon'u engeller); bu migration postgres rolüyle çalışır.
-- Tekrar çalıştırılırsa adresi ikinci kez eklemez. Denetim izi (equity_audit) otomatik.
update contract_settings
   set test_emails = test_emails || array['starthub.community+test1@gmail.com']
 where id = 1
   and not ('starthub.community+test1@gmail.com' = any(test_emails));

-- GERİ ALMA:
--   update contract_settings
--      set test_emails = array_remove(test_emails, 'starthub.community+test1@gmail.com')
--    where id = 1;
