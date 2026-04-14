import prisma from "@/lib/db"

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remainingMs?: number }> {
  const windowStart = new Date(Date.now() - WINDOW_MS)

  const attempts = await prisma.loginAttempt.count({
    where: {
      identifier,
      createdAt: { gte: windowStart },
    },
  })

  if (attempts >= MAX_ATTEMPTS) {
    const oldest = await prisma.loginAttempt.findFirst({
      where: { identifier, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
    })
    const remainingMs = oldest
      ? WINDOW_MS - (Date.now() - oldest.createdAt.getTime())
      : WINDOW_MS
    return { allowed: false, remainingMs }
  }

  return { allowed: true }
}

export async function recordLoginAttempt(identifier: string, success: boolean) {
  await prisma.loginAttempt.create({
    data: { identifier, success },
  })

  if (success) {
    // Clear failed attempts on success so the window resets
    await prisma.loginAttempt.deleteMany({
      where: { identifier, success: false },
    })
  }
}
