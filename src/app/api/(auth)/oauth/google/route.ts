import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { GoogleTokens } from "arctic";
import { eq, TransactionRollbackError } from "drizzle-orm";

import { lucia } from "@/lib/auth";
import { google } from "@/lib/auth/oauth";
import db from "@/lib/db";
import { oauthAccounts, users } from "@/lib/db/schema";

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  picture: string;
  locale: string;
}

export const GET = async (req: NextRequest) => {
  try {
    if (!req.url)
      return Response.json(
        { error: "Invalid Request" },

        { status: 400 },
      );

    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state)
      return Response.json(
        { error: "Invalid Request" },

        { status: 400 },
      );

    const codeVerifier = cookies().get("code_verifier")?.value;
    const savedState = cookies().get("state")?.value;

    if (!codeVerifier || !savedState)
      return Response.json(
        { error: "Invalid state" },

        { status: 400 },
      );

    const googleTokens = await google.validateAuthorizationCode(
      code,
      codeVerifier,
    );

    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${googleTokens.accessToken}`,
        },
        method: "GET",
      },
    );

    const googleUser = (await googleResponse.json()) as GoogleUser;

    const { data } = await googleAuthDatabaseTransaction(
      googleUser,
      googleTokens,
    );

    const session = await lucia.createSession(data.userId, {
      expiresIn: 60 * 60 * 24 * 30,
    });

    const sessionCookie = lucia.createSessionCookie(session.id);

    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    cookies().set("state", "", {
      expires: new Date(0),
    });
    cookies().set("codeVerifier", "", {
      expires: new Date(0),
    });

    return NextResponse.redirect(
      new URL("/dashboard", process.env.NEXT_PUBLIC_BASE_URL),
      {
        status: 302,
      },
    );
  } catch (error: any) {
    if (error instanceof TransactionRollbackError) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }
    return Response.json({ error }, { status: 500 });
  }
};

const googleAuthDatabaseTransaction = async (
  googleUser: GoogleUser,
  googleTokens: GoogleTokens,
) => {
  return await db.transaction(async (trx) => {
    const existingUser = await trx.query.users.findFirst({
      where: (user) => eq(user.email, googleUser.email),
    });

    return !existingUser
      ? createUserAndOAuthAccount(trx, googleUser, googleTokens)
      : updateOAuthAccount(trx, googleUser, googleTokens, existingUser.id);
  });
};

const createUserAndOAuthAccount = async (
  trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  googleUser: GoogleUser,
  googleTokens: GoogleTokens,
) => {
  const newUser = await trx
    .insert(users)
    .values({
      email: googleUser.email,
      id: googleUser.id,
      name: googleUser.name,
      profilePictureUrl: googleUser.picture,
    })
    .returning({ id: users.id });

  if (newUser.length === 0) {
    await trx.rollback();
    // return { error: "Failed to create user" };
  }

  const createdOAuthAccount = await trx.insert(oauthAccounts).values({
    id: googleUser.id,
    accessToken: googleTokens.accessToken,
    expiresAt: googleTokens.accessTokenExpiresAt,
    provider: "google",
    providerUserId: googleUser.id,
    userId: newUser[0].id,
  });

  if (createdOAuthAccount.rowCount === 0) {
    await trx.rollback();
    // return { error: "Failed to create user" };
  }

  return { data: { userId: newUser[0].id } };
};

const updateOAuthAccount = async (
  trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  googleUser: GoogleUser,
  googleTokens: GoogleTokens,
  userId: string,
) => {
  const updatedOAuthAccount = await trx
    .update(oauthAccounts)
    .set({
      accessToken: googleTokens.accessToken,
      expiresAt: googleTokens.accessTokenExpiresAt,
      refreshToken: googleTokens.refreshToken,
    })
    .where(eq(oauthAccounts.id, googleUser.id));

  if (updatedOAuthAccount.rowCount === 0) {
    await trx.rollback();
    // return { error: "Failed to create user" };
  }

  return { data: { userId } };
};
