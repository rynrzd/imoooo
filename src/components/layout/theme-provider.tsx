"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Gestion du thème clair / sombre via la classe `dark` sur <html>. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
