"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/admin/types";

/**
 * Formulaires des paramètres du site. Chaque champ correspond à un réglage
 * RÉELLEMENT appliqué (bandeau, maintenance, e-mail support) — aucune
 * option décorative.
 */
export function SiteSettingsForm({
  announcement,
  maintenance,
  supportEmail,
  onAnnouncement,
  onMaintenance,
  onSupportEmail,
}: {
  announcement: string;
  maintenance: boolean;
  supportEmail: string;
  onAnnouncement: (message: string) => Promise<ActionResult>;
  onMaintenance: (enabled: boolean) => Promise<ActionResult>;
  onSupportEmail: (email: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [message, setMessage] = React.useState(announcement);
  const [email, setEmail] = React.useState(supportEmail);
  const [maintenanceOn, setMaintenanceOn] = React.useState(maintenance);
  const [pending, startTransition] = React.useTransition();

  const run = (fn: () => Promise<ActionResult>) => {
    if (pending) return;
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="setting-announcement">Message d&apos;annonce global</Label>
        <p className="text-xs text-muted-foreground">
          Affiché en bandeau sur la landing page et dans l&apos;application. Vide = masqué.
        </p>
        <textarea
          id="setting-announcement"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          maxLength={300}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          placeholder="Ex. Maintenance prévue dimanche à 22 h."
        />
        <Button
          variant="outline"
          size="sm"
          disabled={pending || message === announcement}
          onClick={() => run(() => onAnnouncement(message))}
        >
          Enregistrer le message
        </Button>
      </div>

      <div className="space-y-1.5 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>Mode maintenance</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Ferme l&apos;espace client (les pages publiques et l&apos;administration restent
              accessibles).
            </p>
          </div>
          <Switch
            checked={maintenanceOn}
            onCheckedChange={(checked) => {
              setMaintenanceOn(checked);
              run(() => onMaintenance(checked));
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5 border-t border-border/60 pt-4">
        <Label htmlFor="setting-support-email">Adresse e-mail de support</Label>
        <p className="text-xs text-muted-foreground">
          Affichée sur la page Contact publique. Vide = seule la boîte configurée en serveur
          reçoit les messages.
        </p>
        <div className="flex gap-2">
          <Input
            id="setting-support-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="support@nireo.fr"
            className="max-w-72"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending || email === supportEmail}
            onClick={() => run(() => onSupportEmail(email))}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
