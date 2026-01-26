import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { VerifierProvider } from "@/providers/VerifierProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlayKami Verifier",
  description: "Independently verify the fairness of your pack openings on Monad blockchain",
};

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
        <VerifierProvider>
          {children}
        </VerifierProvider>
      </body>
    </html>
  );
}
