import { getCoachData } from "../../lib/coach-data";
import { apiError, requireApiUser } from "../../lib/server";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    return Response.json(await getCoachData(user.email, user.displayName));
  } catch (error) {
    return apiError(error);
  }
}
