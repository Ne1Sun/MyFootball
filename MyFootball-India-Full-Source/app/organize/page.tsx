import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { requireChatGPTUser } from "../chatgpt-auth";
import Dashboard from "../dashboard";

export const dynamic = "force-dynamic";

export default async function OrganizePage() {
  const user = await requireChatGPTUser("/organize");
  const db = getDb();
  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

  if (!profile) {
    const now = new Date().toISOString();
    await db.insert(users).values({
      email: user.email,
      fullName: user.displayName || user.fullName || "Tournament Organizer",
      role: "organizer",
      preferredState: "",
      preferredCity: "",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }

  return <Dashboard user={user} />;
}
