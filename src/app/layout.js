import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "G배움로그 - 실시간 구글 학습 과정평가 대시보드",
  description: "Google 슬라이드 수업의 학생 작업 기록, 교사 피드백과 비공개 메모를 살펴보는 도구",
  icons: {
    icon: '/g-learning-log-line.svg',
    shortcut: '/g-learning-log-line.svg',
    apple: '/g-learning-log-line.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="main-content">
        {children}
        {/* Google API Client Library */}
        <Script src="https://apis.google.com/js/api.js" strategy="beforeInteractive" />
        {/* Google Identity Services */}
        <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
