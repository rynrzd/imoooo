"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CompanyProfile } from "@/lib/admin/company";
import type { ActionResult } from "@/lib/admin/types";

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

/* --------------------------- Petits blocs UI ----------------------- */

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
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
        <textarea
          id={id}
          value={value}
          rows={rows ?? 3}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={TEXTAREA_CLASS}
        />
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

/** Éditeur générique de liste (ajout/suppression/édition d'éléments). */
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
  const field = (item: T, key: keyof T & string) =>
    String((item as Record<string, unknown>)[key] ?? "");

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
                  <Label htmlFor={`${title}-${i}-${f.key}`} className="text-xs">
                    {f.label}
                  </Label>
                  {f.type === "textarea" ? (
                    <textarea
                      id={`${title}-${i}-${f.key}`}
                      value={field(item, f.key)}
                      rows={2}
                      onChange={(e) => update(i, f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={TEXTAREA_CLASS}
                    />
                  ) : f.type === "select" ? (
                    <select
                      id={`${title}-${i}-${f.key}`}
                      value={field(item, f.key)}
                      onChange={(e) => update(i, f.key, e.target.value)}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value} className="bg-background text-foreground">
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`${title}-${i}-${f.key}`}
                      value={field(item, f.key)}
                      onChange={(e) => update(i, f.key, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Supprimer cet élément"
            >
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

export function CompanyEditor({
  initial,
  action,
}: {
  initial: CompanyProfile;
  action: (p: CompanyProfile) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<CompanyProfile>(initial);
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

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

  return (
    <div className="space-y-5 pb-24">
      {/* Identité */}
      <SectionCard title="Identité" description="Le socle de la vitrine : nom, slogan et récit.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Nom" value={profile.name} onChange={(v) => set("name", v)} placeholder="Nireo" />
          <TextField label="Logo (URL)" value={profile.logoUrl} onChange={(v) => set("logoUrl", v)} placeholder="https://…/logo.png" />
          <div className="sm:col-span-2">
            <TextField label="Slogan" value={profile.slogan} onChange={(v) => set("slogan", v)} placeholder="Le poste de pilotage de votre patrimoine." />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Histoire" type="textarea" rows={4} value={profile.story} onChange={(v) => set("story", v)} />
          </div>
          <TextField label="Vision" type="textarea" value={profile.vision} onChange={(v) => set("vision", v)} />
          <TextField label="Mission" type="textarea" value={profile.mission} onChange={(v) => set("mission", v)} />
        </div>
      </SectionCard>

      <ListEditor
        title="Chiffres clés"
        description="Quelques indicateurs marquants (affichés en grand)."
        items={profile.stats}
        blank={{ value: "", label: "" }}
        onChange={(v) => set("stats", v)}
        addLabel="Ajouter un chiffre"
        fields={[
          { key: "value", label: "Valeur", placeholder: "100 %" },
          { key: "label", label: "Libellé", placeholder: "données isolées" },
        ]}
      />

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

      <ListEditor
        title="Pourquoi travailler avec Nireo ?"
        description="Les cartes qui donnent envie de rejoindre l’aventure."
        items={profile.why}
        blank={{ icon: "qualite", title: "", text: "" }}
        onChange={(v) => set("why", v)}
        addLabel="Ajouter une carte"
        fields={[
          { key: "icon", label: "Icône", type: "select", options: WHY_ICON_OPTIONS },
          { key: "title", label: "Titre", placeholder: "Innovation" },
          { key: "text", label: "Description", type: "textarea", span2: true },
        ]}
      />

      <ListEditor
        title="Équipe"
        description="Photo (URL), nom, poste et courte description."
        items={profile.team}
        blank={{ name: "", role: "", photoUrl: "", bio: "" }}
        onChange={(v) => set("team", v)}
        addLabel="Ajouter un membre"
        fields={[
          { key: "name", label: "Nom", placeholder: "Prénom Nom" },
          { key: "role", label: "Poste", placeholder: "Cofondateur" },
          { key: "photoUrl", label: "Photo (URL)", placeholder: "https://…" },
          { key: "bio", label: "Description", type: "textarea" },
        ]}
      />

      <ListEditor
        title="Timeline"
        description="Les étapes clés de l’entreprise."
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

      <SectionCard title="Vidéo de présentation" description="Lien d’intégration (YouTube/Vimeo « embed ») ou URL directe .mp4.">
        <TextField label="Vidéo (URL)" value={profile.videoUrl} onChange={(v) => set("videoUrl", v)} placeholder="https://www.youtube.com/embed/…" />
      </SectionCard>

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

      <ListEditor
        title="FAQ entreprise"
        items={profile.faq}
        blank={{ question: "", answer: "" }}
        onChange={(v) => set("faq", v)}
        addLabel="Ajouter une question"
        fields={[
          { key: "question", label: "Question", placeholder: "Où sont hébergées les données ?", span2: true },
          { key: "answer", label: "Réponse", type: "textarea", span2: true },
        ]}
      />

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

      <SectionCard title="Coordonnées" description="Comment vous joindre.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="E-mail" value={profile.contactEmail} onChange={(v) => set("contactEmail", v)} placeholder="contact@nireo.fr" />
          <TextField label="Téléphone" value={profile.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="+33 …" />
          <TextField label="Adresse" value={profile.address} onChange={(v) => set("address", v)} placeholder="Ville, Pays" />
          <TextField label="Horaires" value={profile.hours} onChange={(v) => set("hours", v)} placeholder="Lun–Ven, 9h–18h" />
        </div>
      </SectionCard>

      {/* Barre de sauvegarde collante */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Switch checked={profile.published} onCheckedChange={(c) => set("published", c)} />
            <div className="leading-tight">
              <p className="text-sm font-medium">{profile.published ? "Vitrine publiée" : "Vitrine masquée"}</p>
              <p className="text-xs text-muted-foreground">Page publique /entreprise</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/entreprise" target="_blank" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              <span className="inline-flex items-center gap-1.5">
                Aperçu <ExternalLink className="size-3.5" />
              </span>
            </Link>
            <Button onClick={save} disabled={pending || !dirty}>
              {pending ? "Enregistrement…" : dirty ? "Enregistrer" : "Enregistré"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
