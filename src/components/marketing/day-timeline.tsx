import { Banknote, BarChart3, Bell, FileText, Receipt } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/**
 * « Une journée avec Nireo » — storytelling en frise horaire.
 * Rendu serveur + révélation douce au défilement (accessible, sans JS lourd).
 */

const MOMENTS = [
  { time: "08:30", icon: Banknote, title: "Un loyer est encaissé", text: "Le paiement de juillet est enregistré ; l’échéance passe au vert, sans rien faire.", tone: "text-primary bg-primary/12" },
  { time: "10:15", icon: FileText, title: "Un document est ajouté", text: "La nouvelle attestation d’assurance se range toute seule dans le dossier du bien.", tone: "text-teal-700 bg-teal-500/12" },
  { time: "13:40", icon: Receipt, title: "Une dépense est classée", text: "Une facture de travaux est reliée au chantier et à la comptabilité du logement.", tone: "text-emerald-700 bg-emerald-500/12" },
  { time: "18:00", icon: BarChart3, title: "Le patrimoine est consulté", text: "En un regard : occupation, résultat net et rendement, calculés en continu.", tone: "text-primary bg-primary/12" },
  { time: "20:00", icon: Bell, title: "Nireo résume la journée", text: "Une synthèse claire, et le rappel des échéances à venir. L’esprit tranquille.", tone: "text-amber-700 bg-amber-500/12" },
];

export function DayTimeline() {
  return (
    <div className="mx-auto max-w-3xl">
      <ol className="relative border-l border-border pl-10">
        {MOMENTS.map((m, i) => (
          <Reveal key={m.time} delay={(i % 5) * 80}>
            <li className="relative pb-10 last:pb-0">
              <span className={cn("absolute top-0 -left-[3.15rem] grid size-9 place-items-center rounded-xl ring-4 ring-[var(--background)]", m.tone)}>
                <m.icon className="size-4.5" />
              </span>
              <p className="font-mono text-xs font-semibold tracking-widest text-primary">{m.time}</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.text}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
