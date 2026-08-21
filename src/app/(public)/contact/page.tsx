import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { getPublicSiteSettings } from "@/lib/admin/settings";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez l'équipe Nireo : questions sur le produit, les tarifs ou le plan Business+.",
  alternates: { canonical: "/contact" },
  // Sans ceci, un partage de cette page affiche le titre générique du layout
  // racine au lieu du sien.
  openGraph: {
    type: "website",
    url: "/contact",
    title: "Contact",
    description:
      "Contactez l'équipe Nireo : questions sur le produit, les tarifs ou le plan Business+.",
  },
};

export default async function ContactPage() {
  // Adresse de support gérée depuis /admin/parametres (vide = non affichée).
  const { support_email } = await getPublicSiteSettings();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16 sm:px-8 sm:py-20">
      <div data-reveal className="nl-seq text-center">
        <p
          data-seq
          className="flex items-center justify-center gap-3 text-[0.72rem] font-medium tracking-[0.22em] text-[var(--nl-gray)] uppercase"
        >
          <span
            aria-hidden
            data-seq-rule
            style={{ ["--nl-delay" as string]: "120ms", ["--nl-dur" as string]: "0.5s" }}
            className="h-px w-8 bg-[var(--nl-cobalt)]"
          />
          Contact
        </p>
        <h1 className="mt-6 text-[clamp(2rem,5.5vw,2.9rem)] font-semibold text-balance text-foreground">
          <span data-mask-line style={{ ["--nl-delay" as string]: "80ms" }}>
            <span>Parlons de votre patrimoine</span>
          </span>
        </h1>
        <p
          data-seq
          style={{ ["--nl-delay" as string]: "260ms" }}
          className="mt-5 text-[0.98rem] leading-relaxed text-muted-foreground"
        >
          Une question sur le produit, les tarifs ou le plan Business (SCI,
          agences, équipes) ? Écrivez-nous : nous répondons rapidement.
        </p>
        {support_email ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ou directement par e-mail :{" "}
            <a
              href={`mailto:${support_email}`}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {support_email}
            </a>
          </p>
        ) : null}
      </div>
      <div data-reveal className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
