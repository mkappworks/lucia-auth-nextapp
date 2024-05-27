import jwt from "jsonwebtoken";
import db from "@/lib/db";
import { emailVerificationTable, userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { lucia } from "@/lib/auth";

export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const token = searchParams.get("token");
  if (!token) {
    return Response.redirect(
      new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/sign-in`),
      302
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      email: string;
      userId: string;
      code: string;
    };

    const emailVerificationQueryResult =
      await db.query.emailVerificationTable.findFirst({
        where:
          eq(emailVerificationTable.userId, decoded.userId) &&
          eq(emailVerificationTable.code, decoded.code),
      });

    if (!emailVerificationQueryResult) {
      return Response.json({ errors: ["Invalid token"] }, { status: 400 });
    }

    await db
      .delete(emailVerificationTable)
      .where(eq(emailVerificationTable.userId, decoded.userId));

    await db
      .update(userTable)
      .set({ isEmailVerified: true })
      .where(eq(userTable.id, decoded.userId));

    const session = await lucia.createSession(decoded.userId, {
      expiresIn: 60 * 60 * 24 * 30,
    });
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return Response.redirect(new URL(process.env.NEXT_PUBLIC_BASE_URL!), 302);
  } catch (e) {
    return Response.json({ errors: ["Server Error"] }, { status: 500 });
  }
};
