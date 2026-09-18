import { ResetPasswordEmail } from "@/react-email-starter/emails/reset-password";
import { WelcomeEmail } from "@/react-email-starter/emails/welcome";
import { render } from "react-email";
import { Resend } from "resend";

type EmailRecipient = {
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

function appUrlFromLink(link: string) {
  try {
    return new URL(link).origin;
  } catch {
    return appUrlFromRequest();
  }
}

function firstNameFrom(user: EmailRecipient) {
  const fromField = user.firstName?.trim();
  if (fromField) {
    return fromField;
  }

  const fromName = user.name?.trim().split(/\s+/)[0];
  return fromName || "Aggie";
}

async function sendRenderedEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn(
      `RESEND_KEY is not set; skipping email (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`,
    );
    return;
  }

  const from = process.env.EMAIL_FROM ?? "AggieTrack <noreply@aggietrack.space>";
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendWelcomeEmail(
  user: EmailRecipient,
  verificationUrl: string,
  appUrl = appUrlFromLink(verificationUrl),
) {
  const firstName = firstNameFrom(user);
  const dashboardUrl = `${appUrl}/dashboard`;
  const html = await render(
    WelcomeEmail({ firstName, dashboardUrl, verificationUrl }),
  );

  await sendRenderedEmail({
    to: user.email,
    subject: `Confirm your email, ${firstName}. Then three things to do next.`,
    html,
  });
}

export async function sendPasswordResetEmail(
  user: EmailRecipient,
  resetUrl: string,
) {
  const firstName = firstNameFrom(user);
  const html = await render(
    ResetPasswordEmail({ firstName, resetUrl }),
  );

  await sendRenderedEmail({
    to: user.email,
    subject: `Reset your AggieTrack password, ${firstName}.`,
    html,
  });
}
