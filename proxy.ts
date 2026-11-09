import { NextResponse, type NextRequest } from "next/server";
import { passcodeToken } from "@/lib/auth";

// If APP_PASSCODE is set, everything except the login page needs the auth cookie.
export async function proxy(req: NextRequest) {
  const code = process.env.APP_PASSCODE;
  if (!code) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") return NextResponse.next();
  if (req.cookies.get("theo_auth")?.value === (await passcodeToken(code))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/|favicon|icon).*)"] };
