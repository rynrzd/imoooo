"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { useAvatar } from "@/lib/use-avatar";
import { cn } from "@/lib/utils";

/**
 * Bouton Profil du header — rond, avec la photo réelle ou l'initiale.
 *
 * Il remplace l'ancien duo « recherche + cloche » sur téléphone : c'est le
 * point d'entrée unique du compte, tel que la maquette le montre. La cible
 * fait 44 px ; le disque visible en fait 36, l'écart est du rembourrage.
 */
export function ProfileButton({ className }: { className?: string }) {
  const { url, initials } = useAvatar();
  const pathname = usePathname();
  const active = pathname === "/profil" || pathname.startsWith("/profil/");

  return (
    <Link
      href="/profil"
      aria-label="Profil et compte"
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-200",
        className
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center overflow-hidden rounded-full text-xs font-semibold",
          active
            ? "bg-primary text-primary-foreground ring-2 ring-primary/20"
            : "bg-secondary text-foreground ring-1 ring-border"
        )}
      >
        {url ? (
          <Image
            src={url}
            alt=""
            width={36}
            height={36}
            unoptimized
            className="size-full object-cover"
          />
        ) : initials ? (
          initials
        ) : (
          // Identité pas encore connue : silhouette neutre, jamais un « ? ».
          <UserRound className="size-4" aria-hidden />
        )}
      </span>
    </Link>
  );
}
