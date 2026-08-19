import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import DiscoverClient from "./discover-client";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/signin-with-chatgpt?return_to=%2Fdiscover");
  
  const db = getDb();
  let [profile] = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

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

    [profile] = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);
  }

  return (
    <DiscoverClient
      user={user}
      role={profile?.role || "fan"}
      preferredState={profile?.preferredState || ""}
      preferredCity={profile?.preferredCity || ""}
    />
  );
}
