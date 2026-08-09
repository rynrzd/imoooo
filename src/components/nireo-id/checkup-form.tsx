"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CHECK_ANSWER_LABELS,
  CHECK_DETAIL_POINTS,
  type CheckAnswer,
} from "@/features/nireo-id/constants";
import { answerCheckupAction } from "@/features/nireo-id/actions/checkups";
import { cn } from "@/lib/utils";

/**
 * Réponse à un bilan depuis le lien reçu par e-mail.
 * Aucune reconnexion n'est demandée : le jeton du lien fait foi. Le
 * message de confirmation n'apparaît qu'après écriture réelle en base.
 */

const ANSWERS: CheckAnswer[] = ["tout_fonctionne", "probleme", "repare", "plus_detenu"];
const GRADES = ["ok", "usure", "defaut"] as const;
const GRADE_LABELS: Record<(typeof GRADES)[number], string> = {
  ok: "Fonctionne",
  usure: "Usure",
  defaut: "Défaut",
};

export function CheckupForm({
  token,
  deviceLabel,
  preselected,
}: {
  token: string;
  deviceLabel: string;
  preselected?: CheckAnswer | null;
}) {
  const [answer, setAnswer] = React.useState<CheckAnswer | null>(
    preselected && preselected !== "tout_fonctionne" ? preselected : null
  );
  const [details, setDetails] = React.useState<Record<string, string>>({});
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState<CheckAnswer | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (chosen: CheckAnswer) => {
    if (pending || done) return;
    setPending(true);
    setError(null);

    const form = new FormData();
    form.set("token", token);
    form.set("answer", chosen);
    form.set("comment", comment);
    for (const [key, value] of Object.entries(details)) {
      if (value) form.set(`detail_${key}`, value);
    }

    const result = await answerCheckupAction(form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(result.data.answer);
  };

  if (done) {
    return (
      <div className="nid-panel rounded-2xl p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent">
          <Check className="size-6 text-[var(--nid-success)]" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Merci.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          L’état du {new Date().toLocaleDateString("fr-FR")} a été ajouté à l’historique.
        </p>
        {done === "probleme" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Le propriétaire du téléphone a été prévenu du problème signalé.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-base text-foreground">
          Depuis votre dernier bilan, tout fonctionne normalement sur votre{" "}
          <strong>{deviceLabel}</strong> ?
        </legend>
        <div className="mt-4 grid gap-2">
          {ANSWERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => (value === "tout_fonctionne" ? submit(value) : setAnswer(value))}
              disabled={pending}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-60",
                answer === value
                  ? "border-primary bg-accent text-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              {value === "tout_fonctionne" ? (
                <Check className="size-4 shrink-0 text-[var(--nid-success)]" aria-hidden />
              ) : null}
              {CHECK_ANSWER_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      {answer && answer !== "tout_fonctionne" ? (
        <div className="nid-panel space-y-4 rounded-2xl p-4">
          {answer === "probleme" ? (
            <fieldset>
              <legend className="text-sm font-medium text-foreground">Ce qui pose problème</legend>
              <ul className="mt-3 space-y-2">
                {CHECK_DETAIL_POINTS.map((point) => (
                  <li key={point.key} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{point.label}</span>
                    <span className="flex gap-1">
                      {GRADES.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          aria-pressed={details[point.key] === grade}
                          onClick={() =>
                            setDetails((current) => ({
                              ...current,
                              [point.key]: current[point.key] === grade ? "" : grade,
                            }))
                          }
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                            details[point.key] === grade
                              ? "border-primary bg-accent text-accent-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {GRADE_LABELS[grade]}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}

          <div>
            <Label htmlFor="answer-comment">Commentaire (facultatif)</Label>
            <textarea
              id="answer-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button data-touch onClick={() => submit(answer)} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Enregistrement…
                </>
              ) : (
                "Envoyer ma réponse"
              )}
            </Button>
            <Button variant="ghost" onClick={() => setAnswer(null)} disabled={pending}>
              Changer de réponse
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-border bg-card p-3 text-sm text-[var(--nid-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
