"use client";

import { useEffect } from "react";

/**
 * Landing Intelligence — MESURE DU COMPORTEMENT RÉEL.
 *
 * Un seul composant, sans état React, sans dépendance : il observe la page et
 * envoie des mesures groupées. Rien n'est bloquant, rien n'est rendu.
 *
 * Ce qui est mesuré : exposition à une combinaison de variantes, engagement,
 * profondeur de scroll, sections vues et temps passé dessus, clics (position
 * RELATIVE pour la heatmap), lecture des vidéos, intention d'inscription,
 * choix d'un abonnement, durée de visite.
 *
 * Ce qui n'est JAMAIS envoyé : contenu de formulaire, identifiant de compte,
 * position absolue, cookie tiers. L'identité du visiteur n'est même pas
 * connue du navigateur : elle vit dans un cookie HttpOnly lu par le serveur.
 */

const ENDPOINT = "/api/landing/collect";
/** Regroupement des mesures : un envoi toutes les 8 secondes au maximum. */
const FLUSH_MS = 8_000;
/** Jalons de profondeur de scroll (en %). */
const SCROLL_STEPS = [25, 50, 75, 90, 100] as const;
/** Jalons de visionnage vidéo (en %). */
const VIDEO_STEPS = [25, 50, 75, 95] as const;
/** Seuil d'engagement : 10 secondes OU 25 % de la page. */
const ENGAGE_MS = 10_000;

interface QueuedEvent {
  type: string;
  section?: string;
  element?: string;
  value?: number;
  x?: number;
  y?: number;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("nireo_l_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("nireo_l_sid", id);
    }
    return id;
  } catch {
    return "";
  }
}

export function LandingTracker() {
  useEffect(() => {
    const sessionId = getSessionId();
    const path = window.location.pathname;
    let queue: QueuedEvent[] = [];
    let closed = false;

    const push = (event: QueuedEvent) => {
      if (closed) return;
      queue.push(event);
      if (queue.length >= 30) flush(false);
    };

    const flush = (final: boolean) => {
      if (queue.length === 0) return;
      const payload = JSON.stringify({ sessionId, path, events: queue });
      queue = [];
      try {
        // `sendBeacon` survit à la fermeture de l'onglet — indispensable pour
        // la mesure du temps passé et des abandons.
        if (final && typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }));
          return;
        }
        void fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch {
        // silencieux : la mesure ne doit jamais gêner la navigation.
      }
    };

    /* ---------------- Exposition + engagement ---------------- */

    const startedAt = Date.now();
    push({ type: "exposure" });

    let engaged = false;
    const markEngaged = () => {
      if (engaged) return;
      engaged = true;
      push({ type: "engage" });
    };
    const engageTimer = window.setTimeout(markEngaged, ENGAGE_MS);

    /* ---------------- Profondeur de scroll ---------------- */

    const reachedSteps = new Set<number>();
    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const doc = document.documentElement;
        const height = Math.max(doc.scrollHeight - window.innerHeight, 1);
        const depth = Math.min(100, Math.round(((window.scrollY || 0) / height) * 100));
        for (const step of SCROLL_STEPS) {
          if (depth >= step && !reachedSteps.has(step)) {
            reachedSteps.add(step);
            push({ type: "scroll", value: step });
            if (step >= 25) markEngaged();
          }
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* ---------------- Sections vues et temps passé ---------------- */

    const seenSections = new Set<string>();
    const dwell = new Map<string, { total: number; since: number | null }>();
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-lx-section]"));

    const observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const entry of entries) {
          const key = entry.target.getAttribute("data-lx-section");
          if (!key) continue;
          const state = dwell.get(key) ?? { total: 0, since: null };
          if (entry.isIntersecting) {
            if (!seenSections.has(key)) {
              seenSections.add(key);
              push({ type: "section_view", section: key });
            }
            if (state.since === null) state.since = now;
          } else if (state.since !== null) {
            state.total += now - state.since;
            state.since = null;
          }
          dwell.set(key, state);
        }
      },
      { threshold: 0.35 }
    );
    sections.forEach((el) => observer.observe(el));

    const flushDwell = () => {
      const now = Date.now();
      for (const [key, state] of dwell) {
        const total = state.total + (state.since !== null ? now - state.since : 0);
        if (total >= 1000) push({ type: "section_dwell", section: key, value: Math.round(total / 1000) });
        dwell.set(key, { total: 0, since: state.since !== null ? now : null });
      }
    };

    /* ---------------- Clics (heatmap + éléments) ---------------- */

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const doc = document.documentElement;
      const x = event.pageX / Math.max(doc.scrollWidth, 1);
      const y = event.pageY / Math.max(doc.scrollHeight, 1);
      const tagged = target?.closest<HTMLElement>("[data-lx]") ?? null;
      const element = tagged?.getAttribute("data-lx") ?? undefined;
      const custom = tagged?.getAttribute("data-lx-event");
      const section = tagged?.closest<HTMLElement>("[data-lx-section]")?.getAttribute("data-lx-section");

      markEngaged();
      push({
        type: custom || (tagged?.hasAttribute("data-lx-cta") ? "cta_click" : "click"),
        element,
        section: section ?? undefined,
        x,
        y,
      });
      // Un clic sur un CTA doit partir immédiatement : la page va changer.
      if (custom || tagged?.hasAttribute("data-lx-cta")) flush(true);
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });

    /* ---------------- Vidéos ---------------- */

    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video[data-lx-video]"));
    const videoCleanups: (() => void)[] = [];
    for (const video of videos) {
      const reached = new Set<number>();
      const onPlay = () => {
        markEngaged();
        push({ type: "video_play", element: video.getAttribute("data-lx-video") ?? "video" });
      };
      const onTime = () => {
        if (!video.duration || !Number.isFinite(video.duration)) return;
        const pct = Math.round((video.currentTime / video.duration) * 100);
        for (const step of VIDEO_STEPS) {
          if (pct >= step && !reached.has(step)) {
            reached.add(step);
            push({ type: "video_progress", value: step, element: video.getAttribute("data-lx-video") ?? "video" });
          }
        }
      };
      video.addEventListener("play", onPlay);
      video.addEventListener("timeupdate", onTime);
      videoCleanups.push(() => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("timeupdate", onTime);
      });
    }

    /* ---------------- Envois périodiques et fin de visite ---------------- */

    const interval = window.setInterval(() => {
      flushDwell();
      flush(false);
    }, FLUSH_MS);

    const finish = () => {
      if (closed) return;
      flushDwell();
      push({ type: "exit", value: Math.round((Date.now() - startedAt) / 1000) });
      closed = true;
      flush(true);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushDwell();
        flush(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", finish);

    return () => {
      finish();
      window.clearTimeout(engageTimer);
      window.clearInterval(interval);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", finish);
      videoCleanups.forEach((fn) => fn());
      observer.disconnect();
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
    };
  }, []);

  return null;
}

/**
 * Signal ponctuel envoyé depuis une autre page du tunnel (par exemple
 * « inscription démarrée » sur /inscription). Un seul envoi par montage.
 */
export function LandingIntent({ event }: { event: "signup_started" | "plan_selected" }) {
  useEffect(() => {
    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("nireo_l_sid") ?? "";
    } catch {
      sessionId = "";
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        path: window.location.pathname,
        events: [{ type: event }],
      }),
      keepalive: true,
    }).catch(() => {});
  }, [event]);

  return null;
}
