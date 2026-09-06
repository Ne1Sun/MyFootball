import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") || "/discover";
  const email = url.searchParams.get("email") || "demo@myfootball.in";
  const fullName = url.searchParams.get("name") || "Demo User";

  const userObj = {
    email,
    fullName,
    displayName: fullName,
  };

  const redirectUrl = new URL(returnTo.startsWith("/") ? returnTo : `/${returnTo}`, url.origin);
  const response = NextResponse.redirect(redirectUrl);
  
  response.cookies.set("myfootball_user", encodeURIComponent(JSON.stringify(userObj)), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
