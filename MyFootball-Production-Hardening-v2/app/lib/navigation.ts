import {
  CircleDot,
  Clock,
  Compass,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  id: string;
  icon: LucideIcon;
}

/**
 * Resolves the operational home route for a given user role.
 * - Unauthenticated / New guests -> "/"
 * - Coach & Fan -> "/discover"
 * - Referee -> "/referee"
 * - Organizer -> "/organize"
 */
export function getRoleHomePath(role?: string | null): string {
  if (!role) return "/";
  switch (role.toLowerCase()) {
    case "organizer":
      return "/organize";
    case "referee":
      return "/referee";
    case "coach":
    case "fan":
    default:
      return "/discover";
  }
}

/**
 * Returns the primary navigation tabs for the user session.
 * - Unauthenticated: ["Home" (/), "Discover" (/discover)]
 * - Coach: ["Discover" (/discover), "Coach Hub" (/coach)]
 * - Referee: ["Referee Console" (/referee), "Discover" (/discover)]
 * - Organizer: ["Organizer Hub" (/organize), "Discover" (/discover)]
 * - Fan: ["Discover" (/discover)]
 * Note: Authenticated sessions strictly omit the public "Home" (/) tab.
 */
export function getNavItems(user?: { role?: string } | null): NavItem[] {
  if (!user) {
    return [
      { href: "/", label: "Home", id: "home", icon: CircleDot },
      { href: "/discover", label: "Discover", id: "discover", icon: Compass },
    ];
  }

  const role = user.role?.toLowerCase() || "fan";

  switch (role) {
    case "coach":
      return [
        { href: "/discover", label: "Discover", id: "discover", icon: Compass },
        { href: "/coach", label: "Coach Hub", id: "coach", icon: ShieldCheck },
      ];

    case "referee":
      return [
        { href: "/referee", label: "Referee Console", id: "referee", icon: Clock },
        { href: "/discover", label: "Discover", id: "discover", icon: Compass },
      ];

    case "organizer":
      return [
        { href: "/organize", label: "Organizer Hub", id: "organize", icon: Trophy },
        { href: "/discover", label: "Discover", id: "discover", icon: Compass },
      ];

    case "fan":
    default:
      return [
        { href: "/discover", label: "Discover", id: "discover", icon: Compass },
      ];
  }
}
