import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "holmeta",
  description: "Extension-first screen health and deep work ops console"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
