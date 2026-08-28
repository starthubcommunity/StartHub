// hub-github.js — GitHub REST API istemcisi (§8.6.4). Tarayıcıdan çağrılır.
//
// Sınır: Arama API'si kimlik doğrulamalı dakikada 30 istek (doğrulamasız 10).
// Bu yüzden istekler ~2.2 sn aralıkla KUYRUKTA ilerler; onProgress ile ilerleme
// çubuğu beslenir. Token oturum boyunca RAM'de tutulur — localStorage'a veya
// DB'ye YAZILMAZ. Prod'da bir edge function proxy'sine taşınabilir.

const API = 'https://api.github.com';
const GAP_MS = 2200; // ~27 istek/dk — 30 sınırının altında
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers(token) {
  const h = { Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token.trim()}`;
  return h;
}

async function gh(path, token) {
  const res = await fetch(API + path, { headers: headers(token) });
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub hız sınırı — biraz sonra tekrar dene (token eklemek sınırı 30/dk yapar).');
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${path}`);
  return res.json();
}

// Arama sorgusu kur (§8.6.4 parametreleri).
export function buildQuery({ location = 'Turkey', language = '', minRepos = 3, minFollowers = 0, activeMonths = 6 }) {
  const parts = [];
  if (location) parts.push(`location:${JSON.stringify(location).replace(/"/g, '')}`);
  if (language) parts.push(`language:${language}`);
  if (minRepos) parts.push(`repos:>=${minRepos}`);
  if (minFollowers) parts.push(`followers:>=${minFollowers}`);
  if (activeMonths) {
    const d = new Date(Date.now() - activeMonths * 30 * 86400000).toISOString().slice(0, 10);
    parts.push(`pushed:>=${d}`);
  }
  return parts.join(' ');
}

// Aramadan aday login listesi.
export async function searchUsers(params, { token, limit = 15, onProgress } = {}) {
  const q = buildQuery(params);
  onProgress?.({ phase: 'search', done: 0, total: 1, msg: `Arama: ${q}` });
  const data = await gh(`/search/users?q=${encodeURIComponent(q)}&per_page=${Math.min(limit, 30)}`, token);
  onProgress?.({ phase: 'search', done: 1, total: 1, msg: `${data.total_count} sonuç, ilk ${Math.min(limit, data.items?.length || 0)} alınıyor` });
  return (data.items || []).slice(0, limit).map((u) => u.login);
}

// Tek kullanıcı için profil + repolar (+ opsiyonel PR/org/README derin analizi).
export async function enrichUser(login, { token, deep = false, onProgress, tick } = {}) {
  const step = async (fn) => { const r = await fn(); await sleep(GAP_MS); tick?.(); return r; };

  const user = await step(() => gh(`/users/${login}`, token));
  const repos = await step(() => gh(`/users/${login}/repos?sort=pushed&per_page=100`, token));
  const top = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 5);

  let prsToOthers = 0, orgs = [], readmes = {};
  if (deep) {
    try {
      const pr = await step(() => gh(`/search/issues?q=${encodeURIComponent(`type:pr author:${login} -user:${login}`)}&per_page=1`, token));
      prsToOthers = pr.total_count || 0;
    } catch { /* sınır — atla */ }
    try { orgs = await step(() => gh(`/users/${login}/orgs`, token)); } catch { orgs = []; }
    for (const r of top) {
      try {
        const rd = await step(() => gh(`/repos/${r.full_name}/readme`, token));
        readmes[r.name] = rd?.content ? atob(rd.content.replace(/\n/g, '')).length : 0;
      } catch { /* README yok */ }
    }
  }

  onProgress?.({ phase: 'user', msg: `${login} tamamlandı` });
  return { user, repos, top, prsToOthers, orgs, readmes };
}

// Kaç istek atılacağının tahmini (ilerleme çubuğu toplamı).
export const requestsPerUser = (deep) => (deep ? 2 + 2 + 5 : 2);
