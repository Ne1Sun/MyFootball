import { requireChatGPTUser } from "../chatgpt-auth";
import { getCoachData } from "../lib/coach-data";
import { CoachPortalClient } from "./coach-portal-client";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const user = await requireChatGPTUser("/coach");
  const initialData = await getCoachData(user.email, user.displayName || user.fullName || "Coach");

  return <CoachPortalClient initialData={initialData} />;
}
