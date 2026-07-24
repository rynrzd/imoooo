import { NextResponse } from "next/server";
import { PARTNER_COOKIE } from "@/lib/marketing/partner-auth";

export const runtime = "nodejs";

/** GET /partenaire/deconnexion — efface le cookie d'accès et revient au login. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/partenaire", url.origin));
  response.cookies.set(PARTNER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/partenaire",
    maxAge: 0,
  });
  return response;
}
