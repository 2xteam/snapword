import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapWord",
  description: "OpenAI로 교재·텍스트에서 단어를 추출·정리하는 SnapWord",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
        {children}
      </body>
    </html>
  );
}
