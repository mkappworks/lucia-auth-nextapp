"use server";

import { SignUpSchema } from "@/types";
import { z } from "zod";
import * as argon2 from "argon2";
import { generateId } from "lucia";
import db from "@/lib/db";
import { emailVerificationTable, userTable } from "@/lib/db/schema";
import jwt from "jsonwebtoken";
import { sendEmail } from "@/lib/email";
import { EmailVerificationTemplate } from "@/components/auth/email-verification-temple";

type SignUpResponse = {
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