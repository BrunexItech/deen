import type { Metadata, Viewport } from "next";
import { Amiri, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const amiri = Amiri({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-amiri", display: "swap" });

export const metadata: Metadata = {
  title: { default: "DEEN · Discover. Verify. Apply. Grow.", template: "%s · DEEN" },
  description:
    "DEEN (Development and Education Empowerment Network) connects Muslims with verified scholarships, attachments, internships, jobs, grants and community opportunities.",
  applicationName: "DEEN",
};

export const viewport: Viewport = { themeColor: "#00255f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${amiri.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
