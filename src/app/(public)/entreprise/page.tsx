import { redirect } from "next/navigation";

/** Ancienne URL — la vitrine vit désormais sur /a-propos (route canonique). */
export default function EntrepriseRedirect() {
  redirect("/a-propos");
}
