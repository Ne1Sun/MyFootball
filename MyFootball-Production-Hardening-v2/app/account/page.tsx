import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { requireChatGPTUser } from "../chatgpt-auth";
import ProfileSetup from "../profile-setup";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireChatGPTUser("/account");
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
