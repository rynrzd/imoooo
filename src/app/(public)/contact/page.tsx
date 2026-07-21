import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contactez l'équipe Nireo : questions sur le produit, les tarifs ou le plan Business+.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-center">
        <p className="text-xs font-medium tracking-widest text-primary uppercase">Contact</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Parlons de votre patrimoine
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Une question sur le produit, les tarifs ou le plan Business (SCI,
          agences, équipes) ? Écrivez-nous : nous répondons rapidement.
        </p>
      </div>
      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
