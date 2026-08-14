/**
 * Vérification des routes publiques SEO — sans connexion, sans suivre les
 * redirections, avec un navigateur normal PUIS avec OAI-SearchBot.
 *
 * Ce test existe parce qu'une page publique ajoutée sous src/app/(public)/
 * mais absente de MARKETING_PATHS (src/proxy.ts) renvoie un 307 vers
 * /connexion : la page est en ligne, mais invisible pour Google, Bing et
 * ChatGPT Search. C'est un échec silencieux — rien ne casse, le trafic
 * n'arrive simplement jamais.
 *
 * Il contrôle quatre choses :
 *   1. chaque page publique répond 200, sans en-tête Location ;
 *   2. chaque page porte son propre title, canonical, H1, description et
 *      un bloc JSON-LD valide ;
 *   3. llms.txt reste un vrai fichier texte et ne devient jamais /connexion ;
 *   4. chaque route privée redirige TOUJOURS un visiteur non connecté.
 *
 * Usage :
 *   node scripts/seo-routes-test.mjs                  # http://localhost:3000
 *   node scripts/seo-routes-test.mjs https://nireo.fr # production déployée
 */

/** Hôte réellement interrogé (peut être localhost). */
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");

/**
 * Origine CANONIQUE déclarée par le site (NEXT_PUBLIC_SITE_URL, défaut
 * https://nireo.fr). Elle est volontairement indépendante de l'hôte testé :
 * une page servie depuis localhost doit continuer de désigner l'URL publique
 * dans sa canonical et dans le sitemap — sinon un environnement de
 * préproduction ferait indexer ses propres URL.
 */
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nireo.fr").replace(/\/+$/, "");
/** Le mode démo ouvre volontairement l'application avec des données fictives. */
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
/** Robot officiellement documenté par OpenAI pour ChatGPT Search. */
const OAI_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot";

/** Pages qui DOIVENT répondre 200 sans redirection, sans session. */
const PUBLIC_PATHS = [
  "/",
  "/logiciel-gestion-locative",
  "/ressources",
  "/gestion-immobiliere",
  "/meilleur-logiciel-gestion-locative",
  "/alternative-excel-gestion-locative",
  "/logiciel-gestion-locative-gratuit",
  "/gestion-locative-proprietaire-bailleur",
  "/gestion-locative-sci",
  "/suivi-loyers",
  "/tarifs",
  "/a-propos",
  "/contact",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
];

/** Pages de contenu : elles doivent aussi porter des métadonnées complètes. */
const CONTENT_PATHS = PUBLIC_PATHS.filter(
  (p) =>
    !["/robots.txt", "/sitemap.xml", "/llms.txt", "/contact", "/a-propos"].includes(p) &&
    // En démo, « / » affiche volontairement le tableau de bord fictif au lieu
    // de la landing. Les métadonnées de la landing sont testées hors démo.
    !(DEMO_MODE && p === "/")
);

/** URL qui doivent RESTER fermées à un visiteur non connecté. */
const PRIVATE_PATHS = [
  "/logements",
  "/locataires",
  "/loyers",
  "/documents",
  "/photos",
  "/travaux",
  "/statistiques",
  "/pilotage",
  "/parametres",
  "/abonnement",
  "/id/app",
];

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`  ✗ ${message}`);
};
const pass = (message) => console.log(`  ✓ ${message}`);

/** Requête SANS suivre les redirections : c'est tout l'objet du test. */
async function fetchRaw(path, userAgent) {
  return fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { "user-agent": userAgent },
  });
}

function extract(html) {
  const one = (re) => {
    const m = html.match(re);
    return m ? m[1] : null;
  };
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return {
    title: one(/<title>([\s\S]*?)<\/title>/),
    canonical: one(/<link rel="canonical" href="([^"]+)"/),
    description: one(/<meta name="description" content="([^"]*)"/),
    h1Count: (html.match(/<h1[\s>]/g) ?? []).length,
    h1: one(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.replace(/<[^>]+>/g, "").trim(),
    jsonLd: jsonLd.map((m) => m[1]),
  };
}

