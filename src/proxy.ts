import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CONTENT_PAGES } from "@/config/seo-pages";
import { CONSENT_COOKIE, hasAnalyticsConsent } from "@/lib/consent";
import {
  detectAcquisition,
  isCrawler,
  isValidVisitorId,
  parseVisit,
  serializeVisit,
  VISIT_COOKIE,
  VISIT_GAP_MS,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  type VisitState,
} from "@/lib/landing/audience";
import {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  parseRefCookie,
  recordPartnerClick,
  REF_COOKIE_NAME,
  REF_PARAM,
  sanitizeRef,
  serializeRefCookie,
} from "@/lib/marketing/referral";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";
import {
  adjustPersistence,
  rememberFromCookies,
  SECURE_COOKIES,
} from "@/lib/supabase/session-persistence";

/** Pages d'authentification : un utilisateur connecté n'a rien à y faire. */
const AUTH_PATHS = [
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
];

/** Page « Vérifiez votre e-mail » : publique, et seule zone (hors pages
 * publiques) autorisée à une session dont l'e-mail n'est pas confirmé. */
const VERIFY_EMAIL_PATH = "/verification-email";

/**
 * Pages marketing publiques (landing, tarifs, pages légales, contenu).
 * Les pages de contenu référençables viennent de src/config/seo-pages.ts :
 * une page ajoutée là devient publique ici, apparaît dans le sitemap et dans
 * /ressources — sans qu'aucune liste d'URL soit tenue à jour deux fois.
 */
const MARKETING_PATHS = [
  "/accueil",
  "/tarifs",
  "/contact",
  "/a-propos",
  "/entreprise",
  "/confidentialite",
  "/cgu",
  "/mentions-legales",
  "/cookies",
  ...CONTENT_PAGES.map((page) => page.path),
];

const PUBLIC_PATHS = [...AUTH_PATHS, ...MARKETING_PATHS];

/**
 * Nireo ID (second produit) — surfaces PUBLIQUES uniquement :
 * vitrine, démonstration, aperçu public d'un passeport, dossier partagé
 * par lien, et réponse à un bilan. Tout le reste (/id/app, /id/pro,
 * /id/admin) exige une session et repasse par la connexion partagée Nireo.
 *
 * `/id/bilan` : le lien est envoyé PAR E-MAIL au détenteur du téléphone,
 * qui n'a pas de compte Nireo — la page ne lit d'ailleurs aucune session.
 * Sans cette entrée, le proxy renvoyait le destinataire vers /connexion :
 * la fonctionnalité était donc inutilisable pour la seule personne à qui
 * elle s'adresse. Le jeton porte seul l'autorisation, et il est
 * dimensionné pour ça : 256 bits aléatoires, stocké HACHÉ (SHA-256),
 * expirant, révocable, à réponse unique, et il n'ouvre l'accès qu'à la
 * marque / le modèle / la couleur / l'identifiant public d'UN téléphone —
 * ni numéro de série, ni IMEI, ni document, ni identité du propriétaire,
 * ni aucune session.
 *
 * `/id/reparation` et `/id/invitation` restent volontairement HORS de
 * cette liste : ces deux parcours exigent un compte Nireo par conception
 * (tracer l'auteur d'une intervention, rattacher une invitation à une
 * adresse), et leur page ne fait qu'inviter à se connecter.
 */
const NIREO_ID_PUBLIC_PREFIXES = ["/id/exemple", "/id/p", "/id/s", "/id/bilan"];

