"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordMeter } from "@/components/auth/password-meter";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function ResetPasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      setError("Password must be between 8 and 72 characters");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-reset/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      if (!response.ok) {
        setError(result?.error || "We could not update your password.");
        return;
      }

      toast.success("Password updated successfully.");
      router.replace("/sign-in?passwordReset=success");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Field label="New password">
        <PasswordInput
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <div className="mt-2">
          <PasswordMeter password={newPassword} />
        </div>
      </Field>
      <Field label="Confirm new password">
        <PasswordInput
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Updating password…" : "Reset password"}
      </Button>
    </form>
  );
}
