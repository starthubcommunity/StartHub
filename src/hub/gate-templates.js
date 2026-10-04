// gate-templates.js — Kapı A görev şablonları (0053) için saf yardımcılar.
// Kaynak: StartHub_Aday_Bulma_Senaryosu.md Bölüm H — atayan YAZMAZ, SEÇER;
// açıklamayı değiştirmek isteğe bağlı override'dır.
import { INTEREST_AREAS } from './hub-constants.js';

export const GATE_TEMPLATE_CATEGORIES = [
  ...INTEREST_AREAS.map(({ value, label }) => ({ value, label })),
  { value: 'founder', label: 'Kurucu (Team Lead) adayı' },
];
export const GATE_CATEGORY_LABEL = Object.fromEntries(GATE_TEMPLATE_CATEGORIES.map((c) => [c.value, c.label]));

export const DELIVERY_TYPES = [
  { value: 'link',      label: 'Bağlantı' },
  { value: 'file',      label: 'Dosya / doküman' },
  { value: 'recording', label: 'Ekran kaydı' },
];
export const DELIVERY_LABEL = Object.fromEntries(DELIVERY_TYPES.map((d) => [d.value, d.label]));

// Gün seçici: 1–14 gün (DB: 24–336 saat). Varsayılan 72 saat = 3 gün.
export const DURATION_DAY_OPTIONS = Array.from({ length: 14 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} gün${i + 1 === 3 ? ' (72 saat — varsayılan)' : ''}` }));

// Adaya uygun kategori: kurucu hattı → 'founder'; üye → ilgi alanı; yoksa 'other'.
export function gateCategoryFor(candidate) {
  if (candidate?.track === 'founder') return 'founder';
  const known = INTEREST_AREAS.some((a) => a.value === candidate?.interest);
  return known ? candidate.interest : 'other';
}

// Kategorideki aktif şablonlar (sıra → başlık). Kategori boşsa 'other'a düşer.
export function templatesFor(all, category) {
  const active = (all || []).filter((t) => t.active !== false);
  const sort = (a, b) => (a.sortOrder - b.sortOrder) || a.title.localeCompare(b.title, 'tr');
  const inCat = active.filter((t) => t.category === category).sort(sort);
  if (inCat.length || category === 'other') return inCat;
  return active.filter((t) => t.category === 'other').sort(sort);
}

// Adaya giden görev metni (hub_gates.task_text'e de bu kopyalanır).
export function composeGateTask(template, description) {
  if (!template) return (description || '').trim();
  const body = (description ?? template.description ?? '').trim();
  return `${template.title}\n\n${body}\n\nTeslim türü: ${DELIVERY_LABEL[template.deliveryType] || template.deliveryType}`;
}

export function validateGateTemplate(t) {
  const errors = [];
  if (!t.title?.trim()) errors.push('Başlık zorunlu.');
  if (!t.description?.trim()) errors.push('Açıklama zorunlu.');
  if (!GATE_CATEGORY_LABEL[t.category]) errors.push('Kategori seçilmeli.');
  const h = Number(t.durationHours);
  if (!(h >= 24 && h <= 336)) errors.push('Süre 1–14 gün arasında olmalı.');
  if (!DELIVERY_LABEL[t.deliveryType]) errors.push('Teslim türü seçilmeli.');
  return errors;
}
