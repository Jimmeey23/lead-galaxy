import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Galaxy · Physique 57 India",
  description: "Lead Intelligence & Performance Analytics platform for Physique 57 India.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Sans:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* Browser extensions can inject body attributes before hydration. */}
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
