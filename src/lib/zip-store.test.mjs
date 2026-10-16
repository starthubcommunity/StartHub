// zip-store.test.mjs — sıkıştırmasız ZIP üretici (D3). Çalıştır: node src/lib/zip-store.test.mjs
// İsteğe bağlı: TEST_ZIP_OUT=yol → örnek zip'i diske yazar (işletim sisteminin açıcısıyla denemek için).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { buildZip, crc32 } from '../../supabase/functions/_shared/zip-store.js';

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; } };

// Bağımsız okuyucu: merkezi dizinden dosyaları çıkarır (yalnızca STORE).
function readZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  assert.ok(e >= 0, 'dizin sonu bulunamadı');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl));
    assert.equal(dv.getUint32(off, true), 0x04034b50);
    const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true);
    const data = buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + size);
    out.push({ name, data, crc });
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return out;
}

t('CRC32 Node\'un kendi hesabıyla aynı', () => {
  for (const s of ['', 'a', 'Pay sözü — ğüşıöç', '%PDF-1.7 ' + 'x'.repeat(5000)]) {
    const b = new TextEncoder().encode(s);
    if (zlib.crc32) assert.equal(crc32(b), zlib.crc32(b));
  }
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);   // standart kontrol değeri
});
t('zip açılınca dosyalar birebir çıkar (ad, içerik, CRC); manifest dahil', () => {
  const pdfA = crypto.randomBytes(20000); pdfA.set(Buffer.from('%PDF-1.7'), 0);
  const pdfB = crypto.randomBytes(512); pdfB.set(Buffer.from('%PDF-1.4'), 0);
  const manifest = `${crypto.createHash('sha256').update(pdfA).digest('hex')}  a.pdf\n`;
  const zip = buildZip([{ name: 'a.pdf', data: new Uint8Array(pdfA) }, { name: 'klasor/b.pdf', data: new Uint8Array(pdfB) }, { name: 'manifest.txt', data: manifest }]);
  const files = readZip(zip);
  assert.deepEqual(files.map((f) => f.name), ['a.pdf', 'klasor/b.pdf', 'manifest.txt']);
  assert.ok(Buffer.from(files[0].data).equals(pdfA));
  assert.ok(Buffer.from(files[1].data).equals(pdfB));
  assert.equal(new TextDecoder().decode(files[2].data), manifest);
  for (const f of files) assert.equal(f.crc, crc32(f.data));
  if (process.env.TEST_ZIP_OUT) fs.writeFileSync(process.env.TEST_ZIP_OUT, zip);
});
t('boş liste geçerli (boş) bir zip üretir', () => {
  const z = buildZip([]);
  assert.equal(z.length, 22); assert.equal(readZip(z).length, 0);
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
