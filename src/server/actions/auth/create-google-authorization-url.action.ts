"use server";

import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { google } from "@/lib/auth/oauth";

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
