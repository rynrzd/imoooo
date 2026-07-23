import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";
import { adjustPersistence, rememberFromCookies } from "@/lib/supabase/session-persistence";

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

/** Pages marketing publiques (landing, tarifs, pages légales). */
const MARKETING_PATHS = [
  "/accueil",
  "/tarifs",
  "/contact",
  "/confidentialite",
  "/cgu",
  "/mentions-legales",
  "/cookies",
];

const PUBLIC_PATHS = [...AUTH_PATHS, ...MARKETING_PATHS];

function matches(paths: string[], pathname: string): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/auth") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    // Image sociale (og:image / twitter:image) : les robots de partage
    // (Facebook, X, LinkedIn…) la chargent sans session.
    pathname === "/opengraph-image" ||
    pathname === VERIFY_EMAIL_PATH ||
    // Tunnel Fondateur : la page d'entrée est publique (pitch + création de
    // compte), mais PAS ses sous-pages (/fondateur/bienvenue exige une session).
    pathname === "/fondateur" ||
    matches(PUBLIC_PATHS, pathname)
  );
}

/**
 * Rafraîchit la session Supabase et protège les routes privées.
 * Sans configuration Supabase, l'application reste en mode démo (tout ouvert).
 */
export async function proxy(request: NextRequest) {
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
          response.cookies.set(name, value, adjustPersistence(options, remember))
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
    const rewrite = NextResponse.rewrite(url);
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
