import { requireChatGPTUser } from "../chatgpt-auth";
import { getRefereeData } from "../lib/referee-data";
import { RefereeConsoleClient } from "./referee-console-client";

export const dynamic = "force-dynamic";

export default async function RefereePage() {
  const user = await requireChatGPTUser("/referee");
  const initialData = await getRefereeData(
    user.email,
    user.displayName || user.fullName || "Official Referee",
  );
  return <RefereeConsoleClient initialData={initialData} />;
}
