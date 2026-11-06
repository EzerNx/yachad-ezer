// Envoi de courriels avec Brevo (offre gratuite : 300 courriels par jour).
// Les secrets sont lus dans l'environnement de la fonction, JAMAIS dans le code :
//   supabase secrets set BREVO_API_KEY=... SENDER_EMAIL=... SENDER_NAME="Yachad Ezer"

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const senderEmail = Deno.env.get("SENDER_EMAIL");
  const senderName = Deno.env.get("SENDER_NAME") ?? "Yachad Ezer";
  if (!apiKey || !senderEmail) throw new Error("BREVO_API_KEY ou SENDER_EMAIL manquant");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject: subject.slice(0, 200),
      textContent: text.slice(0, 5000),
    }),
  });
  if (!res.ok) {
    // On garde le message de Brevo : il dit exactement ce qui bloque
    // (clé invalide, adresse IP non autorisée, expéditeur non vérifié…)
    let detail = "";
    try { const j = await res.json(); detail = j.message ?? JSON.stringify(j); } catch { /* pas de JSON */ }
    throw new Error(`Brevo ${res.status} : ${detail}`.slice(0, 300));
  }
}

export const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://ezernx.github.io/yachad-ezer/").replace(/\/?$/, "/");

// Les pages du site (GitHub Pages) ont le droit d'appeler la fonction
export const corsHeaders = {
  "Access-Control-Allow-Origin": new URL(SITE_URL).origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
}

// Comparaison en temps constant (évite de deviner un secret caractère par caractère)
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
