import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { requireChatGPTUser } from "../chatgpt-auth";
import Dashboard from "../dashboard";

export const dynamic = "force-dynamic";

export default async function OrganizePage() {
  const user = await requireChatGPTUser("/organize");
  const [profile] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);
  if (!profile || profile.role === "unselected") redirect("/");
  return <Dashboard user={user} />;
}
