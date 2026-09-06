import Link from "next/link";
import { CircleDot, Heart, Shield } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border/80 bg-card/60 py-10 px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-amber-500 text-slate-950 flex items-center justify-center font-black">
            <CircleDot size={16} />
          </span>
          <span className="font-extrabold text-sm text-foreground">
            my<span className="text-amber-500 dark:text-amber-400">football</span> Bharat
          </span>
          <span className="text-[10px] text-muted-foreground ml-2">
            © {new Date().getFullYear()} Digital Operating System for Indian Football 🇮🇳
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 font-semibold">
          <Link href="/discover" className="hover:text-foreground transition">
            Tournaments
          </Link>
          <Link href="/organize" className="hover:text-foreground transition">
            Host Cup
          </Link>
          <Link href="/coach" className="hover:text-foreground transition">
            Coach Hub
          </Link>
          <Link href="/referee" className="hover:text-foreground transition">
            Referee Console
          </Link>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>Built with</span>
          <Heart size={13} className="text-rose-500 fill-rose-500 inline" />
          <span>for Grassroots Academies across India</span>
        </div>
      </div>
    </footer>
  );
}
