"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@aggietrack/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState("");

  async function signOut() {
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Unable to sign out. Please try again.");
      router.replace("/sign-in");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to sign out.");
      setSigningOut(false);
    }
  }

  return <div>
    {notice && <p role="alert" className="mb-3 text-sm text-destructive">{notice}</p>}
    <Button variant="outline" disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out…" : "Sign out"}</Button>
  </div>;
}
