"use server";

import { cookies } from "next/headers";
import { generateState } from "arctic";
import { github } from "@/lib/auth/oauth";

export const createGithubAuthorizationURL = async () => {
  try {
    const state = generateState();

    cookies().set("state", state, {
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      // sameSite: "strict",
    });

    const authorizationURL = await github.createAuthorizationURL(state, {
      scopes: ["user.email"],
    });

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
