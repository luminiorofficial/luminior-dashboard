import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

const sans = Inter({
  variable: "--font-luminior-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luminior Dashboard",
  description: "Luminior CRM — projects, tasks, attendance and leave in one operations workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
