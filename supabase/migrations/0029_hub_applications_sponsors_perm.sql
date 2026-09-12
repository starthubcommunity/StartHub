-- ══════════════════════════════════════════════════════════
-- 0029_hub_applications_sponsors_perm.sql — Başvurular + Destekçiler
-- yönetimi Kurucu Hattı'na (HR) taşınıyor
-- ══════════════════════════════════════════════════════════
-- Kullanıcı kararı: web sitesinden gelen başvurular (applications) ve
-- destekçiler (sponsors — site anasayfasındaki logo şeridi) yönetimi
-- artık admin panelde değil, HR'da (Kurucu Hattı). Aynı tablolar
-- (applications, sponsors) — yalnızca hangi ROL/ALAN üzerinden
-- has_perm() sağlandığı değişiyor. RLS politikaları (apps_read/write/
-- delete, sponsors_write, pub_read_sponsors — 0009) hiç değişmedi;
-- has_perm() zaten area'ya bakmaksızın anahtar bazlı çalışıyor, bu
-- yüzden aynı 'applications.read/write' ve 'sponsors.write' anahtarları
-- burada 'hub' alanına da ekleniyor.
--
-- Başvurular: cofounder + recruiter (aday havuzuyla aynı kapsam).
-- Destekçiler: yalnızca cofounder (site markalaşması/ortaklıklar — bkz.
-- 'settings.write' emsali, recruiter'ın geniş grantından da hariç).

insert into permission_keys (area, key, grp, label, sort_order) values
  ('hub','applications.read','Başvurular','Başvuruları görüntüle',95),
  ('hub','applications.write','Başvurular','Başvuru durumu değiştir / sil',96),
  ('hub','sponsors.read','Destekçiler','Destekçileri görüntüle',97),
  ('hub','sponsors.write','Destekçiler','Destekçi oluştur / düzenle',98)
on conflict (area, key) do nothing;

insert into permission_presets (area, role, key) values
  ('hub','cofounder','applications.read'), ('hub','cofounder','applications.write'),
  ('hub','cofounder','sponsors.read'),     ('hub','cofounder','sponsors.write'),
  ('hub','recruiter','applications.read'), ('hub','recruiter','applications.write')
on conflict do nothing;
