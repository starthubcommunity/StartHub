// Supabase Edge Function: send-mail
// Frontend'de zaten cagriliyor: sb.functions.invoke("send-mail", { body: { to, subject, body } })
// Resend API key'ini asla buraya yazma; Supabase project secret'i olarak sakla:
//   supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="StartHub <no-reply@mail.starthub-community.com>" REPLY_TO=starthub.community@gmail.com

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("MAIL_FROM") || "StartHub <no-reply@mail.starthub-community.com>";
const REPLY_TO = Deno.env.get("REPLY_TO") || "starthub.community@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to, subject, body, html } = await req.json();
    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "to, subject ve body zorunlu" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY secret'i tanimli degil" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text: body, reply_to: REPLY_TO, ...(html ? { html } : {}) }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
