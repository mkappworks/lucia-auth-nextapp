import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

interface EmailVerificationTemplate {
  email: string;
  url: string;
}

export const EmailVerificationTemplate = ({
  email,
  url,
}: EmailVerificationTemplate) => (
  <Html>
    <Head />
    <Preview>Thank you for joining us at lucia/resend</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Account Verification</Heading>
        <Text style={text}>
          Thank you {email} for joining us and for your patience. Click link
          below to verify your account {url}
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#000000",
  margin: "0 auto",
};

const container = {
  margin: "auto",
  padding: "96px 20px 64px",
};

const h1 = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "40px",
  margin: "0 0 20px",
};

const text = {
  color: "#aaaaaa",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0 0 40px",
};
