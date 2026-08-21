/**
 * AUDIT ACCESSIBILITÉ — pages rendues dans un vrai navigateur.
 *
 * Usage : node scripts/a11y-audit.mjs [baseUrl] [chemin]
 *
 * Ce script ne lit pas le CSS : il rend la page, calcule les contrastes
 * réellement affichés, mesure les cibles tactiles, et surtout PARCOURT LA PAGE
 * À LA TOUCHE TAB pour vérifier que le focus se voit à chaque arrêt.
 */
import { launch, newPage, reporter, sleep } from "./_cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3126";
const PATHS = process.argv[3]
  ? [process.argv[3]]
  : [
      "/",
      "/tarifs",
      "/ressources",
      "/generateur-quittance-loyer",
      "/contact",
      "/mentions-legales",
      "/cgu",
      "/confidentialite",
      "/cookies",
      "/connexion",
      "/inscription",
      "/mot-de-passe-oublie",
      "/a-propos",
    ];

const AUDIT = String.raw`(() => {
  const out = {};
  const de = document.documentElement;
  out.overflow = de.scrollWidth - de.clientWidth;
  out.title = (document.title || "").trim();
  out.desc = (document.querySelector('meta[name="description"]')?.content || "").trim();
  out.canonical = document.querySelector('link[rel="canonical"]')?.href || "";
  out.og = !!document.querySelector('meta[property="og:title"]');
  out.noindex = /noindex/i.test(document.querySelector('meta[name="robots"]')?.content || "");
  out.lang = de.lang;
  out.landmarks = {
    main: document.querySelectorAll("main").length,
    nav: document.querySelectorAll("nav").length,
    header: document.querySelectorAll("header").length,
    footer: document.querySelectorAll("footer").length,
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(vis);
  out.h1 = hs.filter((h) => h.tagName === "H1").map((h) => h.innerText.trim().slice(0, 70));
  out.headingJumps = [];
  let prev = 0;
  for (const h of hs) {
    const lvl = +h.tagName[1];
    if (prev && lvl > prev + 1) out.headingJumps.push("h" + prev + "->h" + lvl + ": " + h.innerText.trim().slice(0, 40));
    prev = lvl;
  }
  const focusables = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.tabIndex >= 0);
  const first = focusables[0];
  out.firstFocusable = first
    ? first.tagName + " " + (first.innerText || first.getAttribute("aria-label") || "").trim().slice(0, 40)
    : "aucun";
  out.hasSkipLink = focusables.slice(0, 3).some(
    (el) =>
      el.tagName === "A" &&
      (el.getAttribute("href") || "").startsWith("#") &&
      /contenu|content|principal|main/i.test(el.innerText || el.getAttribute("aria-label") || "")
  );
  const name = (el) =>
    (
      el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby")
        ? el.getAttribute("aria-labelledby").split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ")
        : "") ||
      el.innerText ||
      el.getAttribute("title") ||
      el.querySelector("img")?.alt ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  out.namelessControls = [...document.querySelectorAll("a[href],button")]
    .filter(vis)
    .filter((el) => !name(el))
    .map((el) => el.tagName + "." + String(el.className || "").slice(0, 60))
    .slice(0, 12);
  out.unlabeled = [...document.querySelectorAll("input,select,textarea")]
    .filter(vis)
    .filter((el) => !["hidden", "submit", "button"].includes(el.type))
      // Retirés de l'arbre d'accessibilité (input caché d'un Switch base-ui,
      // par ex.) : ils ne sont ni lus ni atteignables, donc pas un défaut.
      .filter((el) => el.getAttribute("aria-hidden") !== "true" && el.tabIndex >= 0)
    .filter((el) => {
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
      if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return false;
      return !el.closest("label");
    })
    .map((el) => el.tagName + "#" + (el.id || el.name || "?"));
  out.imgNoAlt = [...document.querySelectorAll("img")]
    .filter(vis)
    .filter((i) => i.getAttribute("alt") === null)
    .map((i) => (i.currentSrc || i.src || "").slice(-60));
  /*
   * La cible, c'est ce qu'on peut TOUCHER — pas le dessin de la commande.
   * Une case à cocher de 16 px enveloppée dans un label de 44 px s'active en
   * appuyant n'importe où sur le label : la zone utile est celle du label.
   * Mesurer l'input seul signalait un défaut là où il n'y en a pas.
   */
  const hitArea = (el) => {
    const own = el.getBoundingClientRect();
    if (el.type !== "checkbox" && el.type !== "radio") return own;
    const label = el.closest("label") ||
      (el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : null);
    return label ? label.getBoundingClientRect() : own;
  };
  out.smallTargets = [...document.querySelectorAll("a[href],button,input[type=checkbox],input[type=radio]")]
    .filter(vis)
    .filter((el) => {
      const r = hitArea(el);
      // Hors de l'écran (lien d'évitement au repos, panneau replié) : ce n'est
      // pas une cible tactile tant qu'il n'est pas ramené par le focus.
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
      return r.height < 24 || r.width < 24;
    })
    .map((el) => {
      const r = hitArea(el);
      return name(el).slice(0, 30) + " " + Math.round(r.width) + "x" + Math.round(r.height);
    })
    .slice(0, 12);
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\/]/).map((x) => parseFloat(x));
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
  };
  /**
   * Fond réellement derrière un texte.
   *
   * Renvoie null quand il est INDÉTERMINABLE par le calcul : dégradé, photo,
   * ou texte peint par -webkit-background-clip. Dans ces cas le rapport ne
   * peut pas être calculé — et l'annoncer « 1:1 » serait un mensonge, pas un
   * constat. Ces éléments sont comptés à part et vérifiés à l'œil.
   */
  /*
   * Calques posés SOUS le texte sans être ses ancêtres : photo en balise img
   * absolue, voile en dégradé, halo décoratif. Remonter la lignée ne les voit
   * pas — c'est ainsi qu'un titre blanc sur photo sombre était annoncé 1:1
   * alors qu'il est parfaitement lisible.
   */
  const overlays = [...document.querySelectorAll("img, [style*='background'], *")]
    .filter((n) => {
      const s = getComputedStyle(n);
      if (s.position !== "absolute" && s.position !== "fixed") return false;
      const painted = n.tagName === "IMG" || (s.backgroundImage && s.backgroundImage !== "none");
      if (!painted) return false;
      const r = n.getBoundingClientRect();
      return r.width > 40 && r.height > 40;
    })
    .map((n) => n.getBoundingClientRect());

  const coveredByOverlay = (el) => {
    const r = el.getBoundingClientRect();
    return overlays.some(
      (o) => o.left <= r.left + 1 && o.right >= r.right - 1 && o.top <= r.top + 1 && o.bottom >= r.bottom - 1
    );
  };

  const bgOf = (el) => {
    if (coveredByOverlay(el)) return null;
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== "none") return null;
      const p = parse(s.backgroundColor);
      if (p && p.a > 0.85) return p.rgb;
      n = n.parentElement;
    }
    const b = parse(getComputedStyle(document.body).backgroundColor);
    return b ? b.rgb : [255, 255, 255];
  };
  out.lowContrast = [];
  out.undeterminable = 0;
  const seen = new Set();
  const texts = [...document.querySelectorAll("p,span,a,button,li,label,h1,h2,h3,h4,td,th,div,small,strong,em")].filter(vis);
  for (const el of texts) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el);
    // Texte peint par le fond (dégradé sur le lettrage) : non calculable.
    if (s.webkitTextFillColor === "rgba(0, 0, 0, 0)" || s.color === "rgba(0, 0, 0, 0)") { out.undeterminable++; continue; }
    const fg = parse(s.color);
    if (!fg) continue;
    const bg = bgOf(el);
    if (!bg) { out.undeterminable++; continue; }
    const eff = fg.a >= 1 ? fg.rgb : fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
    const L1 = lum(eff), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const label = el.innerText.replace(/\s+/g, " ").trim().slice(0, 42);
      const k = label + Math.round(ratio * 10);
      if (label && !seen.has(k)) {
        seen.add(k);
        out.lowContrast.push({ t: label, r: +ratio.toFixed(2), need, size: Math.round(size) });
      }
    }
  }
  out.lowContrast = out.lowContrast.sort((a, b) => a.r - b.r).slice(0, 14);
  return JSON.stringify(out);
})()`;

