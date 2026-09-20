/**
 * Edge-safe Auth.js config (no Node-only imports).
 * Used by middleware. Full providers live in auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // filled in auth.ts (Node runtime only)
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user?.id;
      const mustChange = auth?.user?.mustChangePassword === true;

      const isAuthPage =
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/set-password");

      const isChangePassword =
        pathname.startsWith("/change-password") ||
        pathname.startsWith("/api/change-password");

      const isPublic =
        isAuthPage || pathname === "/" || pathname.startsWith("/api/auth");

      if (!isLoggedIn && !isPublic) return false;

      if (
        isLoggedIn &&
        mustChange &&
        !isChangePassword &&
        !pathname.startsWith("/api/auth")
      ) {
        return Response.redirect(new URL("/change-password", request.url));
      }

      if (isLoggedIn && isAuthPage && !mustChange) {
        const role = auth?.user?.role;
        const dest = role === "Site Engineer" ? "/my-projects" : "/dashboard";
        return Response.redirect(new URL(dest, request.url));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.orgId = user.orgId;
        token.orgSlug = user.orgSlug;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion;
        token.mustChangePassword = user.mustChangePassword;
        token.fullName = user.fullName;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id || !token.orgId) {
        return { ...session, user: undefined as never };
      }
      session.user.id = token.id;
      session.user.orgId = token.orgId;
      session.user.orgSlug = token.orgSlug;
      session.user.role = token.role;
      session.user.tokenVersion = token.tokenVersion;
      session.user.mustChangePassword = token.mustChangePassword;
      session.user.fullName = token.fullName;
      session.user.name = token.fullName;
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
