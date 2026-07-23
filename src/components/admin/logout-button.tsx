"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Déconnexion administrateur (route serveur : session détruite + audit). */
export function AdminLogoutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const logout = async () => {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      router.replace("/admin/login");
      router.refresh();
    } catch {
      toast.error("Déconnexion impossible. Réessayez.");
      setPending(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={logout} disabled={pending} className="w-full justify-start gap-2.5 px-2.5 text-muted-foreground">
      <LogOut className="size-4" />
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  );
}
