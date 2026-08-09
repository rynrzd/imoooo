import type { Metadata } from "next";
import Link from "next/link";
import { CheckupForm } from "@/components/nireo-id/checkup-form";
import { NidLogo } from "@/components/nireo-id/nid-logo";
import { CHECK_ANSWERS, CHECK_ANSWER_SHORT, type CheckAnswer } from "@/features/nireo-id/constants";
import { resolveCheckRequest } from "@/features/nireo-id/server/checkups";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bilan de votre téléphone",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, { title: string; text: string }> = {
  introuvable: {
    title: "Ce lien n’existe pas",
    text: "Vérifiez le lien reçu par e-mail, ou demandez un nouveau bilan au propriétaire du téléphone.",
  },
  expire: {
    title: "Ce lien a expiré",
    text: "Les liens de bilan expirent automatiquement. Demandez-en un nouveau depuis l’espace Nireo ID.",
  },
  revoque: {
    title: "Ce lien a été révoqué",
    text: "Le propriétaire a annulé cette demande de bilan.",
  },
};

/**
 * Page mobile de réponse à un bilan.
 * Aucune reconnexion n'est nécessaire tant que le jeton est valide.
 */
export default async function CheckupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reponse?: string }>;
}) {
  const { token } = await params;
  const { reponse } = await searchParams;
  const resolution = await resolveCheckRequest(token);

  const preselected =
    reponse && (CHECK_ANSWERS as readonly string[]).includes(reponse)
      ? (reponse as CheckAnswer)
      : null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 py-8">
      <div className="mb-6">
        <NidLogo href="/id" />
      </div>

      {resolution.state === "valide" ? (
        <>
          <h1 className="text-xl font-semibold text-foreground">Un rapide point sur votre téléphone</h1>
          {resolution.request.is_company ? (
            <p className="mt-2 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
              Ce bilan concerne uniquement l’état matériel de l’appareil. Aucune donnée d’usage
              personnel (appels, messages, position, applications) n’est consultée.
            </p>
          ) : null}

          <div className="mt-6">
            <CheckupForm
              token={token}
              deviceLabel={`${resolution.device.brand} ${resolution.device.model}`}
              preselected={preselected}
            />
          </div>
        </>
      ) : resolution.state === "deja_repondu" ? (
        <div className="nid-panel rounded-2xl p-6">
          <h1 className="text-lg font-semibold text-foreground">Bilan déjà enregistré</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre réponse
            {resolution.answer ? ` « ${CHECK_ANSWER_SHORT[resolution.answer]} »` : ""} a bien été
            prise en compte
            {resolution.answeredAt
              ? ` le ${new Date(resolution.answeredAt).toLocaleDateString("fr-FR")}`
              : ""}
            . Merci.
          </p>
        </div>
      ) : (
        <div className="nid-panel rounded-2xl p-6">
          <h1 className="text-lg font-semibold text-foreground">
            {MESSAGES[resolution.state]?.title ?? "Lien indisponible"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {MESSAGES[resolution.state]?.text ?? "Ce lien n’est plus utilisable."}
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link href="/id" className="underline underline-offset-2">
          Nireo ID — le suivi simple de votre téléphone
        </Link>
      </p>
    </main>
  );
}
