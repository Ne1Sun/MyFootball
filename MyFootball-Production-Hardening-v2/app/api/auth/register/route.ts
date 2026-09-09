import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { clubs, teams, users } from "../../../../db/schema";
import { hashPassword, signSession } from "../../../lib/auth-crypto";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const VALID_ROLES = ["organizer", "coach", "referee", "fan"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const rawName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const rawPassword = typeof body.password === "string" ? body.password : "";
    const rawRole = typeof body.role === "string" ? body.role.trim().toLowerCase() : "fan";
    const preferredCity = typeof body.preferredCity === "string" ? body.preferredCity.trim().slice(0, 100) : "";
    const preferredState = typeof body.preferredState === "string" ? body.preferredState.trim().slice(0, 100) : "";
    const clubName = typeof body.clubName === "string" ? body.clubName.trim().slice(0, 100) : "";

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!rawName || rawName.length < 2) {
      return NextResponse.json(
        { error: "Full name must be at least 2 characters long." },
        { status: 400 }
      );
    }

    if (!rawPassword || rawPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(rawRole as ValidRole)) {
      return NextResponse.json(
        { error: "Role must be one of: Tournament Organizer, Academy Coach, Match Referee, or Football Fan." },
        { status: 400 }
      );
    }

    const role = rawRole as ValidRole;
    const db = getDb();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(rawPassword);

    // Upsert user profile
    await db
      .insert(users)
      .values({
        email: rawEmail,
        fullName: rawName,
        role,
        passwordHash,
        preferredCity,
        preferredState,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          fullName: rawName,
          role,
          passwordHash,
          preferredCity,
          preferredState,
          updatedAt: now,
        },
      });

    // If registered as Coach, auto-provision starter academy club if none owned
    if (role === "coach") {
      const existingClubs = await db
        .select()
        .from(clubs)
        .where(eq(clubs.ownerEmail, rawEmail))
        .limit(1);

      if (existingClubs.length === 0) {
        const clubId = `club-${crypto.randomUUID().slice(0, 8)}`;
        const academyName = clubName || `${rawName}'s Football Academy`;
        await db.insert(clubs).values({
          id: clubId,
          ownerEmail: rawEmail,
          name: academyName,
          organizationType: "academy",
          city: preferredCity || "Mumbai",
          contactName: rawName,
          contactPhone: "+91 90000 00000",
          createdAt: now,
        });

        // Add default senior/youth team for the club
        await db.insert(teams).values({
          id: `team-${crypto.randomUUID().slice(0, 8)}`,
          clubId,
          name: `${academyName} Squad`,
          createdAt: now,
        });
      }
    }

    // Determine target dashboard
    const redirectUrl =
      role === "organizer"
        ? "/organize"
        : role === "coach"
        ? "/coach"
        : role === "referee"
        ? "/referee"
        : "/discover";

    const userObj = {
      email: rawEmail,
      fullName: rawName,
      displayName: rawName,
      role,
      iat: Date.now(),
    };

    const signedToken = await signSession(userObj);
    const response = NextResponse.json({
      ok: true,
      redirectUrl,
      user: {
        email: rawEmail,
        fullName: rawName,
        role,
      },
    });

    response.cookies.set("myfootball_user", signedToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    console.error("Account registration error:", error);
    return NextResponse.json(
      { error: "Could not create account. Please try again." },
      { status: 500 }
    );
  }
}
