// hub-access-request-logic.test.mjs — Team App erişim talebi (profili olmayan giriş), saf mantık.
// Çalıştır: node src/hub/hub-access-request-logic.test.mjs  (Node 22+ .ts tip ayıklama)
import assert from 'node:assert/strict';
import { computeAccessRequest } from '../../supabase/functions/hub-team-access-request/logic.ts';

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  X   ' + name + '\n      ' + e.message); process.exitCode = 1; } };
let n = 0; const uid = () => 'n' + (++n);
const base = () => ({
  users: [{ id: 1, email: 'admin@x.com', role: 'admin' }, { id: 2, email: 'k@x.com', role: 'admin' }, { id: 3, email: 'uye@x.com', role: 'member', team: 'A' }],
  notifications: [{ id: 'eski', forUser: 3 }], teams: [{ id: 'A' }], _at: 1,
});
const H = 3600e3;

t('profili olan kişi → talep yazılmaz, hiçbir şey değişmez', () => {
  const r = computeAccessRequest(base(), { email: 'UYE@x.com', now: 1000, uid });
  assert.equal(r.hasProfile, true); assert.equal(r.changed, false);
});
t('yeni talep: kayıt + her admin\'e bir bildirim; users DOKUNULMAZ', () => {
  const d = base();
  const r = computeAccessRequest(d, { email: 'Yeni@x.com', name: 'Yeni Kişi', now: 1000, uid });
  assert.equal(r.isNew, true); assert.equal(r.notified, 2);
  assert.deepEqual(r.snapshot.users, d.users);
  assert.equal(r.snapshot.accessRequests[0].email, 'yeni@x.com');
  assert.equal(r.snapshot.notifications.length, 3);
  assert.ok(r.snapshot.notifications.slice(0, 2).every((x) => x.type === 'access_request' && [1, 2].includes(x.forUser)));
});
t('tekrar deneme: yeni kayıt açılmaz, sayaç artar; 24 saat dolmadan yeni bildirim yok', () => {
  const r1 = computeAccessRequest(base(), { email: 'yeni@x.com', now: 1000, uid });
  const r2 = computeAccessRequest(r1.snapshot, { email: 'yeni@x.com', now: 1000 + 2 * H, uid });
  assert.equal(r2.snapshot.accessRequests.length, 1);
  assert.equal(r2.snapshot.accessRequests[0].attempts, 2);
  assert.equal(r2.notified, 0);
  const r3 = computeAccessRequest(r2.snapshot, { email: 'yeni@x.com', now: 1000 + 25 * H, uid });
  assert.equal(r3.notified, 2);
});
t('ad yoksa e-postanın baş kısmı; geçersiz e-posta reddedilir', () => {
  const r = computeAccessRequest(base(), { email: 'ali.veli@x.com', now: 1, uid });
  assert.equal(r.snapshot.accessRequests[0].name, 'ali.veli');
  assert.equal(computeAccessRequest(base(), { email: 'yok', now: 1, uid }).ok, false);
});

console.log(`\n${pass} senaryo geçti${process.exitCode ? ' — BAŞARISIZ var' : ''}`);
