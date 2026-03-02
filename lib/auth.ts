/**
 * Node.js-only Auth.js configuration.
 *
 * This file adds the Prisma adapter and CredentialsProvider (which requires
 * bcrypt — a Node.js native module) on top of the edge-safe authConfig.
 *
 * MUST NOT be imported from middleware.ts or any edge route.
 * Use lib/auth.config.ts in middleware instead.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // Prisma adapter is Node.js-only — cannot run in edge runtime
  adapter: PrismaAdapter(prisma),

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.identifier as string)?.trim();
        const password = credentials?.password as string;

        if (!identifier || !password) return null;

        // Look up by email (if it contains @) or by username, then fall back to email
        const isEmail = identifier.includes("@");

        const user = await prisma.user.findFirst({
          where: isEmail
            ? { email: identifier }
            : { OR: [{ username: identifier }, { email: identifier }] },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            password: true,
            role: true,
            isActive: true,
          },
        });

        // Reject: user not found, no password, or deactivated account
        if (!user || !user.password || !user.isActive) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.username ?? user.email,
          role: user.role,
        };
      },
    }),
  ],
});
