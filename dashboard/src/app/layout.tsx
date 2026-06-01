import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "VI Portfolio Dashboard",
  description: "Venture Investment Portfolio Intelligence Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full flex bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100">
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto min-h-screen">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
