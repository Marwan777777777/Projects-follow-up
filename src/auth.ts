/**
 * Auth.js (NextAuth v5) — Credentials + JWT
 * Org-scoped identity: org code + username/email + password
 *
 * Kill-switch path: auth_session_check (SECURITY DEFINER).
 * Never query users/organizations directly from app code for revocation.
 *
 * Node-only file. Middleware uses auth.config.ts (Edge-safe).
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";

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
        full_name: string;
      }
    | undefined;
}

/** Kill-switch: SECURITY DEFINER only — never a direct owner SELECT. */
async function sessionCheck(
  userId: string,
  orgId: string,
  tokenVersion: number
) {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = neon(url);

  const rows = await sql`
    SELECT * FROM auth_session_check(
      ${userId}::uuid,
      ${orgId}::uuid,
      ${tokenVersion}::integer
    )
  `;
  return rows[0] as
    | {
        ok: boolean;
        must_change_password: boolean;
        role: string;
        org_slug: string;
        full_name: string;
      }
    | undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
        const row = await lookupUser(
          orgSlug.toLowerCase().trim(),
          identifier.trim()
        );

        if (!row) return null;
        if (row.organization_status !== "Active") return null;
        if (row.status !== "Active") return null;

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return null;

        return {
          id: row.id,
          orgId: row.org_id,
          orgSlug: orgSlug.toLowerCase().trim(),
          role: row.role as AppRole,
          tokenVersion: row.token_version,
          mustChangePassword: row.must_change_password,
          fullName: row.full_name || "User",
          name: row.full_name || "User",
          email: identifier.includes("@") ? identifier : null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
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

      if (token.id && token.orgId && typeof token.tokenVersion === "number") {
        try {
          const row = await sessionCheck(
            token.id,
            token.orgId,
            token.tokenVersion
          );

          if (!row || !row.ok) {
            return { ...token, id: "", orgId: "" } as typeof token;
          }

          token.mustChangePassword = row.must_change_password;
          token.role = row.role as AppRole;
          token.orgSlug = row.org_slug;
          if (row.full_name) token.fullName = row.full_name;
        } catch {
          return { ...token, id: "", orgId: "" } as typeof token;
        }
      }

      return token;
    },
  },
});
