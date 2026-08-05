import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import { AppAuthProvider } from "@/components/app-auth-provider";
import { AuthSync } from "@/components/auth-sync";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HumanOS AI",
  description: "AI life and career copilot",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppAuthProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <AuthSync />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </AppAuthProvider>
  );
}
