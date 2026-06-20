import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "../components/Nav";
import { AuthProvider } from "../lib/auth";

export const metadata: Metadata = {
  title: "Hotel Management System",
  description: "Daily stock and sales entry for hotel operations",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-shell">
          <Nav />
          {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
