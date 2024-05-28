import { lucia } from "@/lib/auth";
import { github } from "@/lib/auth/oauth";
import db from "@/lib/db";
import { oauthAccountTable, userTable } from "@/lib/db/schema";
import { TransactionRollbackError, eq } from "drizzle-orm";
import { generateId } from "lucia";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const GET = async (req: NextRequest) => {
  try {
    if (!req.url)
      return Response.json(
        { error: "Invalid Request" },

        { status: 400 }
      );

    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state)
      return Response.json(
        { error: "Invalid Request" },

        { status: 400 }
      );

    const savedState = cookies().get("state")?.value;

    if (!savedState)
      return Response.json(
        { error: "Invalid state" },

        { status: 400 }
      );

    const { accessToken } = await github.validateAuthorizationCode(code);

    const githubResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
    });

    const githubUser = (await githubResponse.json()) as any;

    const { data } = await githubAuthDatabaseTransaction(
      githubUser,
      accessToken
    );

    const session = await lucia.createSession(data.userId, {
      expiresIn: 60 * 60 * 24 * 30,
    });

    const sessionCookie = lucia.createSessionCookie(session.id);

    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    cookies().set("state", "", {
      expires: new Date(0),
    });

    return NextResponse.redirect(
      new URL("/dashboard", process.env.NEXT_PUBLIC_BASE_URL),
      {
        status: 302,
      }
    );
  } catch (error: any) {
    if (error instanceof TransactionRollbackError) {
      return Response.json({ error: "Server error" }, { status: 500 });
    }
    return Response.json({ error }, { status: 500 });
  }
};

const githubAuthDatabaseTransaction = async (
  githubUser: any,
  accessToken: string
) => {
  return await db.transaction(async (trx) => {
    const existingUser = await trx.query.userTable.findFirst({
      where: (user) => eq(user.id, githubUser.id),
    });

    return !existingUser
      ? createUserAndOAuthAccount(trx, githubUser, accessToken)
      : updateOAuthAccount(trx, githubUser, accessToken, existingUser.id);
  });
};

const createUserAndOAuthAccount = async (
  trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  githubUser: any,
  accessToken: string
) => {
  const newUser = await trx
    .insert(userTable)
    .values({
      id: githubUser.id,
      name: githubUser.name,
      profilePictureUrl: githubUser.avatar_url,
    })
    .returning({ id: userTable.id });

  if (newUser.length === 0) {
    await trx.rollback();
    // return { error: "Failed to create user" };
  }

  const createdOAuthAccount = await trx.insert(oauthAccountTable).values({
    id: generateId(15),
    accessToken,
    expiresAt: new Date(),
    provider: "github",
    providerUserId: githubUser.id,
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
  githubUser: any,
  accessToken: string,
  userId: string
) => {
  const updatedOAuthAccount = await trx
    .update(oauthAccountTable)
    .set({
      accessToken,
    })
    .where(eq(oauthAccountTable.providerUserId, githubUser.id));

  if (updatedOAuthAccount.rowCount === 0) {
    await trx.rollback();
    // return { error: "Failed to create user" };
  }

  return { data: { userId } };
};
