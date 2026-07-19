// supabase/functions/linkedin-post/index.ts
// Deno Edge Function — LinkedIn Posts API'ye sunucu tarafında istek atar
// (tarayıcıdan doğrudan çağrıldığında LinkedIn CORS izni vermiyor).
//
// Deploy: supabase functions deploy linkedin-post
//
// İstek body'si (admin-store.jsx postToLinkedIn ile eşleşir):
//   { accessToken, organizationId, title, summary, url, imageUrl }
// Yanıt: { ok: true, postId, usedThumbnail } veya { error: "..." }

// LinkedIn API sürüm başlığı (YYYYMM). LinkedIn genelde ~12 ay geriye uyumlu
// kabul eder; yılda birkaç kez güncellemek yeterli.
const LINKEDIN_VERSION = "202607";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const linkedinHeaders = (accessToken: string) => ({
  "Authorization": `Bearer ${accessToken}`,
  "Linkedin-Version": LINKEDIN_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
  "Content-Type": "application/json",
});

/**
 * Görseli LinkedIn Images API ile yükler, başarılı olursa "urn:li:image:..." döner.
 * Herhangi bir adımda hata olursa null döner — çağıran taraf thumbnail'siz devam eder,
 * paylaşım görsel yüzünden asla tamamen engellenmez.
 */
async function uploadImage(accessToken: string, organizationId: string, imageUrl: string): Promise<string | null> {
  try {
    const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: linkedinHeaders(accessToken),
      body: JSON.stringify({
        initializeUploadRequest: { owner: `urn:li:organization:${organizationId}` },
      }),
    });
    if (!initRes.ok) {
      console.error("initializeUpload başarısız:", initRes.status, await initRes.text());
      return null;
    }
    const initData = await initRes.json();
    const uploadUrl: string | undefined = initData?.value?.uploadUrl;
    const imageUrn: string | undefined = initData?.value?.image;
    if (!uploadUrl || !imageUrn) return null;

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.error("Kaynak görsel indirilemedi:", imgRes.status);
      return null;
    }
    const imgBytes = await imgRes.arrayBuffer();

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${accessToken}` },
      body: imgBytes,
    });
    if (!putRes.ok) {
      console.error("Görsel LinkedIn'e yüklenemedi:", putRes.status, await putRes.text());
      return null;
    }
    return imageUrn;
  } catch (e) {
    console.error("uploadImage hata:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let payload: {
    accessToken?: string; organizationId?: string;
    title?: string; summary?: string; url?: string; imageUrl?: string | null;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Geçersiz istek gövdesi." });
  }

  const { accessToken, organizationId, title, summary, url, imageUrl } = payload;
  if (!accessToken || !organizationId || !title || !url) {
    return jsonResponse({ error: "accessToken, organizationId, title ve url zorunludur." });
  }

  let thumbnail: string | null = null;
  if (imageUrl) {
    thumbnail = await uploadImage(accessToken, organizationId, imageUrl);
  }

  const body = {
    author: `urn:li:organization:${organizationId}`,
    commentary: (summary || title).slice(0, 700),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    content: {
      article: {
        source: url,
        ...(thumbnail ? { thumbnail } : {}),
        title: title.slice(0, 200),
        description: (summary || "").slice(0, 300),
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  try {
    const postRes = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: linkedinHeaders(accessToken),
      body: JSON.stringify(body),
    });

    if (!postRes.ok) {
      let detail = "";
      try {
        const errJson = await postRes.json();
        detail = errJson?.message || JSON.stringify(errJson);
      } catch {
        detail = await postRes.text().catch(() => "");
      }
      return jsonResponse({ error: detail || `LinkedIn API hatası (${postRes.status})` });
    }

    const postId = postRes.headers.get("x-restli-id");
    return jsonResponse({ ok: true, postId, usedThumbnail: !!thumbnail });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) });
  }
});
