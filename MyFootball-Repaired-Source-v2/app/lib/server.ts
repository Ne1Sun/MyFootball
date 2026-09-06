import { getDb } from "../../db";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import { getChatGPTUser } from "../chatgpt-auth";

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) return null;

  const db = getDb();
  await db
    .insert(users)
    .values({ email: user.email, fullName: user.displayName })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: user.displayName, updatedAt: new Date().toISOString() },
    });

  const [profile] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
  return { ...user, role: profile.role, preferredState: profile.preferredState, preferredCity: profile.preferredCity };
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return Response.json(
      { error: "The database is still being prepared. Please try again in a minute." },
      { status: 503 },
    );
  }
  console.error("MyFootball API error", error);
  return Response.json({ error: "We could not complete that request. Please try again." }, { status: 500 });
}
