import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCALE_COOKIE = "studyforge_locale";
const ALLOWED_LOCALES = new Set(["fr", "ar"]);

const isPublicRoute = createRouteMatcher([
  "/", "/sign-in(.*)", "/sign-up(.*)", "/pricing", "/features", "/faq", "/join(.*)",
]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Set locale cookie from Accept-Language if not already set
  const response = NextResponse.next();
  if (!request.cookies.has(LOCALE_COOKIE)) {
    const accept = request.headers.get("accept-language") ?? "";
    const preferred = accept.split(",")[0]?.split("-")[0]?.toLowerCase() ?? "fr";
    const locale = ALLOWED_LOCALES.has(preferred) ? preferred : "fr";
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
