/**
 * Edge-safe Auth.js configuration.
 *
 * This file contains ONLY the provider configuration and callbacks that are
 * safe to run in the Edge Runtime (Next.js middleware). It must NOT import
 * anything that depends on Node.js APIs, Prisma, bcrypt, or file-system access.
 *
 * Auth.js v5 recommended pattern:
 *   auth.config.ts  ← edge-safe (JWT logic only) — imported by middleware
 *   auth.ts         ← Node.js only (adds Prisma adapter + bcrypt) — imported by API routes
 *
 * See: https://authjs.dev/guides/edge-compatibility
 */

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  // JWT strategy is required for CredentialsProvider
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — one working shift
  },

  pages: {
    signIn: "/login",
  },

  // providers array is intentionally empty here.
  // CredentialsProvider uses bcrypt which is Node.js-only and cannot run
  // in the edge. It is added in auth.ts which runs in the Node.js runtime.
  providers: [],

  callbacks: {
    // JWT callback is edge-safe — pure data transformation, no I/O.
    // Runs on every request going through middleware to validate the session.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },

    // Session callback is edge-safe — pure data transformation, no I/O.
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
