import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapWord",
  description: "OpenAI로 교재·텍스트에서 단어를 추출·정리하는 SnapWord",
  icons: {
    icon: "/favicon.png",
    apple: "/icon.png",
  },
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="apple-mobile-web-app-title" content="SnapWord" />
      </head>
      <body style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if("serviceWorker"in navigator){navigator.serviceWorker.register("/sw.js").catch(function(){})}` }} />
      </body>
    </html>
  );
}
