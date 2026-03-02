import { requireRole } from "@/lib/session"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await requireRole(["ADMIN"])

  return NextResponse.json({
    message: "You are authorized!",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  })
}
