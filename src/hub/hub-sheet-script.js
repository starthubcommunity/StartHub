// hub-sheet-script.js — Hub başvuru tablosu için Google Apps Script kodu.
// HR › Ayarlar › "Hub Başvuru Tablosu" bunu gösterir; kullanıcı Google Sheets'te
// Uzantılar › Apps Script'e yapıştırıp "Web uygulaması" olarak dağıtır. Gizli anahtar
// kodun içine otomatik yazılır (bağlantıyı başkası kullanamasın).
//
// Davranış: her satırın son sütunu ID'dir; aynı ID ikinci kez eklenmez (geri aktarım
// güvenle tekrarlanabilir). Durum sütununda açılır liste vardır — yönetim tabloda yapılır.

export const SHEET_NAME = 'Hub Başvuruları';

export function buildAppsScript(secret) {
  return `// Start-Hub — Hub başvuruları (otomatik alım)
const SECRET = '${secret}';
const SHEET_NAME = '${SHEET_NAME}';
const HEADERS = ['Tarih', 'Tür', 'Ad Soyad', 'E-posta', 'Telefon', 'Üniversite', 'Bölüm', 'Birim', 'Kurum', 'Detay', 'Durum', 'Notlar', 'ID'];
const STATUSES = ['Yeni', 'İletişime geçildi', 'Gruba eklendi', 'Ekipte', 'Olumsuz'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return out_({ ok: false, error: 'gizli anahtar uyuşmuyor' });
    const sh = sheet_();
    const last = sh.getLastRow();
    const seen = {};
    if (last > 1) sh.getRange(2, HEADERS.length, last - 1, 1).getValues().forEach(function (r) { seen[String(r[0])] = true; });
    const rows = (body.rows || []).filter(function (r) { return !seen[String(r.id)]; }).map(function (r) {
      return [r.created_at ? new Date(r.created_at) : new Date(), r.type || '', r.name || '', r.email || '', r.phone || '',
        r.university || '', r.department || '', r.unit || '', r.organization || '', r.detail || '', r.status || 'Yeni', '', String(r.id)];
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    return out_({ ok: true, added: rows.length });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out_({ ok: true, sheet: SHEET_NAME }); }

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#1C1917').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, 2000, 1).setNumberFormat('dd.MM.yyyy HH:mm');
    sh.getRange(2, 5, 2000, 1).setNumberFormat('@');
    sh.getRange(2, 11, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
    [150, 130, 170, 220, 120, 160, 150, 120, 160, 320, 140, 220, 90].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  }
  return sh;
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
}
