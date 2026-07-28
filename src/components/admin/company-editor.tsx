"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Eye, Monitor, Plus, Smartphone, Tablet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AboutContent } from "@/components/marketing/about-content";
import { CompanyVideoManager } from "@/components/admin/company-video";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CompanyProfile } from "@/lib/admin/company";
import type { ActionResult } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const WHY_ICON_OPTIONS = [
  { value: "innovation", label: "Innovation" },
  { value: "ambition", label: "Ambition" },
  { value: "transparence", label: "Transparence" },
  { value: "equipe", label: "Esprit d’équipe" },
  { value: "evolution", label: "Évolution" },
  { value: "vision", label: "Vision long terme" },
  { value: "satisfaction", label: "Satisfaction client" },
  { value: "qualite", label: "Qualité du produit" },
  { value: "securite", label: "Sécurité" },
  { value: "croissance", label: "Croissance" },
  { value: "passion", label: "Passion" },
];

const TABS = [
  "Identité",
  "Histoire",
  "Vision & valeurs",
  "Équipe",
  "Chiffres",
  "Partenaires & médias",
  "Recrutement",
  "Aperçu",
] as const;

/* --------------------------- Petits blocs UI ----------------------- */

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "textarea";
  rows?: number;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {type === "textarea" ? (
        <textarea id={id} value={value} rows={rows ?? 3} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={TEXTAREA_CLASS} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

type FieldDef<T> = {
  key: keyof T & string;
  label: string;
  type?: "text" | "textarea" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  span2?: boolean;
};

function ListEditor<T extends object>({
  title,
  description,
  items,
  blank,
  fields,
  onChange,
  addLabel,
}: {
  title: string;
  description?: string;
  items: T[];
  blank: T;
  fields: FieldDef<T>[];
  onChange: (items: T[]) => void;
  addLabel: string;
}) {
  const update = (i: number, key: keyof T & string, val: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)) as T[]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { ...blank }]);
  const field = (item: T, key: keyof T & string) => String((item as Record<string, unknown>)[key] ?? "");

  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Aucun élément. Cette section sera masquée sur la vitrine.
          </p>
        ) : null}

        {items.map((item, i) => (
          <div key={i} className="relative rounded-lg border border-border bg-background p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={`space-y-1.5 ${f.span2 || f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={`${title}-${i}-${f.key}`} className="text-xs">{f.label}</Label>
                  {f.type === "textarea" ? (
                    <textarea id={`${title}-${i}-${f.key}`} value={field(item, f.key)} rows={2} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder} className={TEXTAREA_CLASS} />
                  ) : f.type === "select" ? (
                    <select
                      id={`${title}-${i}-${f.key}`}
                      value={field(item, f.key)}
                      onChange={(e) => update(i, f.key, e.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value} className="bg-background text-foreground">{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input id={`${title}-${i}-${f.key}`} value={field(item, f.key)} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder} />
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => remove(i)} className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Supprimer cet élément">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={add}>
          <Plus data-icon="inline-start" />
          {addLabel}
        </Button>
      </div>
    </SectionCard>
  );
}

/* ------------------------------ Éditeur ---------------------------- */

export function CompanyEditor({ initial, action }: { initial: CompanyProfile; action: (p: CompanyProfile) => Promise<ActionResult> }) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<CompanyProfile>(initial);
  const [pending, startTransition] = React.useTransition();
  const [tab, setTab] = React.useState(0);
  const [device, setDevice] = React.useState<"desktop" | "tablet" | "mobile">("desktop");

  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) => setProfile((p) => ({ ...p, [key]: value }));
  const setRec = <K extends keyof CompanyProfile["recruitment"]>(key: K, value: CompanyProfile["recruitment"][K]) =>
    setProfile((p) => ({ ...p, recruitment: { ...p.recruitment, [key]: value } }));

  const dirty = JSON.stringify(profile) !== JSON.stringify(initial);

  const save = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await action(profile);
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const deviceWidth = device === "desktop" ? "100%" : device === "tablet" ? "820px" : "400px";

  return (
    <div className="space-y-5 pb-24">
      {/* Onglets */}
      <div role="tablist" aria-label="Sections de la présentation" className="flex gap-1 overflow-x-auto rounded-xl bg-card p-1 ring-1 ring-foreground/10 [scrollbar-width:none]">
        {TABS.map((t, i) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === i}
            onClick={() => setTab(i)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              tab === i ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 0 — Identité */}
      {tab === 0 ? (
        <div className="space-y-5">
          <SectionCard title="Identité" description="Le socle de la vitrine.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Nom de l’entreprise" value={profile.name} onChange={(v) => set("name", v)} placeholder="Nireo" />
              <TextField label="Site web" value={profile.website} onChange={(v) => set("website", v)} placeholder="https://nireo.fr" />
              <TextField label="Logo — clair (URL)" value={profile.logoUrl} onChange={(v) => set("logoUrl", v)} placeholder="https://…/logo.png" />
              <TextField label="Logo — sombre (URL)" value={profile.logoDarkUrl} onChange={(v) => set("logoDarkUrl", v)} placeholder="https://…/logo-dark.png" />
              <div className="sm:col-span-2">
                <TextField label="Phrase courte de présentation" value={profile.shortPitch} onChange={(v) => set("shortPitch", v)} placeholder="Le centre de contrôle du patrimoine." />
              </div>
              <div className="sm:col-span-2">
                <TextField label="Slogan" value={profile.slogan} onChange={(v) => set("slogan", v)} />
              </div>
              <TextField label="Année de création" value={profile.foundedYear} onChange={(v) => set("foundedYear", v)} placeholder="2026" />
              <TextField label="Ville" value={profile.city} onChange={(v) => set("city", v)} placeholder="Lyon" />
              <TextField label="Pays" value={profile.country} onChange={(v) => set("country", v)} placeholder="France" />
            </div>
          </SectionCard>

          <SectionCard title="Coordonnées">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="E-mail professionnel" value={profile.contactEmail} onChange={(v) => set("contactEmail", v)} placeholder="contact@nireo.fr" />
              <TextField label="Téléphone" value={profile.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="+33 …" />
              <TextField label="Adresse" value={profile.address} onChange={(v) => set("address", v)} placeholder="Ville, Pays" />
              <TextField label="Horaires" value={profile.hours} onChange={(v) => set("hours", v)} placeholder="Lun–Ven, 9h–18h" />
            </div>
          </SectionCard>

          <ListEditor
            title="Réseaux sociaux"
            items={profile.social}
            blank={{ platform: "", url: "" }}
            onChange={(v) => set("social", v)}
            addLabel="Ajouter un réseau"
            fields={[
              { key: "platform", label: "Plateforme", placeholder: "LinkedIn" },
              { key: "url", label: "Lien (URL)", placeholder: "https://…" },
            ]}
          />
        </div>
      ) : null}

      {/* 1 — Histoire */}
      {tab === 1 ? (
        <div className="space-y-5">
          <SectionCard title="Histoire" description="Pourquoi Nireo existe, le problème identifié, le récit du projet.">
            <TextField label="Récit" type="textarea" rows={6} value={profile.story} onChange={(v) => set("story", v)} />
          </SectionCard>
          <ListEditor
            title="Timeline"
            description="Les étapes importantes (dates, titres, descriptions)."
            items={profile.timeline}
            blank={{ date: "", title: "", text: "" }}
            onChange={(v) => set("timeline", v)}
            addLabel="Ajouter une étape"
            fields={[
              { key: "date", label: "Date", placeholder: "2026" },
              { key: "title", label: "Titre", placeholder: "Lancement" },
              { key: "text", label: "Description", type: "textarea", span2: true },
            ]}
          />
        </div>
      ) : null}

      {/* 2 — Vision & valeurs */}
      {tab === 2 ? (
        <div className="space-y-5">
          <SectionCard title="Vision & mission">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Vision" type="textarea" value={profile.vision} onChange={(v) => set("vision", v)} />
              <TextField label="Mission" type="textarea" value={profile.mission} onChange={(v) => set("mission", v)} />
            </div>
          </SectionCard>
          <ListEditor
            title="Valeurs"
            items={profile.values}
            blank={{ title: "", text: "" }}
            onChange={(v) => set("values", v)}
            addLabel="Ajouter une valeur"
            fields={[
              { key: "title", label: "Titre", placeholder: "Rigueur" },
              { key: "text", label: "Description", type: "textarea" },
            ]}
          />
        </div>
      ) : null}

      {/* 3 — Équipe */}
      {tab === 3 ? (
        <ListEditor
          title="Équipe"
          description="Photo (URL), nom, poste et courte biographie."
          items={profile.team}
          blank={{ name: "", role: "", photoUrl: "", bio: "" }}
          onChange={(v) => set("team", v)}
          addLabel="Ajouter un membre"
          fields={[
            { key: "name", label: "Nom", placeholder: "Prénom Nom" },
            { key: "role", label: "Fonction", placeholder: "Cofondateur" },
            { key: "photoUrl", label: "Photo (URL)", placeholder: "https://…" },
            { key: "bio", label: "Biographie", type: "textarea" },
          ]}
        />
      ) : null}

      {/* 4 — Chiffres clés */}
      {tab === 4 ? (
        <ListEditor
          title="Chiffres clés"
          description="Uniquement des chiffres réels ou des indicateurs produit vérifiables."
          items={profile.stats}
          blank={{ value: "", label: "" }}
          onChange={(v) => set("stats", v)}
          addLabel="Ajouter un chiffre"
          fields={[
            { key: "value", label: "Valeur", placeholder: "100 %" },
            { key: "label", label: "Libellé", placeholder: "données isolées" },
          ]}
        />
      ) : null}

      {/* 5 — Partenaires & médias */}
      {tab === 5 ? (
        <div className="space-y-5">
          <ListEditor
            title="Partenaires"
            items={profile.partners}
            blank={{ name: "", url: "" }}
            onChange={(v) => set("partners", v)}
            addLabel="Ajouter un partenaire"
            fields={[
              { key: "name", label: "Nom", placeholder: "Stripe" },
              { key: "url", label: "Site (URL)", placeholder: "https://…" },
            ]}
          />
          <ListEditor
            title="Certifications"
            items={profile.certifications}
            blank={{ name: "", issuer: "" }}
            onChange={(v) => set("certifications", v)}
            addLabel="Ajouter une certification"
            fields={[
              { key: "name", label: "Intitulé", placeholder: "Hébergement UE (RGPD)" },
              { key: "issuer", label: "Délivrée par", placeholder: "…" },
            ]}
          />
          <ListEditor
            title="Récompenses"
            items={profile.awards}
            blank={{ name: "", year: "" }}
            onChange={(v) => set("awards", v)}
            addLabel="Ajouter une récompense"
            fields={[
              { key: "name", label: "Intitulé", placeholder: "…" },
              { key: "year", label: "Année", placeholder: "2026" },
            ]}
          />
          <ListEditor
            title="Presse"
            items={profile.press}
            blank={{ title: "", outlet: "", url: "", date: "" }}
            onChange={(v) => set("press", v)}
            addLabel="Ajouter un article"
            fields={[
              { key: "title", label: "Titre", placeholder: "…", span2: true },
              { key: "outlet", label: "Média", placeholder: "Les Échos" },
              { key: "date", label: "Date", placeholder: "2026" },
              { key: "url", label: "Lien (URL)", placeholder: "https://…", span2: true },
            ]}
          />
          <CompanyVideoManager value={profile.video} onChange={(v) => set("video", v)} />
          <ListEditor
            title="Galerie / Bureaux"
            description="Photos des bureaux ou visuels de marque (URL)."
            items={profile.gallery}
            blank={{ url: "", caption: "" }}
            onChange={(v) => set("gallery", v)}
            addLabel="Ajouter une image"
            fields={[
              { key: "url", label: "Image (URL)", placeholder: "https://…", span2: true },
              { key: "caption", label: "Légende", placeholder: "Nos bureaux" },
            ]}
          />
        </div>
      ) : null}

      {/* 6 — Recrutement */}
      {tab === 6 ? (
        <div className="space-y-5">
          <SectionCard title="Recrutement & collaboration" description="Donnez envie de rejoindre l’aventure Nireo. Ton ambitieux, honnête et professionnel.">
            <div className="space-y-3">
              <TextField label="Texte d’introduction" type="textarea" rows={3} value={profile.recruitment.intro} onChange={(v) => setRec("intro", v)} />
              <TextField label="E-mail de contact recrutement" value={profile.recruitment.ctaEmail} onChange={(v) => setRec("ctaEmail", v)} placeholder="jobs@nireo.fr" />
            </div>
          </SectionCard>
          <ListEditor
            title="Raisons de nous rejoindre"
            items={profile.recruitment.reasons}
            blank={{ title: "", text: "" }}
            onChange={(v) => setRec("reasons", v)}
            addLabel="Ajouter une raison"
            fields={[
              { key: "title", label: "Titre", placeholder: "Un impact réel" },
              { key: "text", label: "Description", type: "textarea" },
            ]}
          />
          <ListEditor
            title="Profils & collaborations recherchés"
            description="Développeurs, designers, freelances, partenaires, investisseurs…"
            items={profile.recruitment.lookingFor}
            blank={{ label: "" }}
            onChange={(v) => setRec("lookingFor", v)}
            addLabel="Ajouter un profil"
            fields={[{ key: "label", label: "Profil / collaboration", placeholder: "Développeurs produit", span2: true }]}
          />
          <ListEditor
            title="Pourquoi travailler avec Nireo ? (cartes publiques)"
            description="Les cartes affichées sur la page publique."
            items={profile.why}
            blank={{ icon: "qualite", title: "", text: "" }}
            onChange={(v) => set("why", v)}
            addLabel="Ajouter une carte"
            fields={[
              { key: "icon", label: "Icône", type: "select", options: WHY_ICON_OPTIONS },
              { key: "title", label: "Titre", placeholder: "Ambition" },
              { key: "text", label: "Description", type: "textarea", span2: true },
            ]}
          />
        </div>
      ) : null}

      {/* 7 — Aperçu */}
      {tab === 7 ? (
        <div className="space-y-4">
          <SectionCard title="Prévisualisation" description="Aperçu en direct de la page publique — reflète vos modifications non encore enregistrées.">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                {([
                  { id: "desktop", icon: Monitor, label: "Bureau" },
                  { id: "tablet", icon: Tablet, label: "Tablette" },
                  { id: "mobile", icon: Smartphone, label: "Mobile" },
                ] as const).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDevice(d.id)}
                    className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors", device === d.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    <d.icon className="size-3.5" /> {d.label}
                  </button>
                ))}
              </div>
              <Link href="/a-propos" target="_blank" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Ouvrir en plein écran <ExternalLink className="size-3.5" />
              </Link>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              La largeur simulée donne un aperçu ; pour un test précis sur mobile, ouvrez la vitrine en plein écran.
            </p>
          </SectionCard>

          <div className="overflow-x-auto rounded-2xl border border-border bg-[oklch(0.15_0.016_265)] p-3">
            <div className="mx-auto overflow-hidden rounded-xl ring-1 ring-white/10 transition-[max-width] duration-300" style={{ maxWidth: deviceWidth }}>
              <div className="dark nireo max-h-[70vh] overflow-y-auto bg-background text-foreground">
                <AboutContent profile={profile} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Barre de sauvegarde collante */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Switch checked={profile.published} onCheckedChange={(c) => set("published", c)} />
            <div className="leading-tight">
              <p className="text-sm font-medium">{profile.published ? "Vitrine publiée" : "Brouillon (masquée)"}</p>
              <p className="text-xs text-muted-foreground">Page publique /a-propos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setTab(7)} className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline-flex">
              <Eye className="size-3.5" /> Aperçu
            </button>
            <Button onClick={save} disabled={pending || !dirty}>
              {pending ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
