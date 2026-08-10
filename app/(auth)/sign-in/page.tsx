import { Card, CardContent } from "@/components/ui/card";
import { AuthHeader } from "@/components/auth/auth-header";
import { LoginForm } from "@/features/auth/components/login-form";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <AuthHeader
            title="Sign in"
            subtitle="Enter your work email and password to access your workspace."
          />
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
