"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONTACT_EMAIL } from "@/components/marketing/site-footer";

/**
 * Formulaire de contact réel : POST /api/contact (stockage Supabase +
 * copie au support si un fournisseur e-mail est configuré). Le succès
 * n'est affiché qu'après confirmation du serveur — jamais simulé.
 * Anti-spam : champ piège invisible + limites de taille + rate limit serveur.
 */
export function ContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [website, setWebsite] = React.useState(""); // champ piège
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, website }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        received?: boolean;
        error?: string;
      };
      if (!response.ok || !body.received) {
        toast.error(body.error ?? "Envoi impossible. Réessayez ou écrivez-nous par e-mail.");
        return;
      }
      setSent(true);
      toast.success("Message envoyé : nous revenons vers vous rapidement.");
    } catch {
      toast.error("Erreur réseau : le message n'a pas été envoyé.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-foreground">Message bien reçu ✓</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Merci {name || ""}. Nous vous répondons à {email} dans les meilleurs délais.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Nom</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-email">E-mail</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-subject">Sujet</Label>
        <Input
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Plan Business, question produit…"
          required
          maxLength={150}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-message">Message</Label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {/* Champ piège anti-spam : caché aux humains, rempli par les robots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Ne pas remplir</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Vous pouvez aussi nous écrire directement : {CONTACT_EMAIL}.
        </p>
        <Button type="submit" disabled={sending}>
          <Mail data-icon="inline-start" />
          {sending ? "Envoi…" : "Envoyer le message"}
        </Button>
      </div>
    </form>
  );
}
