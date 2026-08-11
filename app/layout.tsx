import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "SOPCare — Sports Health Intelligence",
    description: "One athlete. One care team. One clear plan.",
    openGraph: {
      title: "SOPCare — Sports Health Intelligence",
      description: "One athlete. One care team. One clear plan.",
      type: "website",
      images: [{ url: `${origin}/og-medical-file.png`, width: 1732, height: 910, alt: "SOPCare unified multidisciplinary medical file timeline" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "SOPCare — Sports Health Intelligence",
      description: "One athlete. One care team. One clear plan.",
      images: [`${origin}/og-medical-file.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
