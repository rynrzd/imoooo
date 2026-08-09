"use client";

import * as React from "react";
import { Camera, CameraOff, ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Lecture réelle d'un code-barres ou d'un QR code (boîte, étiquette
 * énergie européenne).
 *
 * Amélioration progressive, sans fausse démonstration :
 *  • caméra uniquement si le navigateur expose vraiment `BarcodeDetector` ;
 *  • sinon import d'une image, si l'API est disponible ;
 *  • sinon message clair invitant à la saisie manuelle.
 * Nireo ne prétend JAMAIS lire l'IMEI directement depuis le téléphone :
 * aucune application web n'a accès à cet identifiant.
 */

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource | ImageBitmap): Promise<DetectedBarcode[]>;
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

export function BoxScanner({
  onDetected,
  label = "Scanner",
}: {
  onDetected: (rawValue: string) => void;
  label?: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const supported = React.useMemo(() => getDetector() !== null, []);

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  React.useEffect(() => stop, [stop]);

  const start = async () => {
    const Detector = getDetector();
    if (!Detector) {
      toast.error("Votre navigateur ne sait pas lire les codes. Saisissez les informations.");
      return;
    }
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

      const detector = new Detector({
        formats: ["qr_code", "code_128", "ean_13", "data_matrix", "code_39"],
      });

      const loop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            stop();
            onDetected(value);
            toast.success("Code lu. Vérifiez les informations détectées.");
            return;
          }
        } catch {
          // Image illisible sur cette frame : on réessaie.
        }
        window.setTimeout(() => void loop(), 350);
      };
      void loop();
    } catch {
      stop();
      toast.error("Accès à la caméra refusé. Vous pouvez importer une image ou saisir à la main.");
    }
  };

  const readImage = async (file: File | null) => {
    if (!file) return;
    const Detector = getDetector();
    if (!Detector) {
      toast.error("Votre navigateur ne sait pas lire les codes. Saisissez les informations.");
      return;
    }
    setPending(true);
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await new Detector().detect(bitmap);
      const value = codes[0]?.rawValue?.trim();
      if (!value) {
        toast.error("Aucun code lisible sur cette image. Réessayez ou saisissez à la main.");
        return;
      }
      onDetected(value);
      toast.success("Code lu. Vérifiez les informations détectées.");
    } catch {
      toast.error("Image illisible. Réessayez ou saisissez les informations à la main.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      {!supported ? (
        <p className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Votre navigateur ne propose pas la lecture de codes. Saisissez les informations
          manuellement à l’étape suivante.
        </p>
      ) : null}

      {scanning ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full rounded-xl border border-border bg-black object-cover"
          />
          <Button variant="outline" size="sm" onClick={stop}>
            <CameraOff className="size-4" data-icon="inline-start" />
            Arrêter la caméra
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {supported ? (
            <Button variant="outline" onClick={start} data-touch>
              <Camera className="size-4" data-icon="inline-start" />
              {label}
            </Button>
          ) : null}

          {supported ? (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted">
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImageUp className="size-4" aria-hidden />
              )}
              Importer une image
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  void readImage(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}
