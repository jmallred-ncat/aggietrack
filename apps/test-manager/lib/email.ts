import { render } from "react-email";
import { Resend } from "resend";
import { MagicLinkEmail } from "../emails/magic-link";
import { personalEmail } from "./email-policy";
export async function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  const to = personalEmail(email);
  const key = process.env.TEST_MANAGER_RESEND_KEY;
  const from = process.env.TEST_MANAGER_EMAIL_FROM;
  if (!key || !from) throw new Error("Magic-link email delivery is not configured.");
  const html = await render(MagicLinkEmail({ url }));
  const text = await render(MagicLinkEmail({ url }), { plainText: true });
  const { error } = await new Resend(key).emails.send({ from, to, subject: "Sign in to AggieTrack Test Manager", html, text });
  if (error) throw new Error("Unable to deliver the sign-in email. Please try again later.");
}
