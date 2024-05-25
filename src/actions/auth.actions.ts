"use server";

import { SignInSchema, SignUpSchema } from "@/types";
import { z } from "zod";
import * as argon2 from "argon2";
import { generateId } from "lucia";
import db from "@/lib/db";
import { userTable } from "@/lib/db/schema";
import { lucia, validateRequest } from "@/lib/auth";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

type SignUpResponse = {
  errors: string[];
  data?: {
    userId: string;
  };
};

type SignInResponse = {
  errors: string[];
  data?: {
    userId: string;
  };
};

export const signUp = async (
  values: z.infer<typeof SignUpSchema>
): Promise<SignUpResponse> => {
  const validation = SignUpSchema.safeParse({
    username: values.username,
    password: values.password,
    confirmPassword: values.confirmPassword,
  });

  if (!validation.success) {
    return {
      errors: ["Invalid username and/or password"],
    };
  }

  const hashedPassword = await argon2.hash(values.password);
  const userId = generateId(15);

  try {
    await db
      .insert(userTable)
      .values({
        id: userId,
        username: values.username,
        hashedPassword,
      })
      .returning({
        id: userTable.id,
        username: userTable.username,
      });

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
    username: values.username,
    password: values.password,
  });

  if (!validation.success) {
    return {
      errors: ["Invalid username and/or password"],
    };
  }

  try {
    const existingUser = await db.query.userTable.findFirst({
      where: (user) => eq(user.username, values.username),
    });

    if (!existingUser || !existingUser.hashedPassword) {
      return {
        errors: ["User not found"],
      };
    }

    const isValidPassword = await argon2.verify(
      existingUser.hashedPassword,
      values.password
    );

    if (!isValidPassword) {
      return {
        errors: ["Invalid username or password"],
      };
    }

    const existingSession = await db.query.sessionTable.findFirst({
      where: (session) => eq(session.userId, existingUser.id),
    });

    if (existingSession) await lucia.invalidateSession(existingSession.id);

    const session = await lucia.createSession(existingUser.id, {
      expiresIn: 60 * 60 * 24 * 30,
    });

    const sessionCookie = lucia.createSessionCookie(session.id);

    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    const userId = existingUser.id;

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

export const signOut = async () => {
  try {
    const { session } = await validateRequest();

    if (!session) {
      return {
        errors: ["Unauthorized"],
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
