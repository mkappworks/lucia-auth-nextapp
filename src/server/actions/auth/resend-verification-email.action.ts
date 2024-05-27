"use server";

import db from "@/lib/db";
import { emailVerificationTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { sendEmail } from "@/lib/email";
import { EmailVerificationTemplate } from "@/components/auth/email-verification-temple";
import { generateId } from "lucia";

export const resendVerificationEmail = async (email: string) => {
  if (!email) {
    return {
      errors: [
        {
          key: "invalid_email_password",
          message: "Invalid email or password",
        },
      ],
    };
  }

  try {
    const existingUser = await db.query.userTable.findFirst({
      where: (user) => eq(user.email, email),
    });

    if (!existingUser) {
      return {
        errors: [
          {
            key: "user_not_found",
            message: "User not found",
          },
        ],
      };
    }

    if (existingUser.isEmailVerified === true) {
      return {
        errors: [
          {
            key: "email_already_verified",
            message: "Email already verified",
          },
        ],
      };
    }

    const userId = existingUser.id;
    const code = generateId(6);

    const emailVerificationQueryResult =
      await db.query.emailVerificationTable.findFirst({
        where: eq(emailVerificationTable.userId, userId),
      });

    if (!emailVerificationQueryResult) {
      await db.insert(emailVerificationTable).values({
        id: generateId(15),
        userId,
        code,
        createdAt: new Date(),
      });
    }

    let shouldSendVerficationEmail = true;

    if (emailVerificationQueryResult?.createdAt !== undefined) {
      const currentTime = new Date();
      const createdAt = new Date(emailVerificationQueryResult.createdAt);
      shouldSendVerficationEmail =
        currentTime.getTime() - createdAt.getTime() > 55000;
    }

    if (emailVerificationQueryResult && !shouldSendVerficationEmail) {
      return {
        errors: [{ key: "rate_limited", message: "Too much request" }],
      };
    }

    if (emailVerificationQueryResult && shouldSendVerficationEmail) {
      await db
        .update(emailVerificationTable)
        .set({ code, createdAt: new Date() })
        .where(eq(emailVerificationTable.userId, userId));
    }

    const token = jwt.sign(
      { email: email, userId: userId, code },
      process.env.JWT_SECRET!,
      { expiresIn: "5m" }
    );

    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-email?token=${token}`;

    sendEmail(
      email,
      "Account Verification",
      EmailVerificationTemplate({ email: email, url: url })
    );

    return {
      errors: [],
    };
  } catch (error: any) {
    return {
      errors: [error?.message],
    };
  }
};
