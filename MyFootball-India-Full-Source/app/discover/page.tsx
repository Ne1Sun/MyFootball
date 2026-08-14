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
  const [profile] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);
  if (!profile || profile.role === "unselected") redirect("/");
  return (
    <DiscoverClient
      user={user}
      role={profile.role}
      preferredState={profile.preferredState}
      preferredCity={profile.preferredCity}
    />
  );
}
