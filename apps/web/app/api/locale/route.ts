import { NextResponse } from "next/server";

const ALLOWED = new Set(["fr", "ar"]);
const COOKIE_NAME = "studyforge_locale";

export async function POST(request: Request) {
  let locale: string;
  try {
    const body = await request.json();
    locale = body.locale;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!ALLOWED.has(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return response;
}
