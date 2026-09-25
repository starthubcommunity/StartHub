// Supabase Edge Function: hub-sheet-sync
// HUB (topluluk) başvurularını Google Sheets'e servis hesabıyla (kimlik anahtarı) yazar.
// Kullanıcı tarafında kurulum GEREKMEZ — sheet bir kere servis hesabı e-postasıyla
// paylaşılır, gerisi otomatik. DB tetikleyicisi (applications_to_hub_sheet, 0042) ve
// hub_sheet_test/hub_sheet_backfill RPC'leri bu fonksiyonu service-role yetkisiyle çağırır
// (Authorization header — Apps Script döneminden kalan `secret` alanı artık kullanılmıyor).
//
// Gerekli edge function secret'ları (supabase secrets set ile eklenir, tarayıcıya asla gitmez):
//   GOOGLE_SA_EMAIL        — servis hesabının client_email'i
//   GOOGLE_SA_PRIVATE_KEY  — servis hesabının private_key'i (PEM, \n kaçışlı da olabilir)
// Sheet ID'si ve sekme adı hub_sheet_config tablosundan (service role ile) okunur.
//
// İstek gövdesi: { sheet_name?, rows: [{ id, created_at, type, name, email, phone,
//   university, department, unit, organization, detail, status }, ...] }
// `sheet_name` verilmezse hub_sheet_config.sheet_name kullanılır. Satırın son sütunu
// ID'dir; tabloda zaten var olan ID'ler tekrar eklenmez (idempotent — hem tetikleyici
// hem "Mevcut başvuruları aktar" için güvenli).
//
// 0043: yalnızca HUB değil, LAB başvuruları da (aynı tabloda AYRI bir sekmeye —
// varsayılan "Lab Başvuruları", 0046'dan beri) yedek olarak gönderiliyor; site/DB'ye
// erişilemese bile başvurular Sheets'te duruyor. Yönlendirme kararı (hangi sekme) DB
// tetikleyicisinde.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SA_EMAIL = Deno.env.get("GOOGLE_SA_EMAIL") || "";
const SA_KEY = Deno.env.get("GOOGLE_SA_PRIVATE_KEY") || "";

const HEADERS = ["Tarih", "Tür", "Ad Soyad", "E-posta", "Telefon", "Üniversite", "Bölüm", "Birim", "Kurum", "Detay", "Durum", "Notlar", "ID"];
const RANGE_ALL = "A1:M";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const enc = new TextEncoder();
  const unsigned = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(claim)))}`;
  const pem = SA_KEY.replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("google token: " + JSON.stringify(data));
  return data.access_token as string;
}

async function sheetsFetch(token: string, spreadsheetId: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`sheets api ${res.status}: ` + JSON.stringify(data));
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (!SA_EMAIL || !SA_KEY) return json({ ok: false, error: "servis hesabı henüz tanımlı değil (GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY)" }, 200);

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: cfg, error: cfgErr } = await db.from("hub_sheet_config").select("*").eq("id", 1).single();
    if (cfgErr || !cfg) return json({ ok: false, error: "hub_sheet_config okunamadı: " + (cfgErr?.message || "") }, 200);
    if (!cfg.spreadsheet_id) return json({ ok: false, error: "spreadsheet_id ayarlanmamış" }, 200);

    const body = await req.json().catch(() => ({}));
    const rows: Array<Record<string, unknown>> = Array.isArray(body.rows) ? body.rows : [];
    const sheetName = (typeof body.sheet_name === "string" && body.sheet_name.trim()) || cfg.sheet_name || "Hub Başvuruları";
    const spreadsheetId = cfg.spreadsheet_id;

    const token = await getAccessToken();

    // Sekme yoksa oluştur (spreadsheets.get ile kontrol et, yoksa batchUpdate ile ekle)
    const meta = await sheetsFetch(token, spreadsheetId, "?fields=sheets.properties.title");
    const sheetExists = (meta.sheets || []).some((s: { properties: { title: string } }) => s.properties.title === sheetName);
    if (!sheetExists) {
      await sheetsFetch(token, spreadsheetId, ":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
      });
    }

    // Başlık satırı yoksa yaz
    const head = await sheetsFetch(token, spreadsheetId, `/values/${encodeURIComponent(sheetName)}!A1:M1`);
    if (!head.values || !head.values.length) {
      await sheetsFetch(token, spreadsheetId, `/values/${encodeURIComponent(sheetName)}!A1:M1?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [HEADERS] }),
      });
    }

    // Mevcut ID'leri oku (son sütun M), tekrar eklenmesin
    const idCol = await sheetsFetch(token, spreadsheetId, `/values/${encodeURIComponent(sheetName)}!M2:M`);
    const seen = new Set<string>((idCol.values || []).map((r: string[]) => String(r[0])));

    const toAppend = rows
      .filter((r) => !seen.has(String(r.id)))
      .map((r) => [
        r.created_at ? new Date(String(r.created_at)).toLocaleString("tr-TR") : new Date().toLocaleString("tr-TR"),
        r.type || "", r.name || "", r.email || "", r.phone || "", r.university || "",
        r.department || "", r.unit || "", r.organization || "", r.detail || "",
        r.status || "Yeni", "", String(r.id ?? ""),
      ]);

    if (toAppend.length) {
      await sheetsFetch(
        token, spreadsheetId,
        `/values/${encodeURIComponent(sheetName)}!A:M:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: "POST", body: JSON.stringify({ values: toAppend }) },
      );
    }

    await db.from("hub_sheet_config").update({ last_sent_at: new Date().toISOString(), last_error: null }).eq("id", 1);
    return json({ ok: true, added: toAppend.length });
  } catch (err) {
    try {
      const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      await db.from("hub_sheet_config").update({ last_error: String(err).slice(0, 300) }).eq("id", 1);
    } catch { /* yut — hata raporlama başvuruyu asla engellemesin */ }
    return json({ ok: false, error: String(err) }, 200);
  }
});
