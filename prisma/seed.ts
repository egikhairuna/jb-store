/**
 * Prisma Seed Script
 * Creates initial users for the POS system.
 *
 * Run with: npx prisma db seed
 *
 * Set passwords via environment variables before seeding on a real server:
 *   SEED_ADMIN_PASSWORD=...   SEED_CASHIER_PASSWORD=...   npx prisma db seed
 *
 * Passwords are bcrypt-hashed with 12 rounds — never stored in plaintext.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

// Read passwords from environment — NEVER hardcode real passwords here.
// Set SEED_ADMIN_PASSWORD and SEED_CASHIER_PASSWORD in your .env.local (not committed).
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "CHANGE_ME_ADMIN";
const CASHIER_PASSWORD = process.env.SEED_CASHIER_PASSWORD ?? "CHANGE_ME_CASHIER";

if (ADMIN_PASSWORD === "CHANGE_ME_ADMIN" || CASHIER_PASSWORD === "CHANGE_ME_CASHIER") {
  console.warn(
    "\n⚠️  WARNING: Using placeholder passwords. Set SEED_ADMIN_PASSWORD and" +
    " SEED_CASHIER_PASSWORD environment variables before seeding in production.\n"
  );
}

const INITIAL_USERS = [
  {
    name: "Admin 1",
    username: "admin1",
    email: "admin1@jamesboogie.com",
    password: ADMIN_PASSWORD,
    role: "ADMIN" as const,
  },
  {
    name: "Admin 2",
    username: "admin2",
    email: "admin2@jamesboogie.com",
    password: ADMIN_PASSWORD,
    role: "ADMIN" as const,
  },
  {
    name: "Cashier 1",
    username: "cashier1",
    email: "cashier1@jamesboogie.com",
    password: CASHIER_PASSWORD,
    role: "CASHIER" as const,
  },
  {
    name: "Cashier 2",
    username: "cashier2",
    email: "cashier2@jamesboogie.com",
    password: CASHIER_PASSWORD,
    role: "CASHIER" as const,
  },
  {
    name: "Cashier 3",
    username: "cashier3",
    email: "cashier3@jamesboogie.com",
    password: CASHIER_PASSWORD,
    role: "CASHIER" as const,
  },
];

async function main() {
  console.log("🌱 Seeding POS database...\n");

  for (const userData of INITIAL_USERS) {
    const hashed = await bcrypt.hash(userData.password, SALT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: { username: userData.username }, // Update username if it changed
      create: {
        name: userData.name,
        username: userData.username,
        email: userData.email,
        password: hashed,
        role: userData.role,
        isActive: true,
      },
    });

    console.log(`✅ ${user.role.padEnd(7)} | ${user.email}`);
  }

  console.log("\n✅ Seed complete.");
  console.log("⚠️  IMPORTANT: Change default passwords immediately after first login!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
