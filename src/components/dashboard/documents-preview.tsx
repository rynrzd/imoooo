"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProperty } from "@/lib/finance";
import { formatDate } from "@/lib/format";
import { getMissingDocuments } from "@/lib/insights";
import { useAppStore } from "@/lib/store";

/** Aperçu documentaire : pièces manquantes et ajouts récents. */
export function DocumentsPreview() {
  const { data } = useAppStore();
  const missing = getMissingDocuments(data).slice(0, 3);
  const recent = [...data.documents]
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Documents</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/documents" />}>
            Bibliothèque
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              À compléter
            </p>
            <ul className="space-y-1.5">
              {missing.map((entry) => (
                <li
                  key={`${entry.property.id}-${entry.category}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate text-foreground">
                    {entry.label}
                    <span className="text-muted-foreground"> — {entry.property.name}</span>
                  </span>
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                  >
                    Manquant
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Ajoutés récemment
          </p>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun document pour le moment.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((document) => {
                const property = getProperty(data, document.propertyId);
                return (
                  <li key={document.id} className="flex items-center gap-2.5 text-sm">
                    <FileText
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {document.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {[property?.name, formatDate(document.addedAt)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
