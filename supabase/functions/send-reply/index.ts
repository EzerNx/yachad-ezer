// =====================================================================
//  Fonction « send-reply » : l'admin envoie la réponse par courriel
//  depuis le portail, sans copier-coller.
//
//  Sécurité :
//   · la personne qui appelle doit être connectée ET être admin actif
//     (vérifié avec SON jeton, donc avec les règles RLS de la base)
//   · l'adresse de destination vient de la base, jamais du navigateur
//   · on n'envoie que si la personne a demandé à être recontactée par courriel
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { corsHeaders, json, sendEmail } from "../_shared/email.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  // 1. Qui appelle ? (avec le jeton de la personne connectée)
  const authHeader = req.headers.get("Authorization") ?? "";
  const asCaller = createClient(URL_, ANON, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData } = await asCaller.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return json({ ok: false, error: "non connecté" }, 401);
  const { data: me } = await asCaller.from("profiles").select("role, active").eq("id", uid).maybeSingle();
  if (!me || me.role !== "admin" || !me.active) return json({ ok: false, error: "réservé à l'admin" }, 403);

  // 2. Ce qu'il faut envoyer
  let body: { observation_id?: string; subject?: string; message?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  const message = (body.message ?? "").trim();
  const subject = (body.subject ?? "Yachad Ezer").trim();
  if (!body.observation_id || message.length < 10 || message.length > 4000) return json({ ok: false, error: "message invalide" }, 400);

  // 3. À qui ? (lu dans la base avec les droits de service, après la vérification admin)
  const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: obs } = await svc.from("observations")
    .select("id, status, request:prayer_requests(id, wants_contact, private:request_private(contact_method, contact_value))")
    .eq("id", body.observation_id).maybeSingle();
  // deno-lint-ignore no-explicit-any
  const r: any = obs?.request;
  const p = Array.isArray(r?.private) ? r.private[0] : r?.private;
  if (!obs || !r?.wants_contact || p?.contact_method !== "courriel" || !p?.contact_value) {
    return json({ ok: false, error: "pas de courriel autorisé pour cette demande" }, 400);
  }

  // 4. Envoi, puis on marque l'observation comme transmise
  try {
    await sendEmail(p.contact_value, subject, message);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "envoi impossible" }, 502);
  }
  await svc.from("observations").update({ status: "transmise", transmitted_at: new Date().toISOString() }).eq("id", obs.id);
  return json({ ok: true });
});
