import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Leinster Hockey League Lookup",
  description: "Find your Leinster Hockey competition",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Register service worker for PWA install eligibility */}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');})}` }} />
        {/* Prevent theme flash on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('lha-theme');if(t)document.documentElement.setAttribute('data-theme',t);})()`,
          }}
        />
        {/* Pre-warm the TCP+TLS connection to LHA so link clicks are instant */}
        <link rel="preconnect" href="https://www.leinsterhockey.ie" />
        <link rel="dns-prefetch" href="https://www.leinsterhockey.ie" />
        {/* Umami analytics */}
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="bf88f109-2748-46ae-b823-96c94ffaa850"
        />
      </head>
      <body className={sora.className}>{children}</body>
    </html>
  );
}