function isNireoIdPublicPath(pathname: string): boolean {
  if (pathname === "/id") return true;
  return NIREO_ID_PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function matches(paths: string[], pathname: string): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicPath(pathname: string): boolean {
  return (
    isNireoIdPublicPath(pathname) ||
    pathname.startsWith("/auth") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    // Résumé éditorial lisible par les assistants et autres agents. Ce
    // fichier statique ne remplace ni robots.txt ni le contenu HTML : il doit
    // simplement rester accessible sans session, comme le sitemap.
    pathname === "/llms.txt" ||
    // Image sociale (og:image / twitter:image) : les robots de partage
    // (Facebook, X, LinkedIn…) la chargent sans session.
    pathname === "/opengraph-image" ||
    pathname === VERIFY_EMAIL_PATH ||
    // Tunnel Fondateur : la page d'entrée est publique (pitch + création de
    // compte), mais PAS ses sous-pages (/fondateur/bienvenue exige une session).
    pathname === "/fondateur" ||
    // Espace partenaire self-service : accès par jeton (pas de compte Nireo).
    pathname === "/partenaire" ||
    pathname.startsWith("/partenaire/") ||
    matches(PUBLIC_PATHS, pathname)
  );
}

/**
 * Attribution partenaire (« Marketing & Partenaires ») : quand un visiteur
 * arrive avec ?ref=CODE, le partenaire est validé CÔTÉ SERVEUR (existe,
 * actif, dates), le clic est enregistré (déduplication + anti-bot), et
 * l'attribution est posée dans un cookie HttpOnly dont la durée = fenêtre
 * d'attribution du partenaire (30 jours par défaut).
 *
 * Règle unique du projet : PREMIER partenaire attribué (first-touch) —
 * un cookie d'attribution existant n'est JAMAIS écrasé.
 */
async function capturePartnerReferral(
  request: NextRequest,
  response: NextResponse
): Promise<void> {
  if (request.method !== "GET") return;
  // Attribuer une commission à un partenaire est une finalité MARKETING :
  // sans consentement, le clic reste comptabilisé côté partenaire (donnée
  // agrégée, sans identifiant) mais AUCUN cookie de suivi n'est posé.
  const consented = hasAnalyticsConsent(request.cookies.get(CONSENT_COOKIE)?.value);
  const { pathname, searchParams } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/admin") || pathname.startsWith("/auth")) {
    return;
  }
  const ref = sanitizeRef(searchParams.get(REF_PARAM));
  if (!ref) return;

  // Le clic est toujours compté (trafic réel du partenaire), même si le
  // visiteur est déjà attribué à un autre partenaire.
  const result = await recordPartnerClick({
    ref,
    landingPage: pathname,
    source: searchParams.get("utm_source") ?? "",
    campaign: searchParams.get("utm_campaign") ?? "",
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.valid) return;

  // Le clic est mesuré, l'attribution non : pas de cookie sans consentement.
  if (!consented) return;

  // First-touch : une attribution existante et lisible reste en place.
  const existing = parseRefCookie(request.cookies.get(REF_COOKIE_NAME)?.value);
  if (existing) return;

  const windowDays = result.windowDays ?? DEFAULT_ATTRIBUTION_WINDOW_DAYS;
  response.cookies.set(REF_COOKIE_NAME, serializeRefCookie({ ref: result.slug ?? ref, ts: Date.now() }), {
    maxAge: windowDays * 86400,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/* ------------------------------------------------------------------ */
/*  Landing Intelligence — identité du visiteur                        */
/* ------------------------------------------------------------------ */

interface IdentityCookie {
  name: string;
  value: string;
}

/**
 * Pose l'identité nécessaire à la personnalisation de la vitrine :
 * - `nireo_vid` : UUID ALÉATOIRE (jamais dérivé de l'IP ni d'un compte) qui
 *   permet de servir la même version d'une visite à l'autre ;
 * - `nireo_vst` : nombre de visites + source d'acquisition de la visite.
 *
 * Les deux cookies sont HttpOnly, first-party, sans donnée personnelle, et
 * sont posés AVANT le rendu : la page voit l'identité dès la toute première
 * requête (sinon chaque nouveau visiteur fausserait les mesures).
 */
function captureLandingIdentity(request: NextRequest): IdentityCookie[] {
  if (request.method !== "GET") return [];
  const { pathname, searchParams } = request.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next")
  ) {
    return [];
  }
  // Les robots ne sont ni identifiés, ni personnalisés, ni mesurés.
  if (isCrawler(request.headers.get("user-agent"))) return [];

  // CONSENTEMENT — la condition qui manquait.
  // `nireo_vid` et `nireo_vst` ne sont pas strictement nécessaires : ils
  // mesurent ET personnalisent (quelle version de la vitrine est servie).
  // Tant que le visiteur n'a pas accepté, rien n'est posé. La vitrine sert
  // alors sa variante de référence — cas déjà prévu par le moteur
  // (`resolve.ts` renvoie le fallback quand `visitorId` est vide), donc
  // aucune page ne casse et aucune mesure biaisée n'est enregistrée.
  if (!hasAnalyticsConsent(request.cookies.get(CONSENT_COOKIE)?.value)) return [];

  const out: IdentityCookie[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  if (!isValidVisitorId(visitorId)) {
    visitorId = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, visitorId);
    out.push({ name: VISITOR_COOKIE, value: visitorId });
  }

  const previous = parseVisit(request.cookies.get(VISIT_COOKIE)?.value);
  const partnerRef =
    sanitizeRef(searchParams.get(REF_PARAM)) ||
    parseRefCookie(request.cookies.get(REF_COOKIE_NAME)?.value)?.ref ||
    null;
  const incoming = detectAcquisition({
    referrer: request.headers.get("referer"),
    utmSource: searchParams.get("utm_source"),
    utmMedium: searchParams.get("utm_medium"),
    partnerRef,
    siteHost: request.nextUrl.host,
  });

  let next: VisitState;
  if (!previous) {
    next = { count: 1, first: nowSec, last: nowSec, source: incoming };
  } else {
    const newVisit = nowSec - previous.last > VISIT_GAP_MS / 1000;
    next = {
      count: previous.count + (newVisit ? 1 : 0),
      first: previous.first,
      last: nowSec,
      // Dernier contact identifiable : une nouvelle provenance prime ;
      // sinon on conserve celle déjà attribuée à la visite.
      source: incoming !== "direct" ? incoming : previous.source,
    };
  }

  // On n'écrit que si l'état change vraiment (ou toutes les minutes) : pas de
  // `Set-Cookie` inutile à chaque navigation.
  const changed =
    !previous ||
    previous.count !== next.count ||
    previous.source !== next.source ||
    nowSec - previous.last > 60;
  if (changed) {
    const value = serializeVisit(next);
    request.cookies.set(VISIT_COOKIE, value);
    out.push({ name: VISIT_COOKIE, value });
  }
  return out;
}

export async function proxy(request: NextRequest) {
  // AVANT le rendu : la landing doit voir l'identité dès la 1re requête.
  let identity: IdentityCookie[] = [];
  try {
    identity = captureLandingIdentity(request);
  } catch {
    // silencieux : sans identité, la vitrine sert simplement la version de référence.
  }

  const response = await handleRequest(request);

  for (const cookie of identity) {
    response.cookies.set(cookie.name, cookie.value, {
      maxAge: VISITOR_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  // RETRAIT DU CONSENTEMENT — sans ceci, « Refuser » ne serait qu'un
  // affichage : les cookies déjà posés (HttpOnly, donc hors de portée du
  // JavaScript de la page) continueraient d'être renvoyés à chaque requête,
  // et la vitrine continuerait de personnaliser à partir d'eux.
  // Seul le serveur peut les effacer : c'est fait ici, à chaque passage.
  if (!hasAnalyticsConsent(request.cookies.get(CONSENT_COOKIE)?.value)) {
    for (const name of [VISITOR_COOKIE, VISIT_COOKIE, REF_COOKIE_NAME]) {
      if (request.cookies.has(name)) {
        response.cookies.set(name, "", { maxAge: 0, path: "/" });
      }
    }
  }

  // Jamais bloquant : une erreur d'attribution n'empêche pas la navigation.
  try {
    await capturePartnerReferral(request, response);
  } catch {
    // silencieux : la page se charge normalement, sans attribution.
  }
  return response;
}

/**
 * Rafraîchit la session Supabase et protège les routes privées.
 * Sans configuration Supabase, l'application reste en mode démo (tout ouvert).
 */
async function handleRequest(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const { url: supabaseUrl, publishableKey } = getSupabaseEnv();
  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Même durée que le client : le proxy ne doit jamais re-persister un
        // cookie que l'utilisateur a demandé éphémère (« rester connecté »
        // décoché), sinon la session survivrait à la fermeture du navigateur.
        const remember = rememberFromCookies(request.cookies.getAll());
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, {
            ...adjustPersistence(options, remember),
            // @supabase/ssr ne renseigne pas `secure` : sans ce repli, le
            // cookie de session repart sans le drapeau à chaque rafraîchissement.
            secure: options?.secure ?? SECURE_COOKIES,
          })
        );
      },
    },
  });

  // Ne pas insérer de logique entre createServerClient et getUser :
  // getUser() valide le jeton et rafraîchit la session si besoin.
  const {
    data: { user: rawUser },
  } = await supabase.auth.getUser();

  // Une session anonyme n'est JAMAIS un compte valide pour Nireo.
  const user = rawUser && !rawUser.is_anonymous ? rawUser : null;
  // Confirmation e-mail obligatoire : une session dont l'adresse n'est pas
  // confirmée n'ouvre aucune zone privée (contrôle serveur, pas seulement UI).
  const emailConfirmed = Boolean(user?.email_confirmed_at);

  const { pathname } = request.nextUrl;

  // Les routes API gèrent leur propre authentification (401 JSON) et le
  // webhook Stripe est appelé sans session : jamais de redirection ici.
  if (pathname.startsWith("/api")) {
    return response;
  }

  const redirectWithCookies = (to: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    if (next && next !== "/") url.searchParams.set("next", next);
    const redirect = NextResponse.redirect(url);
    response.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // ---------- Espace administrateur (/admin) ----------
  // Le proxy ne gère ici QUE la présence d'une session : le contrôle du rôle
  // administrateur est fait côté serveur (clé secrète, table admin_users)
  // dans le layout /admin — jamais dans le navigateur, jamais ici.
  if (pathname === "/admin/login") {
    // Déjà connecté : direction /admin — le layout renvoie les non-admins
    // vers leur dashboard client.
    if (user && emailConfirmed) return redirectWithCookies("/admin");
    return response;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!user) return redirectWithCookies("/admin/login");
    if (!emailConfirmed) return redirectWithCookies(VERIFY_EMAIL_PATH);
    return response;
  }

  // Visiteur non connecté sur « / » : la landing page est servie sans
  // changer l'URL (le dashboard privé reste sur « / » pour les connectés).
  if (!user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/accueil";
    // `{ request }` transmet les cookies d'identité posés juste avant : la
    // landing personnalisée les voit dès la toute première requête.
    const rewrite = NextResponse.rewrite(url, { request });
    response.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
    return rewrite;
  }

  // URL canonique de la landing pour les visiteurs : « / » (« /accueil »
  // reste accessible aux utilisateurs connectés qui veulent revoir le site).
  if (!user && pathname === "/accueil") {
    return redirectWithCookies("/");
  }

  if (!user && !isPublicPath(pathname)) {
    return redirectWithCookies("/connexion", pathname);
  }

  // Session valide mais e-mail non confirmé : uniquement les pages publiques
  // et la page de vérification (jamais de boucle : elle est publique).
  if (user && !emailConfirmed && !isPublicPath(pathname)) {
    return redirectWithCookies(VERIFY_EMAIL_PATH);
  }

  // Un utilisateur connecté (et confirmé) n'a rien à faire sur les pages
  // d'authentification ni sur la page de vérification d'e-mail.
  if (
    user &&
    emailConfirmed &&
    (matches(AUTH_PATHS, pathname) || pathname === VERIFY_EMAIL_PATH) &&
    pathname !== "/reinitialiser-mot-de-passe"
  ) {
    return redirectWithCookies("/");
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les assets statiques et les images optimisées.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
