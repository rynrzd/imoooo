import type { Metadata } from "next";
import { CookiePreferences } from "@/components/layout/cookie-consent";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Politique de cookies",
  description: "Les cookies utilisés par Nireo et leur finalité.",
  alternates: { canonical: "/cookies" },
  robots: { index: false },
};

/**
 * Cette page décrit les cookies RÉELLEMENT déposés, vérifiés dans le code
 * et sur le site en ligne — noms, durées et finalités exactes.
 *
 * La version précédente affirmait « aucun cookie statistique » alors que
 * `nireo_vid` et `nireo_vst` étaient posés dès la première requête, pour un
 * an. Le texte a été corrigé EN MÊME TEMPS que le comportement : ces cookies
 * ne sont désormais déposés qu'après acceptation (voir src/lib/consent.ts).
 */
export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique de cookies"
      updatedAt="20 août 2026"
      intro="Nireo dépose deux catégories de cookies : ceux qui sont indispensables au fonctionnement du service, déposés sans consentement car sans eux le site ne peut pas fonctionner ; et ceux qui servent à mesurer la fréquentation et à adapter la page d'accueil, qui ne sont déposés QUE si vous les acceptez. Refuser ne dégrade en rien le service."
      sections={[
        {
          title: "Votre choix",
          paragraphs: [
            "Vous pouvez accepter ou refuser les cookies de mesure à tout moment, et revenir sur votre décision aussi souvent que vous le souhaitez. Votre choix est conservé six mois, puis la question vous est reposée.",
          ],
        },
        {
          title: "Cookies strictement nécessaires (sans consentement)",
          paragraphs: [
            "« sb-…-auth-token » — cookie d'authentification Supabase. Il maintient votre session et protège l'accès à vos données. Durée : 400 jours, ou jusqu'à la fermeture du navigateur si vous décochez « rester connecté ». Sans lui, impossible de rester connecté.",
            "« immopilot-remember » — mémorise si vous avez décoché « rester connecté », afin que la durée de votre session soit respectée. Durée : 1 an. (Son nom conserve l'ancien nom de code du projet ; le renommer déconnecterait les personnes déjà connectées.)",
            "« nireo_consent » — mémorise votre choix ci-dessus. Deux valeurs possibles, aucune donnée personnelle. Durée : 6 mois. Sans lui, la question vous serait reposée à chaque page.",
            "« nireo_partner » — uniquement dans l'espace partenaire, après saisie d'un jeton d'accès : c'est ce cookie qui vous y maintient connecté. Durée : 30 jours.",
          ],
        },
        {
          title: "Cookies de mesure et de personnalisation (soumis à votre accord)",
          paragraphs: [
            "« nireo_vid » — un identifiant aléatoire (UUID) attribué à votre navigateur. Il n'est calculé ni depuis votre adresse IP, ni depuis votre appareil, ni depuis un compte : il ne permet pas de vous identifier. Il sert à vous montrer la même version de la page d'accueil d'une visite à l'autre, et à savoir quelle version a mené à une inscription. Durée : 1 an.",
            "« nireo_vst » — nombre de visites, date de la première et de la dernière, et provenance de la visite (moteur de recherche, réseau social, lien partenaire, accès direct). Durée : 1 an.",
            "« nireo_ref » — déposé uniquement si vous arrivez par le lien ou le QR code d'un partenaire. Il permet de rattacher votre éventuelle inscription à ce partenaire, qui perçoit une commission. Durée : 30 jours par défaut. Finalité marketing : il n'est jamais déposé sans votre accord.",
            "Ces trois cookies sont first-party (déposés par nireo.fr, jamais par un tiers), HttpOnly, et ne sont transmis à aucun service extérieur. Si vous refusez, ils ne sont pas déposés ; si vous refusez après les avoir acceptés, ils sont supprimés dès la page suivante.",
          ],
        },
        {
          title: "Mesure d'audience interne",
          paragraphs: [
            "Nireo mesure sa fréquentation avec ses propres moyens, sans outil tiers : aucune donnée n'est transmise à Google Analytics ni à un équivalent. Votre adresse IP n'est jamais enregistrée en clair — elle est transformée en une empreinte non réversible qui sert uniquement à ne pas compter deux fois le même visiteur.",
            "Cette mesure utilise le stockage de session du navigateur (« nireo_a_sid », « nireo_a_ref », « nireo_a_utm », « nireo_l_sid »), effacé automatiquement à la fermeture de l'onglet, et non des cookies.",
          ],
        },
        {
          title: "Stockage local (non-cookie)",
          paragraphs: [
            "Le navigateur conserve localement certaines préférences d'interface (thème clair/sombre, guide de démarrage effectué), ainsi que les notes privées et les informations de garant que vous saisissez sur une fiche locataire. Ces informations ne quittent pas votre appareil et ne sont transmises à aucun serveur — elles ne sont donc ni synchronisées entre vos appareils, ni incluses dans l'export de vos données.",
          ],
        },
        {
          title: "Gérer les cookies depuis votre navigateur",
          paragraphs: [
            "Vous pouvez à tout moment supprimer les cookies depuis les réglages de votre navigateur. La suppression des cookies d'authentification vous déconnectera de Nireo.",
          ],
        },
      ]}
    >
      <CookiePreferences />
    </LegalPage>
  );
}
