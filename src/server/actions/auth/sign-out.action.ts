"use server";

import { cookies } from "next/headers";

import { lucia, validateRequest } from "@/lib/auth";

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
      seesionCookie.attributes,
    );
  } catch (error: any) {
    return {
      errors: [error?.message],
    };
  }
};
