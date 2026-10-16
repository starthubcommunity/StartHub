// Supabase Edge Function: hub-resource-files
// BU PROJEYE DEPLOY EDİLİR: fdlghaafspcuagxfrofz (ana proje) — `--no-verify-jwt`
// (yalnızca x-hub-bridge-key ile; Team App'teki hub-team-resource-file çağırır — yetki
// orada, kullanıcının KENDİ oturumundan ve app_state'ten sunucuda doğrulanır).
//
// C (0062) — "Kaynaklar"a PDF:
//   sign_upload { teamId, fileName, size, actorEmail } → sınır/sayı kontrolü, satır 'pending',
//               imzalı yükleme bağlantısı (dosya yolu tek kullanımlık: upsert yok)
//   finalize    { teamId, fileId } → dosyayı indirir: boyut ≤ 5 MB + "%PDF-" başlığı; geçmezse siler
//   download    { teamId, fileId } → 5 dk imzalı indirme bağlantısı
//   delete      { teamId, fileId } → dosya + satır silinir (kaynak silinince)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanFileName, validateUpload, isPdfHeader, MAX_PDF_BYTES, PENDING_TTL_MS, uploadBlockedByStorage, STORAGE_FULL_MSG } from "../_shared/resource-files.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUB_BRIDGE_SECRET = Deno.env.get("HUB_BRIDGE_SECRET");
const BUCKET = "team-resources";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-bridge-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!HUB_BRIDGE_SECRET || req.headers.get("x-hub-bridge-key") !== HUB_BRIDGE_SECRET) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    const { action, teamId, fileName, size, fileId, actorEmail } = await req.json();
    const tid = String(teamId || "");
    if (!tid || tid.length > 40) return json({ ok: false, error: "teamId zorunlu" }, 400);
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const st = db.storage.from(BUCKET);

    if (action === "sign_upload") {
      // Yarım kalmış (1 saatten eski 'pending') yüklemeleri temizle — sayıya girmesin.
      const cutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
      const { data: stale } = await db.from("team_resource_files").select("id, storage_path").eq("team_id", tid).eq("status", "pending").lt("created_at", cutoff);
      if (stale?.length) {
        await st.remove(stale.map((r: any) => r.storage_path));
        await db.from("team_resource_files").delete().in("id", stale.map((r: any) => r.id));
      }
      // D2 — ücretsiz plan: toplam depolama 700 MB ise Kaynaklar yüklemesi durur.
      // Sözleşme kabul PDF'leri (contract-pdfs) muaf — onları yazan kod bu kapıyı hiç çağırmaz.
      const { data: usedBytes, error: ue0 } = await db.rpc("storage_usage_bytes");
      if (ue0) return json({ ok: false, error: "Depolama kullanımı okunamadı — yükleme yapılmadı." }, 503);
      if (uploadBlockedByStorage(BUCKET, usedBytes)) return json({ ok: false, error: STORAGE_FULL_MSG, storageFull: true }, 409);
      const { count } = await db.from("team_resource_files").select("id", { count: "exact", head: true }).eq("team_id", tid);
      const err = validateUpload({ fileName, size, readyCount: count || 0 });
      if (err) return json({ ok: false, error: err }, 400);
      const clean = cleanFileName(fileName);
      const path = `${tid.replace(/[^A-Za-z0-9_]/g, "_")}/${crypto.randomUUID()}-${clean}`;
      const { data: row, error: ie } = await db.from("team_resource_files").insert({
        team_id: tid, storage_path: path, file_name: clean, status: "pending", uploaded_by: actorEmail || null,
      }).select("id").single();
      if (ie) return json({ ok: false, error: ie.message }, 500);
      const { data: up, error: ue } = await st.createSignedUploadUrl(path);
      if (ue || !up) { await db.from("team_resource_files").delete().eq("id", row.id); return json({ ok: false, error: "Yükleme bağlantısı oluşturulamadı." }, 500); }
      return json({ ok: true, fileId: row.id, signedUrl: up.signedUrl, path, fileName: clean });
    }

    const { data: row } = await db.from("team_resource_files").select("*").eq("id", String(fileId || "")).maybeSingle();
    if (!row || row.team_id !== tid) return json({ ok: false, error: "Dosya bulunamadı." }, 404);

    if (action === "finalize") {
      if (row.status === "ready") return json({ ok: true, fileId: row.id, fileName: row.file_name, size: row.size_bytes });
      const { data: blob, error: de } = await st.download(row.storage_path);
      const fail = async (msg: string) => {
        await st.remove([row.storage_path]);
        await db.from("team_resource_files").delete().eq("id", row.id);
        return json({ ok: false, error: msg }, 400);
      };
      if (de || !blob) return await fail("Dosya yüklenmemiş görünüyor — tekrar dene.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length > MAX_PDF_BYTES) return await fail("Dosya 5 MB'tan büyük.");
      if (!isPdfHeader(bytes.subarray(0, 5))) return await fail("Bu dosya gerçek bir PDF değil.");
      await db.from("team_resource_files").update({ status: "ready", size_bytes: bytes.length }).eq("id", row.id);
      return json({ ok: true, fileId: row.id, fileName: row.file_name, size: bytes.length });
    }
    if (action === "download") {
      if (row.status !== "ready") return json({ ok: false, error: "Dosya henüz hazır değil." }, 409);
      // download seçeneği YOK: PDF tarayıcıda açılsın (Content-Disposition: attachment indirmeye zorlar, sekme boş kalırdı)
      const { data: s, error: se } = await st.createSignedUrl(row.storage_path, 300);
      if (se || !s) return json({ ok: false, error: "Bağlantı oluşturulamadı." }, 500);
      return json({ ok: true, url: s.signedUrl, expiresIn: 300 });
    }
    if (action === "delete") {
      await st.remove([row.storage_path]);
      await db.from("team_resource_files").delete().eq("id", row.id);
      return json({ ok: true });
    }
    return json({ ok: false, error: "bilinmeyen action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
