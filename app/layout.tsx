import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./globals.css";
import "./operations.css";

export const metadata: Metadata = {
  title: "FieldOps Command — Incident response prototype",
  description:
    "An interactive physical-security workspace for reviewing field reports and coordinating incident response.",
  openGraph: {
    title: "FieldOps Command",
    description:
      "Review a field report, inspect its evidence, and coordinate a response.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101815",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NODE_ENV === "production" ? (
          <Script
            id="cloudflare-web-analytics"
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({
              token: "a90ef09df54e4b36af42c8d6cbf8c96c",
            })}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
