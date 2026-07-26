"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Beacon analytics first-party (RGPD, cookieless).
 *
 * Envoie une « page vue » au serveur à chaque navigation + un battement de
 * cœur pendant que l'onglet est visible (présence temps réel). Aucun cookie :
 * l'identifiant de session est éphémère (sessionStorage, effacé à la fermeture
 * de l'onglet). La source d'acquisition (referrer / utm) est figée au 1er
 * chargement puis réutilisée pour toute la session. Le serveur ne stocke
 * jamais l'IP en clair (hash non réversible) ni aucune donnée personnelle.
 * L'espace /admin n'est jamais suivi.
 */
const HEARTBEAT_MS = 60_000;

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("nireo_a_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("nireo_a_sid", id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Referrer + utm figés au 1er chargement (source de la session). */
function getAcquisition(): { referrer: string; utmSource: string } {
  try {
    let referrer = sessionStorage.getItem("nireo_a_ref");
    let utmSource = sessionStorage.getItem("nireo_a_utm");
    if (referrer === null) {
      referrer = document.referrer || "";
      sessionStorage.setItem("nireo_a_ref", referrer);
    }
    if (utmSource === null) {
      utmSource = new URLSearchParams(window.location.search).get("utm_source") || "";
      sessionStorage.setItem("nireo_a_utm", utmSource);
    }
    return { referrer, utmSource };
  } catch {
    return { referrer: "", utmSource: "" };
  }
}

export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    const send = () => {
      if (document.visibilityState === "hidden") return;
      const { referrer, utmSource } = getAcquisition();
      const payload = JSON.stringify({ path: pathname, referrer, utmSource, sessionId: getSessionId() });
      try {
        void fetch("/api/analytics/collect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch {
        // silencieux : l'analytics ne doit jamais gêner la navigation.
      }
    };

    send();
    const interval = window.setInterval(send, HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [pathname]);

  return null;
}
