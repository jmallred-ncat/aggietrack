import { WelcomeEmail } from "@/react-email-starter/emails/welcome";
import { render } from "react-email";
import { Resend } from "resend";

type WelcomeRecipient = {
  email: string;
  firstName?: string | null;
  name?: string | null;
};

function getResend() {
  const apiKey = process.env.RESEND_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

export function appUrlFromRequest(request?: Request) {
  const origin = request?.headers.get("origin");
  if (origin) {
    return origin.replace(/\/$/, "");
  }

  if (request) {
    try {
      return new URL(request.url).origin;
    } catch {
      // Fall through to the configured app URL.
    }
  }

  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function appUrlFromVerificationUrl(verificationUrl: string) {
  try {
    return new URL(verificationUrl).origin;
  } catch {
    return appUrlFromRequest();
  }
}

function firstNameFrom(user: WelcomeRecipient) {
  const fromField = user.firstName?.trim();
  if (fromField) {
    return fromField;
  }

  const fromName = user.name?.trim().split(/\s+/)[0];
  return fromName || "Aggie";
}

export async function sendWelcomeEmail(
  user: WelcomeRecipient,
  verificationUrl: string,
  appUrl = appUrlFromVerificationUrl(verificationUrl),
) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_KEY is not set; skipping welcome email");
    return;
  }

  const firstName = firstNameFrom(user);
  const from = process.env.EMAIL_FROM ?? "AggieTrack <noreply@aggietrack.space>";
  const dashboardUrl = `${appUrl}/dashboard`;
  const html = await render(
    WelcomeEmail({ firstName, dashboardUrl, verificationUrl }),
  );

  const { error } = await resend.emails.send({
    from,
    to: user.email,
    subject: `Confirm your email, ${firstName}. Then three things to do next.`,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}
