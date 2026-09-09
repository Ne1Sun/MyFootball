import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import DiscoverClient from "./discover-client";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const user = await getChatGPTUser();
  
  let profile: typeof users.$inferSelect | undefined;
  if (user) {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);

    profile = existing;
    if (!profile) {
      const now = new Date().toISOString();
      await db.insert(users).values({
        email: user.email,
        fullName: user.displayName || user.fullName || "Football Fan",
        role: "fan",
        preferredState: "",
        preferredCity: "",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();

      const [created] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);
      profile = created;
    }
  }

  return (
    <DiscoverClient
      user={user}
      role={user?.role || profile?.role || "fan"}
      preferredState={profile?.preferredState || ""}
      preferredCity={profile?.preferredCity || ""}
    />
  );
}
