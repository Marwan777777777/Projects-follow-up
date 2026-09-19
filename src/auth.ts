/**
 * Auth.js (NextAuth v5) — Credentials + JWT
 * Org-scoped identity: org code + username/email + password
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  orgSlug: z.string().min(1),
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export type AppRole = "Admin" | "Site Engineer";

declare module "next-auth" {
  interface User {
    orgId: string;
    orgSlug: string;
    role: AppRole;
    tokenVersion: number;
    mustChangePassword: boolean;
    fullName: string;
  }
  interface Session {
    user: {
      id: string;
      orgId: string;
      orgSlug: string;
      role: AppRole;
      tokenVersion: number;
      mustChangePassword: boolean;
      fullName: string;
      email?: string | null;
      name?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    orgId: string;
    orgSlug: string;
    role: AppRole;
    tokenVersion: number;
    mustChangePassword: boolean;
    fullName: string;
  }
}

async function lookupUser(orgSlug: string, identifier: string) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = neon(url);

  const rows = await sql`
    SELECT * FROM auth_lookup_user(${orgSlug}, ${identifier})
  `;
  return rows[0] as
    | {
        id: string;
        org_id: string;
        password_hash: string;
        status: string;
        role: string;
        must_change_password: boolean;
        token_version: number;
        organization_status: string;
      }
    | undefined;
}

async function getUserFullName(userId: string, orgId: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return "User";
  const sql = neon(url);
  await sql`SELECT set_config('app.current_org_id', ${orgId}, true)`;
  const rows = await sql`SELECT full_name FROM users WHERE id = ${userId} LIMIT 1`;
  return (rows[0]?.full_name as string) || "User";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        orgSlug: { label: "Organization", type: "text" },
        identifier: { label: "Username or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { orgSlug, identifier, password } = parsed.data;
        const row = await lookupUser(orgSlug.toLowerCase().trim(), identifier.trim());

        if (!row) return null;
        if (row.organization_status !== "Active") return null;
        if (row.status !== "Active") return null;

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return null;

        const fullName = await getUserFullName(row.id, row.org_id);

        return {
          id: row.id,
          orgId: row.org_id,
          orgSlug: orgSlug.toLowerCase().trim(),
          role: row.role as AppRole,
          tokenVersion: row.token_version,
          mustChangePassword: row.must_change_password,
          fullName,
          name: fullName,
          email: identifier.includes("@") ? identifier : null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
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

      if (token.id && token.orgId) {
        try {
          const url = process.env.DATABASE_URL;
          if (url) {
            const sql = neon(url);
            const rows = await sql`
              SELECT u.status AS user_status, u.token_version, u.must_change_password,
                     u.role, o.status AS org_status, o.slug
              FROM users u
              JOIN organizations o ON o.id = u.org_id
              WHERE u.id = ${token.id} AND u.org_id = ${token.orgId}
              LIMIT 1
            `;
            const row = rows[0] as
              | {
                  user_status: string;
                  token_version: number;
                  must_change_password: boolean;
                  role: string;
                  org_status: string;
                  slug: string;
                }
              | undefined;

            if (
              !row ||
              row.user_status !== "Active" ||
              row.org_status !== "Active" ||
              row.token_version !== token.tokenVersion
            ) {
              return { ...token, id: "", orgId: "" } as typeof token;
            }

            token.mustChangePassword = row.must_change_password;
            token.role = row.role as AppRole;
            token.orgSlug = row.slug;
          }
        } catch {
          // keep token on transient DB errors
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token.id || !token.orgId) {
        return { ...session, user: undefined as never };
      }
      session.user = {
        id: token.id,
        orgId: token.orgId,
        orgSlug: token.orgSlug,
        role: token.role,
        tokenVersion: token.tokenVersion,
        mustChangePassword: token.mustChangePassword,
        fullName: token.fullName,
        name: token.fullName,
        email: session.user?.email ?? null,
      };
      return session;
    },
  },
  trustHost: true,
});
