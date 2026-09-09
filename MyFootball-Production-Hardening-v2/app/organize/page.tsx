import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { users } from "../../db/schema";
import { requireChatGPTUser } from "../chatgpt-auth";
import Dashboard from "../dashboard";
import { RoleGateCard } from "../components/auth/RoleGateCard";

export const dynamic = "force-dynamic";

export default async function OrganizePage() {
  const user = await requireChatGPTUser("/organize");
  const db = getDb();
  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

  const effectiveRole = profile?.role || user.role || "fan";

  // Strict RBAC Guard: Only organizers can access the director dashboard
  if (effectiveRole !== "organizer") {
    return (
      <RoleGateCard
        requiredRole="organizer"
        currentRole={effectiveRole}
        userEmail={user.email}
        userName={user.displayName || "User"}
      />
    );
  }

  return <Dashboard user={user} />;
}
