import { Card, CardContent } from "@/components/ui/card";
import { AuthHeader } from "@/components/auth/auth-header";
import { SignupForm } from "@/features/auth/components/signup-form";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <AuthHeader
            title="Create an account"
            subtitle="Sign up with your company invite link to start managing projects and team work."
          />
          <SignupForm />
        </CardContent>
      </Card>
    </div>
  );
}
