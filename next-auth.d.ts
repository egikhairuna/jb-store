import { DefaultSession } from "next-auth";

/**
 * Extend NextAuth's built-in types to include our custom fields.
 * role is typed as string (not enum) because SQLite doesn't support
 * Prisma native enums. The Role union type in lib/session.ts provides
 * compile-time safety.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
