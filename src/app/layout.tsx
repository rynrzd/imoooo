import type { Metadata } from "next";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL } from "@/lib/supabase/config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nireo — Pilotez votre patrimoine locatif",
    template: "%s · Nireo",
  },
  description:
    "Nireo centralise la gestion de vos biens locatifs : loyers, locataires, documents, travaux et statistiques.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