const FOCUS_PROBE = String.raw`(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return JSON.stringify({ end: true });
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  // Une ombre ENTIÈREMENT transparente ne se voit pas : Tailwind laisse des
  // couches « rgba(0, 0, 0, 0) 0px 0px 0px 0px » en place même sans anneau de
  // focus. Tester « boxShadow !== 'none' » déclarerait donc visible ce qui ne
  // l'est pas — c'est exactement ce qui produisait des verdicts flatteurs.
  const rest = (s.boxShadow || "none")
    .replace(/rgba\(0,\s*0,\s*0,\s*0\)\s*0px\s*0px\s*0px\s*0px/g, "")
    .replace(/[\s,]/g, "");
  const opaqueShadow = rest !== "" && rest !== "none";
  const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
  const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  return JSON.stringify({
    visible: outline || opaqueShadow,
    hidden: r.width < 1 || r.height < 1,
    sel: el.tagName.toLowerCase() + (cls ? "." + cls : ""),
    label: (el.getAttribute("aria-label") || el.innerText || el.value || "").replace(/\s+/g, " ").trim().slice(0, 34),
    shadow: (s.boxShadow || "").slice(0, 90),
  });
})()`;

const b = await launch();
const r = reporter();
try {
  const page = await newPage(b);
  await page.setCookie({ name: "nireo_consent", value: "all", url: BASE, path: "/" });

  for (const path of PATHS) {
    console.log(`\n───────── ${path} ─────────`);
    await page.resize(1280, 900);
    await page.goto(BASE + path);
    const d = JSON.parse(await page.evaluate(AUDIT));

    r.check(`${path} — <main> unique`, d.landmarks.main === 1, `main=${d.landmarks.main}`);
    r.check(`${path} — exactement un <h1>`, d.h1.length === 1, d.h1.length ? d.h1.join(" | ") : "aucun h1");
    r.check(`${path} — hiérarchie de titres sans saut`, d.headingJumps.length === 0, d.headingJumps.slice(0, 3).join(" ; "));
    r.check(`${path} — lien d'évitement vers le contenu`, d.hasSkipLink, `1er focusable : ${d.firstFocusable}`);
    r.check(`${path} — liens/boutons tous nommés`, d.namelessControls.length === 0, d.namelessControls.join(" ; "));
    r.check(`${path} — champs tous étiquetés`, d.unlabeled.length === 0, d.unlabeled.join(" ; "));
    r.check(`${path} — images toutes pourvues d'un alt`, d.imgNoAlt.length === 0, d.imgNoAlt.join(" ; "));
    r.check(
      `${path} — contrastes calculables conformes AA`,
      d.lowContrast.length === 0,
      d.lowContrast.map((c) => `"${c.t}" ${c.r}:1 (min ${c.need})`).join(" ; ")
    );
    if (d.undeterminable) r.note(`${path} — ${d.undeterminable} texte(s) sur dégradé/photo : contrôle visuel`);
    r.check(`${path} — title exploitable`, d.title.length > 5 && d.title.length <= 70, `${d.title.length} car. : ${d.title}`);
    // Une page en `noindex` n'apparaît dans aucun résultat de recherche :
    // la longueur de sa description n'y change rien. On vérifie seulement
    // qu'elle existe — juger sa taille produirait un « défaut » imaginaire.
    if (d.noindex) {
      r.check(`${path} — meta description présente (page non indexée)`, d.desc.length > 10, `${d.desc.length} car.`);
    } else {
      r.check(`${path} — meta description`, d.desc.length >= 50 && d.desc.length <= 175, `${d.desc.length} car.`);
    }
    r.check(`${path} — aucune erreur console`, page.state.errors.length === 0, page.state.errors.slice(0, 2).join(" | "));

    let invisible = [];
    let stops = 0;
    await page.evaluate("window.scrollTo(0,0); if(document.activeElement) document.activeElement.blur();");
    for (let i = 0; i < 18; i++) {
      await page.pressTab();
      const f = JSON.parse(await page.evaluate(FOCUS_PROBE));
      if (f.end) break;
      stops++;
      if (f.hidden) continue;
      if (!f.visible) invisible.push(`${f.sel}${f.label ? ` «${f.label}»` : ""}`);
    }
    r.check(
      `${path} — focus visible sur ${stops} arrêts clavier`,
      invisible.length === 0,
      invisible.length ? `INVISIBLE : ${[...new Set(invisible)].slice(0, 5).join(" ; ")}` : ""
    );

    // On RECHARGE après avoir réduit la fenêtre, au lieu de mesurer un rendu
    // desktop rétréci : sinon des éléments propres au grand écran (liens
    // d'en-tête remplacés par un menu, par exemple) restent dans la page et
    // sont comptés comme des cibles minuscules qu'aucun mobile n'affiche.
    await page.resize(360, 780);
    await page.goto(BASE + path);
    await sleep(400);
    const m = JSON.parse(await page.evaluate(AUDIT));
    r.check(`${path} — aucun débordement horizontal @360px`, m.overflow <= 2, `${m.overflow}px`);
    r.check(`${path} — cibles tactiles ≥ 24px @360px`, m.smallTargets.length === 0, m.smallTargets.join(" ; "));
  }
} finally {
  const s = r.summary();
  await b.close();
  await sleep(300);
  process.exit(s.failures.length ? 1 : 0);
}
