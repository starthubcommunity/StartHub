// _shared/resource-files.js — Ekip Paneli "Kaynaklar" PDF kuralları (C, 0062). Saf JS.
// Team App fonksiyonu (yetki) + ana proje köprüsü (sınırlar, başlık) ortak kullanır.
export const GENERAL_RES = '__GENERAL__';
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_TEAM = 25;          // Genel için de 25
export const PENDING_TTL_MS = 60 * 60 * 1000;  // tamamlanmamış yükleme 1 saat sonra temizlenir

// Dosya adı: Türkçe harfler ASCII'ye, güvenli karakterler, .pdf ile biter, en fazla 80 karakter.
export function cleanFileName(name) {
  const base = String(name || '').replace(/\.pdf$/i, '')
    .replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ -]+/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 76);
  return `${base || 'belge'}.pdf`;
}

export function validateUpload({ fileName, size, readyCount }) {
  if (!/\.pdf$/i.test(String(fileName || ''))) return 'Yalnızca PDF yüklenebilir.';
  const n = Number(size);
  if (!(n > 0)) return 'Dosya boş görünüyor.';
  if (n > MAX_PDF_BYTES) return 'Dosya 10 MB\'tan büyük.';
  if (Number(readyCount) >= MAX_FILES_PER_TEAM) return `Bu ekipte en fazla ${MAX_FILES_PER_TEAM} PDF olabilir — önce eskilerden birini sil.`;
  return null;
}

// Gerçek PDF mi? (uzantı/MIME yalan söyleyebilir) — ilk baytlar "%PDF-"
export function isPdfHeader(bytes) {
  const b = bytes || [];
  return b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;
}

// ── Yetki (Team App app_state kullanıcısı üzerinden, sunucuda hesaplanır) ──
const teamsOf = (u) => ((u?.teams && u.teams.length) ? u.teams : (u?.team ? [u.team] : []));
const effRole = (u, tid) => (u?.teamRoles && u.teamRoles[tid]) || u?.role;
// Yükleme/silme: admin her yerde; lead yalnızca kendi ekibinde; Genel yalnızca admin.
export function canManageResFiles(user, teamId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (teamId === GENERAL_RES) return false;
  return teamsOf(user).map(String).includes(String(teamId)) && effRole(user, teamId) === 'lead';
}
// İndirme: admin/cto her yerde; ekip üyesi (ve o ekibin mentörü) kendi ekibinde; Genel herkese.
export function canReadResFiles(user, teamId) {
  if (!user) return false;
  if (teamId === GENERAL_RES) return true;
  if (user.role === 'admin' || user.role === 'cto') return true;
  if (teamsOf(user).map(String).includes(String(teamId))) return true;
  return (user.mentorTeams || []).map(String).includes(String(teamId));
}
