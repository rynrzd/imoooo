import { NextResponse } from "next/server";
import {
  getPartnerByToken,
  PARTNER_COOKIE,
  PARTNER_COOKIE_MAX_AGE,
} from "@/lib/marketing/partner-auth";
import { checkRateLimitShared } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /partenaire/acces?token=… — valide le jeton d'accès du partenaire,
 * pose le cookie HttpOnly (portée /partenaire) et redirige vers le tableau
 * de bord. Jeton invalide → retour à la page de connexion avec message.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") ?? "").trim();

  // Anti-force brute (best-effort par instance) : 20 essais / min / IP.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (!(await checkRateLimitShared(`partner-login:${ip}`, 20, 60_000))) {
    return NextResponse.redirect(new URL("/partenaire?erreur=limite", url.origin));
  }

  const partner = await getPartnerByToken(token);
  if (!partner) {
    return NextResponse.redirect(new URL("/partenaire?erreur=jeton", url.origin));
  }

  const response = NextResponse.redirect(new URL("/partenaire/tableau-de-bord", url.origin));
  response.cookies.set(PARTNER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/partenaire",
    maxAge: PARTNER_COOKIE_MAX_AGE,
  });
  return response;
}
