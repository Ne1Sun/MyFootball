import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
  role?: string;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/login";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

import { signSession, verifySession } from "./lib/auth-crypto";
export { signSession, verifySession };

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (email) {
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName =
      encodedFullName &&
      requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
        ? safeDecodeURIComponent(encodedFullName)
        : null;

    return {
      displayName: fullName ?? email,
      email,
      fullName,
      role: "fan",
    };
  }

  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("myfootball_user")?.value;
    if (userCookie) {
      // Strictly verify signed HMAC session
      const verified = await verifySession<{
        email: string;
        fullName?: string | null;
        displayName?: string;
        role?: string;
      }>(userCookie);
      if (verified && verified.email) {
        return {
          displayName: verified.displayName || verified.fullName || verified.email,
          email: verified.email,
          fullName: verified.fullName || null,
          role: verified.role || "fan",
        };
      }
    }
  } catch {
    // Ignore cookie resolution error
  }

  return null;
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
