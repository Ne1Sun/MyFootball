import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { clubs, tournaments, users } from "../../db/schema";
import { signSession } from "../chatgpt-auth";
import { hashPassword } from "../lib/auth-crypto";

const MASTER_TEST_PASSWORD = process.env.MASTER_TEST_PASSWORD || "Grassroots@2026";

interface PersonaConfig {
  email: string;
  name: string;
  role: "organizer" | "coach" | "referee" | "fan";
  defaultPath: string;
}

const PRECONFIGURED_PERSONAS: Record<string, PersonaConfig> = {
  "organizer@myfootball.in": {
    email: "organizer@myfootball.in",
    name: "Vikramaditya Singhania",
    role: "organizer",
    defaultPath: "/organize",
  },
  "coach@myfootball.in": {
    email: "coach@myfootball.in",
    name: "Coach Subrata Paul",
    role: "coach",
    defaultPath: "/coach",
  },
  "referee@myfootball.in": {
    email: "referee@myfootball.in",
    name: "Michael Murmu (AIFF)",
    role: "referee",
    defaultPath: "/referee",
  },
  "fan@myfootball.in": {
    email: "fan@myfootball.in",
    name: "Aarav Sharma",
    role: "fan",
    defaultPath: "/discover",
  },
  "demo@myfootball.in": {
    email: "demo@myfootball.in",
    name: "Demo Organizer",
    role: "organizer",
    defaultPath: "/organize",
  },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawEmail = (url.searchParams.get("email") || "").trim().toLowerCase();
  const rawRole = (url.searchParams.get("role") || "").trim().toLowerCase();
  const rawName = (url.searchParams.get("name") || "").trim();
  const requestedReturnTo = url.searchParams.get("return_to");

  // Check if known persona
  const persona = PRECONFIGURED_PERSONAS[rawEmail];

  const email = persona ? persona.email : (rawEmail || "fan@myfootball.in");
  const role = (["organizer", "coach", "referee", "fan"].includes(rawRole)
    ? rawRole
    : persona?.role || "fan") as "organizer" | "coach" | "referee" | "fan";

  const fullName = rawName || persona?.name || (email.split("@")[0] || "User");
  
  // Determine redirect target
  let returnTo = requestedReturnTo;
  if (!returnTo || returnTo === "/" || returnTo === "/login") {
    returnTo = persona?.defaultPath || (
      role === "organizer" ? "/organize" :
      role === "coach" ? "/coach" :
      role === "referee" ? "/referee" :
      "/discover"
    );
  }

  // Ensure database sync
  try {
    const db = getDb();
    const now = new Date().toISOString();
    const defaultHash = await hashPassword(MASTER_TEST_PASSWORD);

    await db
      .insert(users)
      .values({
        email,
        fullName,
        role,
        passwordHash: defaultHash,
        preferredState: "Maharashtra",
        preferredCity: "Mumbai",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          fullName,
          role,
          updatedAt: now,
        },
      });

    // Map tournament ownership for organizer
    if (role === "organizer" || email === "organizer@myfootball.in") {
      try {
        await db
          .update(tournaments)
          .set({ organizerEmail: email, updatedAt: now })
          .where(eq(tournaments.id, "tourney-mumbai-super-cup-2026"));
      } catch {
        // Table or record might not exist yet
      }
    }

    // Map club ownership for coach
    if (role === "coach" || email === "coach@myfootball.in") {
      try {
        await db
          .update(clubs)
          .set({ ownerEmail: email })
          .where(eq(clubs.id, "club-rfyc"));
      } catch {
        // Table or record might not exist yet
      }
    }
  } catch (err) {
    console.warn("User sync in signin-with-chatgpt warning:", err);
  }

  const userObj = {
    email,
    fullName,
    displayName: fullName,
    role,
    iat: Date.now(),
  };

  const signedToken = await signSession(userObj);
  const redirectUrl = new URL(returnTo.startsWith("/") ? returnTo : `/${returnTo}`, url.origin);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("myfootball_user", signedToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
