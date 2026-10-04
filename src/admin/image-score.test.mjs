// Görsel skoru paritesi: automation/tests/test_image_parity.py ile AYNI fixture'ı kullanır.
// Çalıştırma: node src/admin/image-score.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { rankImages, imageFlags, usageCounts } from './image-score.js';
import { SCORE } from './image-constants.js';

const fx = JSON.parse(fs.readFileSync(new URL('../../automation/tests/fixtures/image_parity.json', import.meta.url), 'utf8'));
const now = Date.parse(fx.now);
const usage90 = usageCounts(fx.history, now, SCORE.USAGE_WINDOW_DAYS);
const TOL = 0.011;

let checks = 0;
for (const art of fx.articles) {
  const exp = fx.expected[art.name];
  assert.ok(exp, `beklenti yok: ${art.name}`);

  const ranked = rankImages(art, fx.images, usage90, art.category);
  assert.deepEqual(ranked.map(r => r.image.id), exp.ranking, `sıralama: ${art.name}`);
  for (const r of ranked) {
    const want = exp.scores[String(r.image.id)];
    assert.ok(Math.abs(r.score - want) <= TOL, `skor ${art.name} #${r.image.id}: ${r.score} ≠ ${want}`);
    checks++;
  }

  const flags = imageFlags({ post: art, articleCategory: art.category, images: fx.images, history: fx.history, now });
  const got = Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, [...v].sort()]));
  assert.deepEqual(got, exp.flags, `elenme nedenleri: ${art.name}`);
  checks++;
}
console.log(`image-score parite: ${fx.articles.length} yazı, ${checks} kontrol — tamam.`);
