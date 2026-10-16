import { z } from "zod";
export const personalEmailMessage = "Use a personal email address. University email addresses, including aggies.ncat.edu, cannot be used.";
export function personalEmail(email: unknown) {
  const parsed = z.email().safeParse(typeof email === "string" ? email.trim().toLowerCase() : email);
  if (!parsed.success) throw new Error("Enter a valid personal email address.");
  const domain = parsed.data.split("@")[1];
  if (domain === "edu" || domain.endsWith(".edu") || domain.includes(".edu.")) throw new Error(personalEmailMessage);
  return parsed.data;
}
