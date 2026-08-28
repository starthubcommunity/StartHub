// hub-enrich.js — GitHub sinyallerinden zenginleştirme + AI ön puanı +
// "neden bu kişi" cümlesi (HUB_SPEC §8.6.5–8.6.7). Saf fonksiyonlar; ağ
// çağrısı yok (o kısım hub-github.js'te). LLM yok — §8.6.6 tablosu birebir
// kod, §8.6.7 dört kural şablonla garanti.

const DAY = 86400000;

export function relDays(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - Date.parse(iso)) / DAY);
  if (d < 0) return 'bugün';
  if (d < 14) return `${d} gün önce`;
  if (d < 60) return `${Math.round(d / 7)} hafta önce`;
  if (d < 730) return `${Math.round(d / 30)} ay önce`;
  return `${Math.round(d / 365)} yıl önce`;
}

// "Bitmiş" repo (§8.6.5): README > 400 karakter VE (homepage dolu VEYA
// GitHub Pages VEYA ≥ 5 yıldız). README uzunluğu yalnızca "derin analiz"de
// gelir. Derin analiz yoksa vekil: repo yayınlanmış (homepage/pages/≥5★) ve
// tamamen boş kabuk değil (açıklama var ya da yıldız almış).
function isFinished(repo, readmeLen) {
  const shipped = !!repo.homepage || repo.has_pages === true || (repo.stargazers_count || 0) >= 5;
  if (!shipped) return false;
  const readmeOk = readmeLen == null
    ? ((repo.description || '').length >= 20 || (repo.stargazers_count || 0) >= 5)
    : readmeLen > 400;
  return readmeOk;
}

// §8.6.5'in altı sinyali → enrichment jsonb.
export function computeEnrichment({ user = {}, repos = [], prsToOthers = 0, orgs = [], readmes = {} } = {}) {
  const login = (user.login || '').toLowerCase();
  const own = repos.filter((r) => !r.fork && (r.owner?.login || '').toLowerCase() === login);
  const finished = own.filter((r) => isFinished(r, readmes[r.name] ?? null));

  const lastPush = repos.reduce((m, r) => Math.max(m, r.pushed_at ? Date.parse(r.pushed_at) : 0), 0);
  const now = Date.now();

  const months = new Set();
  for (const r of repos) {
    for (const d of [r.pushed_at, r.created_at]) {
      if (!d) continue;
      const t = Date.parse(d);
      if (t <= now && now - t <= 366 * DAY) months.add(new Date(t).toISOString().slice(0, 7));
    }
  }

  return {
    finished_projects: finished.length,
    activity_recency: lastPush ? Math.floor((now - lastPush) / DAY) : null,
    consistency: months.size,                              // son 12 ayda katkılı ay sayısı
    breadth: new Set(repos.map((r) => r.language).filter(Boolean)).size,
    collaboration: (prsToOthers || 0) + (orgs?.length || 0),
    solo_finisher: finished.length >= 1,
    fetched_at: new Date().toISOString(),
  };
}

// §8.6.6 — AI ön puanı YALNIZCA `bitirmişlik` eksenini tahmin eder.
// İletişim ve kapasite DOKUNULMAZ (null kalır; görüşmeden çıkar).
export function prescoreFinishing(enrichment = {}, repos = [], { deep = false } = {}) {
  const fin = enrichment.finished_projects || 0;
  const recency = enrichment.activity_recency ?? Infinity;
  const live = repos.some((r) => !r.fork && (r.homepage || r.has_pages));
  const repoCount = repos.length;

  let score, basis;
  if (fin >= 2 && live) { score = 5; basis = '≥ 2 bitmiş proje ve en az biri canlı/kullanıcılı'; }
  else if (fin === 1 && recency <= 180) { score = 4; basis = '1 bitmiş proje + son 6 ayda aktif'; }
  else if (fin === 0 && repoCount >= 5) { score = 3; basis = 'çok repo var ama bitmiş görünen yok'; }
  else if (fin === 0 && repoCount >= 1) { score = 2; basis = 'az sayıda repo, çoğu eğitim/kopya'; }
  else { score = 1; basis = 'boş veya yalnızca fork'; }

  const top = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];
  const evidence = top
    ? `${top.full_name || top.name} — ${top.stargazers_count || 0} yıldız` +
      `${top.homepage || top.has_pages ? ', canlı/demo linki var' : ''}` +
      `${top.pushed_at ? `, son push ${relDays(top.pushed_at)}` : ''}`
    : 'repo bulunamadı';
  const confidence = deep ? 'yüksek' : (repoCount ? 'orta' : 'düşük');

  return {
    score,
    confidence,
    evidence,
    note: `Ön puan ${score} · ${confidence} güven · ${basis}. ${evidence}`,
  };
}

// §8.6.7 — dört kural: somut esere atıf · en fazla iki cümle · sıfat yok ·
// doğrulanamayan şey yok. Şablon bu kuralları yapısal olarak sağlar.
export function whyThisOne(repos = [], ctx = {}) {
  const top = [...repos].filter((r) => !r.fork).sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];
  if (!top) return ctx.sourceDetail ? `${ctx.sourceDetail} kaynağından geldi.` : '';
  const facts = [`GitHub'daki ${top.name} deposunda ${top.stargazers_count || 0} yıldız var`];
  if (top.homepage || top.has_pages) facts.push('canlı demo linki mevcut');
  if (top.language) facts.push(`${top.language} ile yazılmış`);
  let s = facts.join(', ') + '.';
  if (top.pushed_at) s += ` Son güncelleme ${relDays(top.pushed_at)}.`;
  return s;
}

// §8.6.5 — "kesinlikle çıkarılamayanlar". Arayüzde gösterilir; kullanıcı
// sistemin ne bilmediğini bilmeli.
export const UNKNOWABLE = [
  'Üniversite, bölüm, sınıf (kaynak metninde yoksa)',
  'E-posta (profilde gizliyse)',
  "LinkedIn'deki hiçbir şey",
  'Müsait saat / haftalık kapasite',
  'İletişim becerisi',
];
