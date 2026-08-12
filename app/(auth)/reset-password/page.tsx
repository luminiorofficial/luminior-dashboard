import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";
import { Card, CardContent } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { RESET_COOKIE_NAME } from "@/lib/password-reset/security";

export default async function ResetPasswordPage() {
  if (!(await cookies()).has(RESET_COOKIE_NAME)) redirect("/forgot-password");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <AuthHeader
            title="Choose a new password"
            subtitle="Use at least 8 characters. Your verified reset session expires in 10 minutes."
          />
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
