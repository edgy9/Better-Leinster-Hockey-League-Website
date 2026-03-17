import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Leinster Hockey League Lookup",
  description: "Find your Leinster Hockey competition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('lha-theme');if(t)document.documentElement.setAttribute('data-theme',t);})()`,
          }}
        />
        {/* Pre-warm the TCP+TLS connection to LHA so link clicks are instant */}
        <link rel="preconnect" href="https://www.leinsterhockey.ie" />
        <link rel="dns-prefetch" href="https://www.leinsterhockey.ie" />
      </head>
      <body className={sora.className}>{children}</body>
    </html>
  );
}
