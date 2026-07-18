/**
 * Template re-monté à chaque navigation : anime discrètement
 * l'arrivée de chaque page (fondu + léger glissement).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in space-y-6">{children}</div>;
}
