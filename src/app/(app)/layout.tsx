import { AppDataBoundary } from "@/components/layout/app-data-boundary";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ProductTour } from "@/components/onboarding/product-tour";
import { AppStoreProvider } from "@/lib/store";

/** Coquille de l'application : sidebar fixe, header mobile, contenu centré. */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppStoreProvider>
      <div className="min-h-svh flex-1 bg-muted/40">
        <Sidebar />
        <MobileHeader />
        <main className="lg:pl-64">
          <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <AppDataBoundary>{children}</AppDataBoundary>
          </div>
        </main>
        <OnboardingWizard />
        <ProductTour />
      </div>
    </AppStoreProvider>
  );
}
