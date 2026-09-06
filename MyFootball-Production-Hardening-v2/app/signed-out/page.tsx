import { ArrowRight, CircleDot, ShieldCheck } from "lucide-react";
import Link from "next/link";
import ThemeToggle from "../theme-toggle";

export default function SignedOutPage() {
  return (
    <main className="signed-out-screen">
      <div className="signed-out-top">
        <div className="brand">
          <span className="brand-mark">
            <CircleDot size={20} />
          </span>
          <span>
            my<span>football</span>
          </span>
        </div>
        <ThemeToggle />
      </div>
      <section className="signed-out-card">
        <span className="success-orb">
          <ShieldCheck size={30} />
        </span>
        <span className="eyebrow">Signed out successfully</span>
        <h1>See you at the next match.</h1>
        <p>
          Sign in with the same ChatGPT account to reopen its saved MyFootball
          profile, or choose another ChatGPT account to create a separate one.
        </p>
        <Link
          className="button primary"
          href="/signin-with-chatgpt?return_to=%2F"
        >
          Sign in or create account <ArrowRight size={17} />
        </Link>
      </section>
    </main>
  );
}
