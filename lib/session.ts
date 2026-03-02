import { auth } from "@/lib/auth";

// Since SQLite doesn't support Prisma enums, Role is a plain string in the DB.
// We define the valid values here as a TypeScript union for type safety.
export type Role = "ADMIN" | "CASHIER";

export type AuthUser = {
  id: string;
  email: string | null | undefined;
  name: string | null | undefined;
  role: Role;
};

/**
 * Enforces authentication and role-based access control.
 *
 * Use at the top of:
 *   - API Route handlers (route.ts)
 *   - Server Actions ("use server" functions)
 *   - Server Components that show sensitive data
 *
 * Throws a Response with 401/403 if the check fails.
 * Next.js App Router will automatically catch and return these responses.
 *
 * @example
 * export async function POST() {
 *   const user = await requireRole(["ADMIN", "CASHIER"]);
 *   // user.id, user.role, user.email are now fully typed
 * }
 */
export async function requireRole(allowedRoles: Role[]): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userRole = session.user.role as Role;

  if (!allowedRoles.includes(userRole)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return {
    id: session.user.id as string,
    email: session.user.email,
    name: session.user.name,
    role: userRole,
  };
}

/**
 * Returns the current session user without throwing.
 * Returns null if unauthenticated.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id as string,
    email: session.user.email,
    name: session.user.name,
    role: (session.user.role as Role) ?? "CASHIER",
  };
}
