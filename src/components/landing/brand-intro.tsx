import { NireoMark } from "@/components/marketing/nireo-logo";

/**
 * Écran d'introduction — une signature de marque, pas un spinner.
 *
 * Fond bleu nuit, la marque au centre, le monogramme fait UN seul tour,
 * apparition puis disparition en fondu. Durée totale ≈ 880 ms, dont 620 ms
 * de rotation et 260 ms de fondu sortant.
 *
 * Garde-fous, dans cet ordre :
 * - `display: none` par défaut : sans JavaScript, l'écran n'existe pas et la
 *   page s'affiche immédiatement — il ne retarde donc jamais le chargement ;
 * - le script en ligne s'exécute pendant l'analyse du HTML (avant le premier
 *   rendu) : aucun scintillement, aucune erreur d'hydratation ;
 * - une seule fois par session (`sessionStorage`), et jamais si le visiteur
 *   demande moins d'animations ;
 * - `pointer-events: none` : la page reste cliquable pendant l'écran ;
 * - l'animation se termine sur `opacity: 0; visibility: hidden` même si le
 *   script de nettoyage n'est jamais exécuté.
 */

const INTRO_ID = "nireo-intro";

/** Clé de session — remise à zéro à chaque nouvel onglet. */
const SESSION_KEY = "nireo_intro_v2";

/** Rotation + fondu = 880 ms ; le nœud est retiré juste après. */
const TOTAL_MS = 900;

const SCRIPT = `(function(){try{
var e=document.getElementById(${JSON.stringify(INTRO_ID)});
if(!e)return;
if(sessionStorage.getItem(${JSON.stringify(SESSION_KEY)}))return;
if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
sessionStorage.setItem(${JSON.stringify(SESSION_KEY)},"1");
e.setAttribute("data-play","");
/* Le hero décale son entrée pour qu'elle commence quand l'écran s'efface. */
document.documentElement.style.setProperty("--nl-intro-delay","620ms");
setTimeout(function(){e.removeAttribute("data-play")},${TOTAL_MS});
}catch(_){}})();`;

export function BrandIntro() {
  return (
    <>
      <div
        id={INTRO_ID}
        className="nl-intro"
        aria-hidden="true"
        // Le script ci-dessous pose `data-play` avant l'hydratation.
        suppressHydrationWarning
      >
        <div className="flex items-center gap-3">
          <NireoMark
            flat
            className="nl-intro-mark size-11 rounded-[0.55rem] bg-white text-[var(--nl-cobalt,#1b52e8)]"
          />
          <span className="nl-intro-word text-[1.35rem] font-semibold tracking-[-0.03em] text-white">
            Nireo
          </span>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
