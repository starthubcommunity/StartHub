// Supabase Edge Function: invite-member
// Gercek bir Supabase Auth hesabi olusturur (veya yoksa olusturur) ve
// giris/sifre belirleme linki uretir. Bu link daha sonra send-mail
// uzerinden markali davet mailine gomulur - Supabase'in kendi mail
// gonderimi kullanilmaz, tek kaynak Resend uzerinden giden mail olur.
//
// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY, Supabase Edge Functions'a
// platform tarafindan otomatik saglanir - ayrica secret set etmene
// gerek yok. service_role anahtari cok yetkili oldugu icin sadece
// burada, sunucu tarafinda kullanilir; istemciye asla gonderilmez.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://www.starthub-community.com/team/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "email zorunlu" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Once yeni davet olarak dene (hesap yoksa olusturur + link uretir).
    let { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: APP_URL },
    });

    // Hesap zaten varsa "invite" hata verir - o zaman sifre sifirlama
    // linkiyle devam et, boylece tekrar davet edilen kisi de calisir.
    if (error) {
      const retry = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: APP_URL },
      });
      data = retry.data;
      error = retry.error;
    }

    if (error || !data?.properties?.action_link) {
      return new Response(JSON.stringify({ error: error?.message || "link uretilemedi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, link: data.properties.action_link }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