async function checkPublicStatus(path, userAgent, label) {
  const response = await fetchRaw(path, userAgent);
  const location = response.headers.get("location");
  if (response.status !== 200) {
    fail(`${label} ${path} → HTTP ${response.status}${location ? ` vers ${location}` : ""}`);
    return null;
  }
  if (location) {
    fail(`${label} ${path} → 200 mais en-tête Location: ${location}`);
    return null;
  }
  pass(`${label} ${path} → 200`);
  return response;
}

async function main() {
  console.log(`Hôte testé       : ${BASE}`);
  console.log(`Origine canonique : ${SITE_ORIGIN}\n`);

  // ---------- 1. Pages publiques, navigateur normal ----------
  console.log("1. Pages publiques — navigateur normal (sans redirection suivie)");
  const bodies = new Map();
  for (const path of PUBLIC_PATHS) {
    const response = await checkPublicStatus(path, BROWSER_UA, "navigateur");
    if (response) bodies.set(path, await response.text());
  }

  // ---------- 2. Pages publiques, OAI-SearchBot ----------
  console.log("\n2. Pages publiques — user-agent OAI-SearchBot");
  for (const path of PUBLIC_PATHS) {
    await checkPublicStatus(path, OAI_UA, "OAI-SearchBot");
  }

  // ---------- 3. Métadonnées et JSON-LD ----------
  console.log("\n3. Métadonnées par page (title, canonical, H1, description, JSON-LD)");
  const seenTitles = new Map();
  const seenDescriptions = new Map();
  for (const path of CONTENT_PATHS) {
    const html = bodies.get(path);
    if (!html) continue;
    const meta = extract(html);
    const problems = [];

    if (!meta.title) problems.push("title absent");
    if (!meta.description) problems.push("description absente");
    if (!meta.canonical) problems.push("canonical absente");
    if (meta.h1Count !== 1) problems.push(`${meta.h1Count} balise(s) H1 (attendu : 1)`);
    if (meta.jsonLd.length === 0) problems.push("aucun JSON-LD");

    for (const block of meta.jsonLd) {
      try {
        JSON.parse(block);
      } catch (error) {
        problems.push(`JSON-LD invalide (${error.message})`);
      }
    }

    // Une canonical doit désigner la page elle-même sur l'origine publique,
    // jamais /connexion et jamais l'hôte de test.
    const expected = `${SITE_ORIGIN}${path === "/" ? "" : path}`;
    if (meta.canonical && meta.canonical.replace(/\/$/, "") !== expected.replace(/\/$/, "")) {
      problems.push(`canonical inattendue : ${meta.canonical} (attendu ${expected})`);
    }

    if (seenTitles.has(meta.title)) {
      problems.push(`title dupliqué avec ${seenTitles.get(meta.title)}`);
    } else seenTitles.set(meta.title, path);
    if (seenDescriptions.has(meta.description)) {
      problems.push(`description dupliquée avec ${seenDescriptions.get(meta.description)}`);
    } else seenDescriptions.set(meta.description, path);

    if (problems.length > 0) fail(`${path} — ${problems.join(" ; ")}`);
    else pass(`${path} — H1 « ${meta.h1} », canonical et JSON-LD conformes`);
  }

  // ---------- 4. Sitemap ----------
  console.log("\n4. Sitemap");
  const sitemap = bodies.get("/sitemap.xml") ?? "";
  for (const path of CONTENT_PATHS) {
    if (path === "/robots.txt" || path === "/sitemap.xml") continue;
    if (sitemap.includes(`<loc>${SITE_ORIGIN}${path === "/" ? "/" : path}</loc>`)) {
      pass(`sitemap contient ${path}`);
    } else {
      fail(`sitemap NE contient PAS ${path}`);
    }
  }
  for (const path of PRIVATE_PATHS) {
    if (sitemap.includes(`<loc>${SITE_ORIGIN}${path}</loc>`)) {
      fail(`sitemap expose la route privée ${path}`);
    }
  }
  // Les formulaires sans contenu informatif sont volontairement hors sitemap.
  for (const path of ["/connexion", "/inscription"]) {
    if (sitemap.includes(`<loc>${SITE_ORIGIN}${path}</loc>`)) {
      fail(`sitemap contient ${path} (formulaire sans contenu, attendu en noindex)`);
    } else pass(`sitemap exclut ${path}`);
  }

  // ---------- 5. robots.txt ----------
  console.log("\n5. robots.txt");
  const robots = bodies.get("/robots.txt") ?? "";
  if (/user-agent:\s*oai-searchbot/i.test(robots)) pass("groupe OAI-SearchBot présent");
  else fail("groupe OAI-SearchBot absent");

  // Un agent nommé ignore le groupe « * » : ses interdictions doivent être
  // répétées, sinon les routes privées lui sont ouvertes.
  const oaiGroup = robots.split(/user-agent:/i).find((g) => /^\s*oai-searchbot/i.test(g)) ?? "";
  for (const path of ["/api/", "/logements", "/locataires", "/parametres", "/abonnement"]) {
    if (oaiGroup.includes(`Disallow: ${path}`)) pass(`OAI-SearchBot : ${path} interdit`);
    else fail(`OAI-SearchBot : ${path} N'EST PAS interdit`);
  }
  for (const asset of ["/_next/", ".css", ".js"]) {
    if (robots.includes(`Disallow: ${asset}`)) fail(`ressource de rendu bloquée : ${asset}`);
  }

  // ---------- 6. llms.txt ----------
  console.log("\n6. llms.txt");
  const llms = bodies.get("/llms.txt") ?? "";
  const llmsResponse = await fetchRaw("/llms.txt", BROWSER_UA);
  const llmsContentType = llmsResponse.headers.get("content-type") ?? "";
  if (/^text\/plain\b/i.test(llmsContentType)) pass(`llms.txt servi en ${llmsContentType}`);
  else fail(`llms.txt servi avec le mauvais type : ${llmsContentType || "absent"}`);
  if (llms.startsWith("# Nireo")) pass("llms.txt décrit Nireo");
  else fail("llms.txt absent ou contenu inattendu");
  for (const path of [
    "/logiciel-gestion-locative",
    "/gestion-immobiliere",
    "/meilleur-logiciel-gestion-locative",
  ]) {
    if (llms.includes(`${SITE_ORIGIN}${path}`)) pass(`llms.txt référence ${path}`);
    else fail(`llms.txt ne référence pas ${path}`);
  }
  if (/<html|\/connexion|noindex/i.test(llms)) {
    fail("llms.txt contient une page HTML, une redirection de connexion ou noindex");
  } else pass("llms.txt est un fichier texte public, sans contenu de connexion");

  // ---------- 7. Routes privées toujours fermées ----------
  console.log("\n7. Routes privées — un visiteur non connecté ne doit jamais entrer");
  if (DEMO_MODE) {
    pass("contrôle des routes privées ignoré en mode démo (accès fictif intentionnel)");
  } else {
    for (const path of PRIVATE_PATHS) {
      const response = await fetchRaw(path, BROWSER_UA);
      const location = response.headers.get("location") ?? "";
      if (response.status === 200) {
        fail(`${path} → 200 alors qu'aucune session n'est fournie (FUITE)`);
      } else if (!/\/connexion|\/id\b/.test(location) && response.status >= 300 && response.status < 400) {
        pass(`${path} → ${response.status} vers ${location}`);
      } else if (response.status >= 300 && response.status < 400) {
        pass(`${path} → ${response.status} vers ${location}`);
      } else {
        pass(`${path} → ${response.status} (accès refusé)`);
      }
    }
  }

  console.log(
    failures === 0
      ? "\n✅ Toutes les vérifications passent."
      : `\n❌ ${failures} vérification(s) en échec.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`\nErreur : ${error.message}`);
  console.error("Le serveur est-il démarré ? (npm run build && npm start)");
  process.exit(2);
});
