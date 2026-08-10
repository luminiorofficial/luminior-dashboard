import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
