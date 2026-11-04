// =====================================================================
//  Fonction « notify » : courriels automatiques
//  Appelée par des « Database Webhooks » de Supabase quand une ligne est ajoutée :
//    · prayer_requests  → l'admin : nouvelle demande
//    · assignments      → l'intercesseur : une demande vous est confiée
//    · observations     → l'admin : nouvelle observation
//    · profiles         → l'admin : nouvelle candidature
//    · testimonies      → l'admin : nouveau témoignage à relire
//
//  Loi 25 : les courriels ne contiennent JAMAIS le texte des demandes,
//  ni de nom : seulement un code et un lien vers le portail (connexion requise).
//
//  Sécurité : le webhook envoie un en-tête « x-webhook-secret ».
//  Sans le bon secret, la fonction refuse tout.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { json, safeEqual, sendEmail, SITE_URL } from "../_shared/email.ts";

type Payload = { type: string; table: string; schema: string; record: Record<string, unknown> | null };

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function adminEmails(): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "admin").eq("active", true);
  const emails: string[] = [];
  for (const p of data ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(p.id as string);
    if (u?.user?.email) emails.push(u.user.email);
  }
  return emails;
}

async function toAdmins(subject: string, text: string) {
  for (const to of await adminEmails()) await sendEmail(to, subject, text);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET") ?? "";
  const given = req.headers.get("x-webhook-secret") ?? "";
  if (!secret || !safeEqual(given, secret)) return json({ ok: false, error: "forbidden" }, 403);
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  let p: Payload;
  try { p = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }
  if (p.type !== "INSERT" || p.schema !== "public" || !p.record) return json({ ok: true, skipped: true });
  const r = p.record;

  try {
    switch (p.table) {
      case "prayer_requests":
        await toAdmins(`Nouvelle demande de prière ${r.code}`,
          `Une nouvelle demande (${r.code}) est arrivée.\n\nOuvrez le portail admin : ${SITE_URL}admin.html`);
        break;

      case "observations": {
        const { data: req2 } = await admin.from("prayer_requests").select("code").eq("id", r.request_id).maybeSingle();
        await toAdmins(`Nouvelle observation (${req2?.code ?? "?"})`,
          `Un intercesseur a écrit une observation sur la demande ${req2?.code ?? ""}.\n\nÀ relire ici : ${SITE_URL}admin.html`);
        break;
      }

      case "profiles":
        if (r.role === "candidat") {
          await toAdmins("Nouvelle candidature d'intercesseur",
            `Une personne souhaite rejoindre l'équipe d'intercession.\n\nExaminez sa candidature : ${SITE_URL}admin.html`);
        }
        break;

      case "testimonies":
        await toAdmins("Nouveau témoignage à relire",
          `Un témoignage attend votre relecture avant publication.\n\n${SITE_URL}admin.html`);
        break;

      case "assignments": {
        const { data: prof } = await admin.from("profiles").select("active, notify").eq("id", r.member_id).maybeSingle();
        if (!prof?.active || prof?.notify === false) break;
        const { data: u } = await admin.auth.admin.getUserById(r.member_id as string);
        const { data: req3 } = await admin.from("prayer_requests").select("code").eq("id", r.request_id).maybeSingle();
        if (u?.user?.email) {
          await sendEmail(u.user.email,
            `Une demande de prière vous est confiée (${req3?.code ?? ""}) · A prayer request was assigned to you`,
            `Une nouvelle demande de prière vous a été confiée (${req3?.code ?? ""}).\n` +
            `Ouvrez votre portail pour prier : ${SITE_URL}membre.html\n\n` +
            `A new prayer request was assigned to you. Open your portal: ${SITE_URL}membre.html\n\n` +
            `Pour ne plus recevoir ces courriels : Mon compte > Notifications.`);
        }
        break;
      }
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "send failed" }, 500);
  }
});
