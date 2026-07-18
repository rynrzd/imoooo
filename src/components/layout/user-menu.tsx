"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface SessionInfo {
  name: string;
  email: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "IP";
}

/**
 * Bloc utilisateur de la sidebar.
 * Mode démo sans Supabase ; sinon, session réelle + déconnexion.
 */
export function UserMenu() {
  const router = useRouter();
  const [session, setSession] = React.useState<SessionInfo | null>(null);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    // getSession lit la session locale (aucune requête réseau),
    // le jeton est déjà validé par le proxy à chaque navigation.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      const user = s?.user;
      if (user) {
        setSession({
          name:
            (user.user_metadata?.full_name as string | undefined) ??
            user.email ??
            "Mon compte",
          email: user.email ?? "",
        });
      }
    });
  }, []);

  // En mode réel, jamais de fausse identité : « Mon compte » le temps que la
  // session se charge. Le nom fictif est réservé au mode démo explicite.
  const display: SessionInfo = session ?? {
    name: isSupabaseConfigured ? "Mon compte" : "Rayan Bailleur",
    email: isSupabaseConfigured ? "" : "Mode démo",
  };

  const handleLogout = async () => {
    if (!isSupabaseConfigured) {
      toast.info("Mode démo : configurez Supabase pour activer les comptes.");
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/connexion");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
        aria-label="Menu du compte"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {initialsOf(display.name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {display.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {display.email}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
        <DropdownMenuItem render={<Link href="/parametres" />}>
          <Settings />
          Paramètres
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
