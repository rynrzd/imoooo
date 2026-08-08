"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Ouvre la boîte d'impression du navigateur sur la vue imprimable réelle. */
export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <Button data-touch onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" data-icon="inline-start" />
      {label}
    </Button>
  );
}
