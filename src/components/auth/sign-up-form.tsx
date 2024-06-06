"use client";

import { useEffect, useState } from "react";

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
import { createGoogleAuthorizationURL } from "@/server/actions/auth/create-google-authorization-url.action";
import { resendVerificationEmail } from "@/server/actions/auth/resend-verification-email.action";
import { signUp } from "@/server/actions/auth/sign-up.action";
import { SignUpSchema } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useCountdown } from "usehooks-ts";
import { z } from "zod";

export function SignUpForm() {
  const [count, { startCountdown, stopCountdown, resetCountdown }] =
    useCountdown({
      countStart: 60,
      intervalMs: 1000,
    });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (count === 0) {
      stopCountdown();
      resetCountdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const [showResendVerificationEmail, setShowResendVerificationEmail] =
    useState(false);

  const form = useForm<z.infer<typeof SignUpSchema>>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof SignUpSchema>) {
    setIsLoading(true);
    const res = await signUp(values);
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
        description:
          "We've sent you an verification email to verify your account.",
      });
      setShowResendVerificationEmail(true);
    }
    setIsLoading(false);
  }

  const onResendVerificationEmail = async () => {
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

  const onGoogleSignUp = async () => {
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

  return (
    <>
      <>
        <div className="flex w-full items-center justify-center">
          <Button
            disabled={isLoading}
            variant={"outline"}
            className="w-full"
            onClick={onGoogleSignUp}
          >
            Sign up with Google
          </Button>
        </div>
        <div className="flex w-full items-center justify-center gap-2">
          <span className="w-full border-b border-gray-300"></span>
          <span className="flex-none">Or sign up with your email</span>
          <span className="w-full border-b border-gray-300"></span>
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
                      disabled={isLoading}
                      type="email"
                      placeholder="enter your email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input placeholder="****" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button disabled={isLoading} type="submit">
              Submit
            </Button>
          </form>
        </Form>
      </>
      {showResendVerificationEmail && (
        <Button
          disabled={(count > 0 && count < 60) || isLoading}
          onClick={onResendVerificationEmail}
          variant={"link"}
        >
          Send verification email {count > 0 && count < 60 && `in ${count}s`}
        </Button>
      )}
    </>
  );
}
