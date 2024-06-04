"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { createGithubAuthorizationURL } from "@/server/actions/auth/create-github-authorization-url.action";
import { createGoogleAuthorizationURL } from "@/server/actions/auth/create-google-authorization-url.action";
import { resendVerificationEmail } from "@/server/actions/auth/resend-verification-email.action";
import { signIn } from "@/server/actions/auth/sign-in.action";
import { SignInSchema } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useCountdown } from "usehooks-ts";
import { z } from "zod";

export function SignInForm() {
  const [showResendVerificationEmail, setShowResendVerificationEmail] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [count, { startCountdown, stopCountdown, resetCountdown }] =
    useCountdown({
      countStart: 60,
      intervalMs: 1000,
    });

  useEffect(() => {
    if (count === 0) {
      stopCountdown();
      resetCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const router = useRouter();

  const form = useForm<z.infer<typeof SignInSchema>>({
    resolver: zodResolver(SignInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof SignInSchema>) => {
    setIsLoading(true);
    const res = await signIn(values);
    if (res.errors.length > 0) {
      res.errors.forEach((error) => {
        if (error.key === "email_not_verified")
          setShowResendVerificationEmail(true);

        toast({
          variant: "destructive",
          description: error.message,
        });
      });
    } else {
      toast({
        variant: "default",
        description: "Signed in successfully",
      });

      router.push("/");
    }
    setIsLoading(false);
  };

  const onResendVerificationEmailHandler = async () => {
    const res = await resendVerificationEmail(form.getValues("email"));
    if (res.errors.length > 0) {
      res.errors.forEach((error) => {
        toast({
          variant: "destructive",
          description: error.message,
        });
      });
    } else {
      toast({
        variant: "default",
        description: "Verification email sent successfully",
      });
      startCountdown();
    }
  };

  const onGoogleSignInHandler = async () => {
    setIsLoading(true);
    const res = await createGoogleAuthorizationURL();
    if (res.errors.length > 0) {
      res.errors.forEach((error) => {
        toast({
          variant: "destructive",
          description: error.message,
        });
      });
    } else if (res.data?.url) {
      window.location.href = res.data.url;
    }
    setIsLoading(false);
  };

  const onGithubSignInHandler = async () => {
    setIsLoading(true);
    const res = await createGithubAuthorizationURL();
    if (res.errors.length > 0) {
      res.errors.forEach((error) => {
        toast({
          variant: "destructive",
          description: error.message,
        });
      });
    } else if (res.data?.url) {
      window.location.href = res.data.url;
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="w-full flex items-center justify-center">
        <Button
          disabled={isLoading}
          variant={"outline"}
          className="w-full"
          onClick={onGithubSignInHandler}
        >
          Sign in with Github
        </Button>
      </div>
      <div className="w-full flex items-center justify-center">
        <Button
          disabled={isLoading}
          variant={"outline"}
          className="w-full"
          onClick={onGoogleSignInHandler}
        >
          Sign in with Google
        </Button>
      </div>
      <div className="w-full flex items-center justify-center gap-2">
        <span className="border-b border-gray-300 w-full"></span>
        <span className="flex-none">Or sign in with your email</span>
        <span className="border-b border-gray-300 w-full"></span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    disabled={isLoading}
                    placeholder="enter your email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />{" "}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    disabled={isLoading}
                    placeholder="****"
                    type="password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
        {showResendVerificationEmail && (
          <Button
            disabled={count > 0 && count < 60}
            onClick={onResendVerificationEmailHandler}
            variant={"link"}
          >
            Send verification email {count > 0 && count < 60 && `in ${count}s`}
          </Button>
        )}
      </Form>
    </>
  );
}
