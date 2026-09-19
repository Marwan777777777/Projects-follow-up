import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isLoggedIn = !!session?.user?.id;
  const mustChange = session?.user?.mustChangePassword === true;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/set-password");

  const isChangePassword = pathname.startsWith("/change-password");
  const isPublic =
    isAuthPage || pathname === "/" || pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isLoggedIn &&
    mustChange &&
    !isChangePassword &&
    !pathname.startsWith("/api/auth")
  ) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  if (isLoggedIn && isAuthPage && !mustChange) {
    const role = session?.user?.role;
    const dest = role === "Site Engineer" ? "/my-projects" : "/dashboard";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
