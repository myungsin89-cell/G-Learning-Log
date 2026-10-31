import Script from "next/script";
import "./globals.css";

export const metadata = {
  metadataBase: new URL('https://baeumlog.chorok.app'),
  title: '슬기록 | 슬라이드 수업의 과정을 슬기롭게',
  description: '학생의 슬라이드 작업 변화와 피드백이 필요한 순간을 한눈에 살펴보세요.',
  openGraph: {
    title: '슬기록 | 슬라이드 수업의 과정을 슬기롭게',
    description: '학생의 슬라이드 작업 변화와 피드백이 필요한 순간을 한눈에 살펴보세요.',
    siteName: '슬기록',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/share-preview.png', width: 1200, height: 630, alt: '슬기록, 슬라이드 수업의 작업 과정을 한눈에' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '슬기록 | 슬라이드 수업의 과정을 슬기롭게',
    description: '학생의 슬라이드 작업 변화와 피드백이 필요한 순간을 한눈에 살펴보세요.',
    images: ['/share-preview.png'],
  },
  icons: {
    icon: '/seulgirok-favicon.svg',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
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
