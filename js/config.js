// Configuration du site
// ---------------------------------------------------------------------
// 1. Supabase : trouve ces deux valeurs dans Supabase > Project Settings > API Keys.
//    La clé « publishable » (sb_publishable_...) PEUT être publique :
//    elle ne donne que les droits prévus par les règles RLS de la base.
//    Ne mets JAMAIS ici la clé « secret » ou « service_role ».
//    Si tu changes de projet Supabase, change aussi l'adresse dans la balise
//    « Content-Security-Policy » en haut de chaque page HTML.

export const SUPABASE_URL = "https://kklvokzhptyogutwakol.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_5WuoZdDwotXStsXW6WsMmw_rR89D_cM";

// 2. Loi 25 : la personne responsable de la protection des renseignements
//    personnels. Son nom et un courriel de contact s'affichent sur la page publique.
export const PRIVACY_OFFICER = {
  name: "", // ex. : "Jean Dupont"
  email: "", // ex. : "confidentialite@exemple.com"
};

// 3. Courriels automatiques (voir docs/courriels.md).
//    Mets true seulement APRÈS avoir déployé la fonction « send-reply ».
export const EMAIL_REPLIES_ENABLED = true;
