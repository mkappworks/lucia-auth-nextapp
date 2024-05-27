import { lucia } from "@/lib/auth";
import { google } from "@/lib/auth/oauth";
import db from "@/lib/db";
import { oauthAccountTable, userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextApiRequest } from "next";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  picture: string;
  locale: string;
}

export const GET = async (req: NextApiRequest) => {
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

    const codeVerifier = cookies().get("code_verifier")?.value;
    const savedState = cookies().get("state")?.value;

    if (!codeVerifier || !savedState)
      return Response.json(
        { error: "Invalid state" },

        { status: 400 }
      );

    const { accessToken, idToken, refreshToken, accessTokenExpiresAt } =
      await google.validateAuthorizationCode(code, codeVerifier);

    const googleResponse = await fetch(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "GET",
      }
    );

    const googleData = (await googleResponse.json()) as GoogleUser;

    const { error, data } = await db.transaction(async (trx) => {
      const existingUser = await trx.query.userTable.findFirst({
        where: (user) => eq(user.email, googleData.email),
      });

      if (!existingUser) {
        const newUser = await trx
          .insert(userTable)
          .values({
            email: googleData.email,
            id: googleData.id,
            name: googleData.name,
            profilePictureUrl: googleData.picture,
          })
          .returning({ id: userTable.id });

        if (newUser.length === 0) {
          trx.rollback();
          return { error: "Failed to create user" };
        }

        const createdOAuthAccount = await trx.insert(oauthAccountTable).values({
          id: googleData.id,
          accessToken,
          expiresAt: accessTokenExpiresAt,
          provider: "google",
          providerUserId: googleData.id,
          userId: newUser[0].id,
        });
        if (createdOAuthAccount.rowCount === 0) {
          trx.rollback();
          return { error: "Failed to create user" };
        }

        return { data: { userId: newUser[0].id } };
      } else {
        const updatedOAuthAccount = await trx
          .update(oauthAccountTable)
          .set({
            accessToken,
            expiresAt: accessTokenExpiresAt,
            refreshToken,
          })
          .where(eq(oauthAccountTable.id, googleData.id));
        if (updatedOAuthAccount.rowCount === 0) {
          trx.rollback();
          return { error: "Failed to create user" };
        }

        return { data: { userId: existingUser.id } };
      }
    });

    if (error || !data) return Response.json({ error }, { status: 500 });

    const session = await lucia.createSession(data.userId, {
      expiresIn: 60 * 60 * 24 * 30,
    });

    const sessionCookie = lucia.createSessionCookie(session.id);

    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return NextResponse.redirect(
      new URL("/dashboard", process.env.NEXT_PUBLIC_BASE_URL),
      {
        status: 302,
      }
    );
  } catch (error: any) {
    return Response.json({ error }, { status: 500 });
  }
};
