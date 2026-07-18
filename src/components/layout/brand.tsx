import Link from "next/link";
import { Building2 } from "lucide-react";

/** Logo + nom du produit, utilisé dans la sidebar et le header mobile. */
export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-1">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Building2 className="size-4.5" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        ImmoPilot
      </span>
    </Link>
  );
}
