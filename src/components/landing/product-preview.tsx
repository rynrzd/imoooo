import {
  Building2,
  FileText,
  Landmark,
  Percent,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { NAV_SECTIONS, ACCOUNT_NAV } from "@/config/nav";
import { DOCUMENT_CATEGORY_LABELS, RENT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * Aperçu du produit — l'espace connecté RÉEL, figé.
 *
 * Ce n'est pas un dashboard inventé pour la vitrine : la barre latérale est
 * construite à partir de `src/config/nav.ts` (mêmes rubriques, mêmes icônes,
 * mêmes groupes) avec la mise en forme exacte de `layout/nav-links.tsx`, les
 * tuiles sont le composant `StatCard` de l'application, les cartes sont ses
 * `Card`, et les statuts et catégories viennent de `src/lib/labels.ts`.
 * Changer la navigation ou un libellé dans l'application change donc cet
 * aperçu — il ne peut pas se désynchroniser du produit.
 *
 * Deux différences assumées, et seulement deux :
 * - le rendu est INERTE (aucun lien, aucun état, aucune requête) : c'est une
 *   image du produit, pas une démonstration cliquable ;
 * - les chiffres sont des exemples, ce que la page écrit noir sur blanc.
 *   Aucune donnée réelle, aucun compte, aucun nom de client.
 *
 * `.nireo-app-light` force le thème clair de l'application à l'intérieur du
 * cadre : l'aperçu montre le produit tel qu'il est, même si le visiteur
 * navigue en thème sombre.
 */

/** Une ligne de navigation, à l'identique de `layout/nav-links.tsx`. */
function NavRow({ title, icon: Icon, active }: { title: string; icon: typeof Building2; active: boolean }) {
  return (
    <span
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
        active
          ? "bg-accent font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
          : "font-normal text-muted-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground/70")} />
      {title}
    </span>
  );
}

export function ProductPreview() {
  return (
    <div
      // Inerte pour les technologies d'assistance : le texte alternatif dit ce
      // que l'image montre, on n'inflige pas une fausse navigation au clavier.
      role="img"
      aria-label="Aperçu du tableau de bord Nireo : valeur du patrimoine, revenus du mois, loyers encaissés et documents récents."
      className="nireo-app-light overflow-hidden rounded-lg ring-1 ring-black/8 shadow-[0_2px_4px_rgb(7_12_21/0.04),0_28px_60px_-40px_rgb(7_12_21/0.45)]"
    >
      <div aria-hidden className="flex min-h-[26rem] text-[13px] sm:min-h-[32rem]">
        {/* -------- Barre latérale : la navigation réelle -------- */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
          <div className="flex h-14 items-center gap-2 px-5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Building2 className="size-4.5" />
            </span>
            <span className="text-base font-semibold tracking-[-0.02em] text-foreground">Nireo</span>
          </div>

          <div className="flex flex-1 flex-col gap-5 px-3 pt-1 pb-4">
            {NAV_SECTIONS.map((section, index) => (
              <div key={section.label ?? index} className="flex flex-col gap-0.5">
                {section.label ? (
                  <p className="mb-1 px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
                    {section.label}
                  </p>
                ) : null}
                {section.items.map((item) => (
                  <NavRow
                    key={item.href}
                    title={item.title}
                    icon={item.icon}
                    active={item.href === "/"}
                  />
                ))}
              </div>
            ))}
            <div className="mt-auto flex flex-col gap-0.5">
              {ACCOUNT_NAV.map((item) => (
                <NavRow key={item.href} title={item.title} icon={item.icon} active={false} />
              ))}
            </div>
          </div>
        </aside>

        {/* -------- Contenu : le tableau de bord -------- */}
        <div className="min-w-0 flex-1 bg-background p-4 sm:p-6">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Mardi 4 juin
            </p>
            <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Bonjour Camille
            </p>
            <p className="text-sm text-muted-foreground">
              Votre patrimoine se porte bien. Rien ne demande votre attention aujourd’hui.
            </p>
          </div>

          {/* Sous 420 px, deux colonnes rogneraient « 1 240 000 € » : les
              tuiles passent alors sur une seule colonne, rien n'est tronqué. */}
          <div className="mt-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Valeur du patrimoine"
              value="1 240 000 €"
              hint="prix d’acquisition cumulés"
              icon={Landmark}
            />
            <StatCard
              label="Revenus du mois"
              value="8 650 €"
              icon={TrendingUp}
              trend={{ direction: "up", label: "+4,2 % vs mai", tone: "positive" }}
            />
            <StatCard
              label="Cash-flow du mois"
              value="5 470 €"
              icon={PiggyBank}
              tone="positive"
            />
            <StatCard
              label="Taux d’occupation"
              value="94 %"
              icon={Percent}
              progress={94}
              hint="6 occupés · 0 vacant"
            />
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Derniers loyers</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {[
                  { unit: "Appartement T2 — Lyon 6e", month: "mai 2026", amount: "1 350 €" },
                  { unit: "Appartement T3 — Bordeaux", month: "mai 2026", amount: "1 620 €" },
                  { unit: "Maison T4 — Nantes", month: "mai 2026", amount: "1 280 €" },
                ].map((row) => (
                  <div key={row.unit} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="min-w-0 flex-1 truncate text-foreground">{row.unit}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {row.month}
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">{row.amount}</span>
                    <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {RENT_STATUS_LABELS.paye}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents récents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {[
                  { name: "Bail de location.pdf", category: DOCUMENT_CATEGORY_LABELS.bail },
                  { name: "État des lieux.pdf", category: DOCUMENT_CATEGORY_LABELS.etat_des_lieux },
                  { name: "Diagnostic énergétique.pdf", category: DOCUMENT_CATEGORY_LABELS.diagnostics },
                ].map((doc) => (
                  <div key={doc.name} className="flex items-center gap-2.5">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">{doc.name}</span>
                      <span className="block text-xs text-muted-foreground">{doc.category}</span>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
