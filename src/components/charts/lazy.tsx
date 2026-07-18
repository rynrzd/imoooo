"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Graphiques chargés en import dynamique : recharts (~100 Ko gzip) sort
 * du bundle initial des pages et n'est téléchargé qu'à l'affichage.
 * Skeleton léger pendant le chargement, pas de SSR (rendu canvas/svg client).
 */

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton style={{ height }} className="w-full rounded-lg" />;
}

export const MonthlyBarChart = dynamic(
  () => import("./monthly-bar-chart").then((m) => m.MonthlyBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const NetResultChart = dynamic(
  () => import("./net-result-chart").then((m) => m.NetResultChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

export const RevenueByPropertyChart = dynamic(
  () => import("./revenue-by-property-chart").then((m) => m.RevenueByPropertyChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
