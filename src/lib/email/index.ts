import { Resend } from "resend";

const resend = new Resend("re_LVp9gPiv_5inwByZp37V8JvAUdbv4dBGo");

export const sendEmail = async (
  to: string,
  subject: string,
  react: JSX.Element,
) => {
  resend.emails.send({
    from: "onboarding@resend.dev",
    to: to,
    subject: subject,
    react: react,
  });
};
