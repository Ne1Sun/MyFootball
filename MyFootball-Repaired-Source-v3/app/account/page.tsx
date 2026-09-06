import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { getChatGPTUser } from "../chatgpt-auth";
import ProfileSetup from "../profile-setup";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getChatGPTUser();
  if (!user) redirect("/signin-with-chatgpt?return_to=%2Faccount");
  const [profile] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);
  return (
    <ProfileSetup
      user={user}
      currentRole={profile?.role}
      preferredState={profile?.preferredState}
      preferredCity={profile?.preferredCity}
      editing
    />
  );
}
