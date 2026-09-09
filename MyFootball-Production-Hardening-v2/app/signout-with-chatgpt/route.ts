import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") || "/login";

  const redirectUrl = new URL(returnTo.startsWith("/") ? returnTo : `/${returnTo}`, url.origin);
  const response = NextResponse.redirect(redirectUrl);
  
  response.cookies.delete("myfootball_user");

  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
