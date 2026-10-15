import Script from "next/script";
import "./globals.css";

export const metadata = {
  metadataBase: new URL('https://baeumlog.chorok.app'),
  title: 'G배움로그 | Google 슬라이드 수업의 작업 기록',
  description: '학생별 작업 변화와 피드백이 필요한 학생을 한눈에 살펴보세요.',
  openGraph: {
    title: 'G배움로그 | Google 슬라이드 수업의 작업 기록',
    description: '학생별 작업 변화와 피드백이 필요한 학생을 한눈에 살펴보세요.',
    siteName: 'G배움로그',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/share-preview.png', width: 1200, height: 630, alt: 'G배움로그, Google 슬라이드 수업의 작업 기록을 한눈에' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'G배움로그 | Google 슬라이드 수업의 작업 기록',
    description: '학생별 작업 변화와 피드백이 필요한 학생을 한눈에 살펴보세요.',
    images: ['/share-preview.png'],
  },
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
