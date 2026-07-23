import { redirect } from "next/navigation";
import { Megaphone, Wrench } from "lucide-react";
import { AppDataBoundary } from "@/components/layout/app-data-boundary";
import { FounderIntentRedirect } from "@/components/layout/founder-intent-redirect";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ProductTour } from "@/components/onboarding/product-tour";
import { isUserAdmin } from "@/lib/admin/auth";
import { getPublicSiteSettings } from "@/lib/admin/settings";
import { AppStoreProvider } from "@/lib/store";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Coquille de l'application : sidebar fixe, header mobile, contenu centré. */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let settings = { announcement_message: "", maintenance_mode: false };

  if (isSupabaseConfigured) {
    // Un administrateur n'est pas un client Nireo : jamais de dashboard
    // propriétaire, jamais d'onboarding, jamais de quotas — direction /admin.
    // Contrôle serveur (table admin_users lue avec la clé secrète).
    if (isAdminConfigured) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && (await isUserAdmin(user.id))) {
        redirect("/admin");
      }
    }
    settings = await getPublicSiteSettings();
  }

  // Mode maintenance (activé depuis /admin/parametres) : l'espace client
  // est fermé — les administrateurs, eux, sont déjà redirigés vers /admin.
  if (settings.maintenance_mode) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <Wrench className="size-6 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-foreground">
            Maintenance en cours
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Nireo est momentanément indisponible pour une opération de
            maintenance. Vos données sont en sécurité — revenez dans quelques
            minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppStoreProvider>
      <div className="min-h-svh flex-1 bg-muted/40">
        <Sidebar />
        <MobileHeader />
        <main className="lg:pl-64">
          <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {settings.announcement_message ? (
              <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 px-4 py-3 text-sm text-foreground ring-1 ring-primary/15">
                <Megaphone className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="leading-relaxed">{settings.announcement_message}</p>
              </div>
            ) : null}
            <AppDataBoundary>{children}</AppDataBoundary>
          </div>
        </main>
        <OnboardingWizard />
        <ProductTour />
        <FounderIntentRedirect />
      </div>
    </AppStoreProvider>
  );
}
