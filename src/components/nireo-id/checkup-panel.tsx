"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CHECK_ANSWER_LABELS,
  CHECK_DETAIL_POINTS,
  CHECK_FREQUENCIES,
  type CheckAnswer,
} from "@/features/nireo-id/constants";
import {
  selfCheckupAction,
  sendCheckAction,
  updateScheduleAction,
} from "@/features/nireo-id/actions/checkups";
import { cn } from "@/lib/utils";

/**
 * Bilan d'un téléphone.
 *
 * « Tout fonctionne » se valide en un clic ; les détails ne sont demandés
 * que lorsqu'un problème est signalé. Le lien envoyé à un détenteur n'est
 * annoncé « envoyé » que si le fournisseur e-mail l'a accepté.
 */

const ANSWERS: CheckAnswer[] = ["tout_fonctionne", "probleme", "repare", "plus_detenu"];
const GRADES = ["ok", "usure", "defaut"] as const;
const GRADE_LABELS: Record<(typeof GRADES)[number], string> = {
  ok: "Fonctionne",
  usure: "Usure",
  defaut: "Défaut",
};

export function CheckupPanel({
  assetId,
  frequencyMonths,
  enabled,
  nextCheckOn,
  lastCheckAt,
  canSendLink,
}: {
  assetId: string;
  frequencyMonths: number;
  enabled: boolean;
  nextCheckOn: string | null;
  lastCheckAt: string | null;
  canSendLink: boolean;
}) {
  const router = useRouter();
  const [answer, setAnswer] = React.useState<CheckAnswer | null>(null);
  const [details, setDetails] = React.useState<Record<string, string>>({});
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [linkPending, setLinkPending] = React.useState(false);
  const [manualLink, setManualLink] = React.useState<string | null>(null);
  const [frequency, setFrequency] = React.useState(String(frequencyMonths));
  const [remindersOn, setRemindersOn] = React.useState(enabled);

  const needsDetails = answer === "probleme";

  const submit = async (chosen: CheckAnswer) => {
    if (pending) return;
    setPending(true);
    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("answer", chosen);
    form.set("comment", comment);
    for (const [key, value] of Object.entries(details)) form.set(`detail_${key}`, value);

    const result = await selfCheckupAction(form);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Merci. L’état a été ajouté à l’historique.");
    setAnswer(null);
    setDetails({});
    setComment("");
    router.refresh();
  };

  const saveSchedule = async (nextFrequency: string, nextEnabled: boolean) => {
    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("frequency_months", nextFrequency);
    form.set("enabled", nextEnabled ? "true" : "false");
    const result = await updateScheduleAction(form);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Planification enregistrée.");
    router.refresh();
  };

  const sendLink = async () => {
    if (linkPending) return;
    setLinkPending(true);
    const form = new FormData();
    form.set("asset_id", assetId);
    form.set("scope", "mini");
    const result = await sendCheckAction(form);
    setLinkPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.data.already) {
      toast.info("Un bilan est déjà en cours pour ce téléphone.");
      return;
    }
    if (result.data.email_sent) {
      toast.success("E-mail envoyé au détenteur.");
      setManualLink(null);
    } else {
      setManualLink(result.data.url);
      toast.warning("Aucun e-mail n’a été envoyé : transmettez le lien ci-dessous.");
    }
    router.refresh();
  };

  return (
    <section id="bilan" className="nid-panel scroll-mt-20 rounded-lg p-5">
      <h2 className="font-medium text-foreground">Bilan</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {lastCheckAt
          ? `Dernier bilan le ${new Date(lastCheckAt).toLocaleDateString("fr-FR")}.`
          : "Aucun bilan enregistré pour le moment."}
        {nextCheckOn
          ? ` Prochain bilan prévu le ${new Date(`${nextCheckOn}T00:00:00`).toLocaleDateString("fr-FR")}.`
          : ""}
      </p>

      {/* Réponse principale */}
      <fieldset className="mt-4">
        <legend className="text-sm text-foreground">
          Depuis votre dernier bilan, tout fonctionne normalement ?
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ANSWERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => (value === "tout_fonctionne" ? submit(value) : setAnswer(value))}
              disabled={pending}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors disabled:opacity-60",
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

      {/* Détails, uniquement lorsqu'ils sont utiles */}
      {answer && answer !== "tout_fonctionne" ? (
        <div className="mt-4 space-y-4 rounded-xl border border-border bg-card p-4">
          {needsDetails ? (
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
            <Label htmlFor="checkup-comment">Commentaire (facultatif)</Label>
            <textarea
              id="checkup-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button data-touch disabled={pending} onClick={() => submit(answer)}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer le bilan"
              )}
            </Button>
            <Button variant="ghost" onClick={() => setAnswer(null)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      {/* Planification */}
      <div className="mt-6 border-t border-border pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="checkup-frequency">Fréquence des rappels</Label>
            <select
              id="checkup-frequency"
              value={frequency}
              onChange={(event) => {
                setFrequency(event.target.value);
                void saveSchedule(event.target.value, remindersOn);
              }}
              className="mt-1.5 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
            >
              {CHECK_FREQUENCIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={remindersOn}
              onChange={(event) => {
                setRemindersOn(event.target.checked);
                void saveSchedule(frequency, event.target.checked);
              }}
            />
            Recevoir les rappels
          </label>

          {canSendLink ? (
            <Button variant="outline" onClick={sendLink} disabled={linkPending}>
              {linkPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                  Envoi…
                </>
              ) : (
                "Envoyer le bilan au détenteur"
              )}
            </Button>
          ) : null}
        </div>

        {manualLink ? (
          <div className="nid-note mt-3 rounded-xl p-3">
            <p className="text-sm text-foreground">
              Aucun e-mail n’a été envoyé (aucun fournisseur configuré). Transmettez ce lien :
            </p>
            <p className="mt-2 break-all font-mono text-xs text-foreground">{manualLink}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
