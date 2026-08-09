"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveIdentifierAction } from "@/features/nireo-id/actions/owner";
import { PUBLIC_ID_PATTERN } from "@/features/nireo-id/constants";

/**
 * Recherche d'un téléphone par identifiant Nireo.
 *
 * Le scan par caméra n'est proposé QUE si le navigateur expose réellement
 * `BarcodeDetector` : pas de bouton trompeur là où la fonction n'existe
 * pas. La saisie manuelle fonctionne partout.
 */

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

function getDetector(): BarcodeDetectorConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
  return typeof candidate === "function" ? candidate : null;
}

/** La capacité du navigateur ne change jamais : rien à souscrire. */
function subscribeNever(): () => void {
  return () => {};
}

/** Extrait un identifiant Nireo d'une URL scannée ou d'une saisie brute. */
function extractPublicId(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  const direct = value.match(PUBLIC_ID_PATTERN);
  if (direct) return direct[0];
  const inUrl = value.match(/NIR-PH-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}/);
  return inUrl ? inUrl[0] : null;
}

export function IdentifierScanner() {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [value, setValue] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);

  // Capacité du navigateur lue sans état ni effet : côté serveur la réponse
  // est « non supporté », côté client la valeur réelle — pas de décalage
  // d'hydratation, et surtout pas de bouton affiché sans fonction derrière.
  const supported = React.useSyncExternalStore(
    subscribeNever,
    () => getDetector() !== null && typeof navigator !== "undefined" && !!navigator.mediaDevices,
    () => false
  );

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  const go = React.useCallback(
    async (identifier: string) => {
      setPending(true);
      const form = new FormData();
      form.set("public_id", identifier);
      const result = await resolveIdentifierAction(form);
      setPending(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.data.href);
    },
    [router]
  );

  const startCamera = async () => {
    const Detector = getDetector();
    if (!Detector) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setScanning(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const found = codes.map((code) => extractPublicId(code.rawValue)).find(Boolean);
          if (found) {
            stopCamera();
            await go(found);
            return;
          }
        } catch {
          // Image non exploitable sur cette frame : on réessaie.
        }
        if (streamRef.current) requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch {
      stopCamera();
      toast.error("Accès à la caméra refusé ou indisponible. Saisissez l’identifiant à la main.");
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const identifier = extractPublicId(value);
    if (!identifier) {
      toast.error("Identifiant invalide. Format attendu : NIR-PH-XXXX-XXXX.");
      return;
    }
    await go(identifier);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="nid-panel space-y-4 rounded-lg p-5">
        <div className="space-y-1.5">
          <Label htmlFor="identifier">Identifiant Nireo</Label>
          <Input
            id="identifier"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="NIR-PH-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">
            Vous pouvez aussi coller l’adresse complète d’un aperçu public.
          </p>
        </div>
        <Button type="submit" data-touch disabled={pending || value.trim().length === 0}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              Recherche…
            </>
          ) : (
            <>
              <Search className="size-4" data-icon="inline-start" />
              Ouvrir le téléphone
            </>
          )}
        </Button>
      </form>

      <div className="nid-panel space-y-3 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground">Scanner un QR code</h2>
        {supported ? (
          <>
            <p className="text-sm text-muted-foreground">
              Pointez la caméra vers le QR code d’un téléphone Nireo ID.
            </p>
            <div className={scanning ? "block" : "hidden"}>
              <video
                ref={videoRef}
                muted
                playsInline
                className="aspect-video w-full rounded-xl border border-border bg-black object-cover"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {scanning ? (
                <Button variant="outline" data-touch onClick={stopCamera}>
                  <CameraOff className="size-4" data-icon="inline-start" />
                  Arrêter la caméra
                </Button>
              ) : (
                <Button variant="outline" data-touch onClick={startCamera}>
                  <Camera className="size-4" data-icon="inline-start" />
                  Activer la caméra
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Votre navigateur ne permet pas le scan de QR code depuis la page.
            Utilisez l’appareil photo de votre téléphone : il ouvrira
            directement l’aperçu public du téléphone.
          </p>
        )}
      </div>
    </div>
  );
}
