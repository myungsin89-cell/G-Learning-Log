export const metadata = {
  title: 'G배움로그 | 학생 슬라이드 접속',
  description: '선생님이 공유한 수업 슬라이드를 열어 작업하고 댓글을 남겨보세요.',
  openGraph: {
    title: 'G배움로그 | 학생 슬라이드 접속',
    description: '선생님이 공유한 수업 슬라이드를 열어 작업하고 댓글을 남겨보세요.',
    siteName: 'G배움로그',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/join-share-preview.png', width: 1200, height: 630, alt: 'G배움로그 학생 슬라이드 접속' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'G배움로그 | 학생 슬라이드 접속',
    description: '선생님이 공유한 수업 슬라이드를 열어 작업하고 댓글을 남겨보세요.',
    images: ['/join-share-preview.png'],
  },
};

export default function JoinLayout({ children }) {
  return children;
}
