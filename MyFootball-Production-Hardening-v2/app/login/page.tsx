import { getChatGPTUser } from "../chatgpt-auth";
import LoginClient from "./login-client";

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{
    return_to?: string;
    registered?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getChatGPTUser();
  const params = await searchParams;
  const returnTo = params.return_to || "";

  return (
    <LoginClient
      currentUser={user}
      returnTo={returnTo}
    />
  );
}
