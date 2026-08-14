import {
  ArrowRight,
  CircleDot,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import Dashboard from "./dashboard";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import ProfileSetup from "./profile-setup";
import { getDb } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import ThemeToggle from "./theme-toggle";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function AppLogo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <CircleDot size={21} strokeWidth={2.4} />
      </span>
      <span>
        my<span>football</span>
      </span>
    </div>
  );
}

export default async function Home() {
  const user = await getChatGPTUser();
  if (user) {
    const [profile] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);
    if (!profile || profile.role === "unselected")
      return <ProfileSetup user={user} />;
    if (profile.role === "fan") redirect("/discover");
    return <Dashboard user={user} />;
  }

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <AppLogo />
        <div className="auth-copy">
          <span className="eyebrow light">Built for Indian football</span>
          <h1>
            From registrations
            <br />
            to the final whistle.
          </h1>
          <p>
            A working tournament operations platform for organizers, clubs and
            academies.
          </p>
        </div>
        <div className="auth-proof">
          <span>
            <strong>
              <Trophy size={25} />
            </strong>
            <small>Create competitions</small>
          </span>
          <span>
            <strong>
              <Users size={25} />
            </strong>
            <small>Register teams</small>
          </span>
          <span>
            <strong>
              <ShieldCheck size={25} />
            </strong>
            <small>Own your data</small>
          </span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-theme">
            <ThemeToggle />
          </div>
          <span className="auth-mobile-logo">
            <AppLogo />
          </span>
          <div>
            <span className="eyebrow">Fans and organizers</span>
            <h2>Sign in to MyFootball</h2>
            <p>
              Discover tournaments near you as a fan, or operate competitions as
              an organizer.
            </p>
          </div>
          <a
            className="button primary auth-submit"
            href={chatGPTSignInPath("/")}
          >
            Continue securely <ArrowRight size={17} />
          </a>
          <div className="auth-security">
            <ShieldCheck size={15} />
            <span>Authentication and ownership checks run on the server.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
