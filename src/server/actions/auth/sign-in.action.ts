"use server";

import { SignInSchema } from "@/types";
import { z } from "zod";
import * as argon2 from "argon2";
import db from "@/lib/db";
import { lucia } from "@/lib/auth";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

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
