import { NireoMark } from "@/components/marketing/nireo-logo";

/**
 * Rideau d'introduction de la landing.
 *
 * Chorégraphie (≈ 960 ms sur ordinateur, ≈ 760 ms sur mobile) :
 * le monogramme fait UN tour, un cadre fin se dessine autour de la marque en
 * deux moitiés, puis l'écran s'ouvre en deux comme une porte et découvre le
 * hero — qui est déjà rendu derrière, complet et indexable.
 *
 * Garde-fous, dans cet ordre :
 * - le rideau est `display: none` par défaut : sans JavaScript, il n'existe
 *   pas et la page s'affiche immédiatement ;
 * - le script en ligne s'exécute pendant l'analyse du HTML (avant le premier
 *   rendu) : aucun scintillement, aucune erreur d'hydratation ;
 * - il ne joue qu'à la PREMIÈRE visite de la session (`sessionStorage`) et
 *   jamais si le visiteur demande moins d'animations ;
 * - `pointer-events: none` : la page reste cliquable même pendant le rideau ;
 * - l'animation se termine sur un état invisible (`opacity: 0`) même si le
 *   script de fermeture n'est jamais exécuté. Aucun temps d'attente ajouté.
 */

const INTRO_ID = "nireo-intro";

/** Clé de session — remise à zéro à chaque nouvel onglet. */
const SESSION_KEY = "nireo_intro_v1";

const SCRIPT = `(function(){try{
var e=document.getElementById(${JSON.stringify(INTRO_ID)});
if(!e)return;
if(sessionStorage.getItem(${JSON.stringify(SESSION_KEY)}))return;
if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
sessionStorage.setItem(${JSON.stringify(SESSION_KEY)},"1");
e.setAttribute("data-play","");
var m=window.matchMedia&&window.matchMedia("(max-width: 39.99rem)").matches;
/* Le hero décale son entrée pour qu'elle commence quand l'écran s'ouvre. */
document.documentElement.style.setProperty("--land-intro-delay",m?"480ms":"620ms");
setTimeout(function(){e.removeAttribute("data-play")},m?800:1000);
}catch(_){}})();`;

export function IntroCurtain() {
  return (
    <>
      <div
        id={INTRO_ID}
        className="land-intro"
        aria-hidden="true"
        // Le script ci-dessous pose `data-play` avant l'hydratation.
        suppressHydrationWarning
      >
        <div className="land-intro-panel" data-side="top" />
        <div className="land-intro-panel" data-side="bottom" />
        <div className="land-intro-stage">
          <div className="grid place-items-center">
            <svg
              viewBox="0 0 134 54"
              width="228"
              height="92"
              fill="none"
              aria-hidden
              className="col-start-1 row-start-1 text-[var(--land-stone)]"
            >
              {/* Deux moitiés dessinées en même temps : le cadre s'ouvre. */}
              <path className="land-intro-frame" d="M67 1H133V53H67" stroke="currentColor" strokeWidth="0.75" />
              <path className="land-intro-frame" d="M67 1H1V53H67" stroke="currentColor" strokeWidth="0.75" />
            </svg>
            <div className="col-start-1 row-start-1 flex items-center gap-2.5">
              <NireoMark flat className="land-intro-mark size-9" />
              <span className="text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground">
                Nireo
              </span>
            </div>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
