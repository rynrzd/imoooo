"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspaceAction } from "@/features/nireo-id/actions/workspace";

/**
 * Création d'une entreprise ou d'un atelier.
 * Le compte reste unique : cet écran n'enferme personne dans un type de
 * compte, il crée seulement un espace supplémentaire.
 */
export function WorkspaceCreateForm({ initialKind }: { initialKind: "entreprise" | "atelier" }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<"entreprise" | "atelier">(initialKind);
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const form = new FormData();
    form.set("kind", kind);
    form.set("name", name);
    const result = await createWorkspaceAction(form);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Espace créé.");
    router.push(result.data.href);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="nid-panel space-y-5 rounded-lg p-5" noValidate>
      <fieldset>
        <legend className="text-sm font-medium text-foreground">Type d’espace</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                value: "entreprise" as const,
                title: "Entreprise",
                hint: "Suivre un parc de téléphones et les affecter à des salariés.",
              },
              {
                value: "atelier" as const,
                title: "Atelier de réparation",
                hint: "Recevoir des interventions et compléter l’historique d’un client.",
              },
            ]
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                kind === option.value ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{option.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="workspace-name">
          {kind === "entreprise" ? "Nom de l’entreprise" : "Nom de l’atelier"}
        </Label>
        <Input
          id="workspace-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={120}
          autoComplete="organization"
          aria-describedby={error ? "workspace-error" : undefined}
          className="mt-1.5"
        />
        {error ? (
          <p id="workspace-error" role="alert" className="mt-2 text-sm text-[var(--nid-danger)]">
            {error}
          </p>
        ) : null}
      </div>

      <Button type="submit" data-touch disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Création…
          </>
        ) : (
          "Créer l’espace"
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        Vous restez propriétaire de votre espace personnel : la création d’un espace supplémentaire
        ne modifie pas votre compte.
      </p>
    </form>
  );
}
