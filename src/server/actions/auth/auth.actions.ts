"use server";

import { SignInSchema, SignUpSchema } from "@/types";
import { z } from "zod";
import * as argon2 from "argon2";
import { generateId } from "lucia";
import db from "@/lib/db";
import { emailVerificationTable, userTable } from "@/lib/db/schema";
import { lucia, validateRequest } from "@/lib/auth";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { sendEmail } from "@/lib/email";
import { EmailVerificationTemplate } from "@/components/auth/email-verification-temple";
import { generateCodeVerifier, generateState } from "arctic";
import { google } from "@/lib/auth/oauth";

type SignUpResponse = {
  errors: ErrorMessage[];
  data?: {
    userId: string;
  };
};

type SignInResponse = {
  errors: ErrorMessage[];
  data?: {
    userId: string;
  };
};

type ErrorMessage = {
  key: string;
  message: string;
};

export const signUp = async (
  values: z.infer<typeof SignUpSchema>
): Promise<SignUpResponse> => {
  const validation = SignUpSchema.safeParse({
    email: values.email,
    password: values.password,
    confirmPassword: values.confirmPassword,
  });

  if (!validation.success) {
    return {
      errors: [
        {
          key: "invalid_email_password",
          message: "Invalid email or password",
        },
      ],
    };
  }

  const hashedPassword = await argon2.hash(values.password);
  const userId = generateId(15);

  try {
    await db.insert(userTable).values({
      id: userId,
      email: values.email,
      hashedPassword,
    });

    //generate a random string for email verification
    const code = generateId(6);

    await db.insert(emailVerificationTable).values({
      id: generateId(15),
      userId,
      code,
      createdAt: new Date(),
    });

    const token = jwt.sign(
      { email: values.email, userId, code },
      process.env.JWT_SECRET!,
      { expiresIn: "5m" }
    );

    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-email?token=${token}`;

    sendEmail(
      values.email,
      "Account Verification",
      EmailVerificationTemplate({ email: values.email, url: url })
    );

    return {
      errors: [],
      data: {
        userId,
      },
    };
  } catch (error: any) {
    return {
      errors: [error?.message],
    };
  }
};

export const signIn = async (
  values: z.infer<typeof SignInSchema>
): Promise<SignInResponse> => {
  const validation = SignInSchema.safeParse({
    email: values.email,
    password: values.password,
  });

  if (!validation.success) {
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
      where: (user) => eq(user.email, values.email),
    });

    if (!existingUser || !existingUser.hashedPassword) {
      return {
        errors: [
          {
            key: "user_not_found",
            message: "User not found",
          },
        ],
      };
    }

    const isValidPassword = await argon2.verify(
      existingUser.hashedPassword,
      values.password
    );

    if (!isValidPassword) {
      return {
        errors: [
          {
            key: "invalid_email_password",
            message: "Invalid email or password",
          },
        ],
      };
    }

    if (!existingUser.isEmailVerified) {
      return {
        errors: [
          {
            key: "email_not_verified",
            message: "Email not verified",
          },
        ],
      };
    }

    const userId = existingUser.id;

    const existingSession = await db.query.sessionTable.findFirst({
      where: (session) => eq(session.userId, userId),
    });

    if (existingSession) await lucia.invalidateSession(existingSession.id);

    const session = await lucia.createSession(userId, {
      expiresIn: 60 * 60 * 24 * 30,
    });

    const sessionCookie = lucia.createSessionCookie(session.id);

    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
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

export const signOut = async () => {
  try {
    const { session } = await validateRequest();

    if (!session) {
      return {
        errors: [
          {
            key: "unauthorized_access",
            message: "Unauthorized access",
          },
        ],
      };
    }

    await lucia.invalidateSession(session.id);

    const seesionCookie = lucia.createBlankSessionCookie();

    cookies().set(
      seesionCookie.name,
      seesionCookie.value,
      seesionCookie.attributes
    );
  } catch (error: any) {
    return {
      errors: [error?.message],
    };
  }
};

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

export const createGoogleAuthorizationURL = async () => {
  try {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    cookies().set("code_verifier", codeVerifier, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      // sameSite: "strict",
    });
    cookies().set("state", state, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      // sameSite: "strict",
    });

    const authorizationURL = await google.createAuthorizationURL(
      state,
      codeVerifier,
      {
        scopes: ["email", "profile"],
      }
    );

    return {
      errors: [],
      data: { url: authorizationURL.toString() },
    };
  } catch (error: any) {
    return {
      errors: [error?.message],
    };
  }
};
