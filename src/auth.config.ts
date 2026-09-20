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
        token.orgId = (user as { orgId: string }).orgId;
        token.orgSlug = (user as { orgSlug: string }).orgSlug;
        token.role = (user as { role: string }).role;
        token.tokenVersion = (user as { tokenVersion: number }).tokenVersion;
        token.mustChangePassword = (
          user as { mustChangePassword: boolean }
        ).mustChangePassword;
        token.fullName = (user as { fullName: string }).fullName;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id || !token.orgId) {
        return { ...session, user: undefined as never };
      }
      session.user = {
        id: token.id as string,
        orgId: token.orgId as string,
        orgSlug: token.orgSlug as string,
        role: token.role as "Admin" | "Site Engineer",
        tokenVersion: token.tokenVersion as number,
        mustChangePassword: token.mustChangePassword as boolean,
        fullName: token.fullName as string,
        name: token.fullName as string,
        email: session.user?.email ?? null,
      };
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
