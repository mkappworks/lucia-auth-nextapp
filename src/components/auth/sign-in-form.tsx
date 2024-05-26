"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { SignInSchema } from "@/types";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { resendVerificationEmail, signIn } from "@/actions/auth.actions";
import { useEffect, useState } from "react";

import { useCountdown } from "usehooks-ts";

export function SignInForm() {
  const [showResendVerificationEmail, setShowResendVerificationEmail] =
    useState(false);
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

  async function onSubmit(values: z.infer<typeof SignInSchema>) {
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="enter your email" {...field} />
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
                <Input placeholder="****" type="password" {...field} />
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
          onClick={onResendVerificationEmail}
          variant={"link"}
        >
          Send verification email {count > 0 && count < 60 && `in ${count}s`}
        </Button>
      )}
    </Form>
  );
}
