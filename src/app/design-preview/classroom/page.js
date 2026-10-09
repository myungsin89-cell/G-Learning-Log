import ClassWorkspacePreview from '@/components/ClassWorkspacePreview';

export const metadata = {
  title: 'G배움로그 학급 과제 화면 시안',
  description: '학급별 슬라이드 과제 목록과 새 과제 만들기 디자인',
};

export default async function ClassroomPreviewPage({ searchParams }) {
  const query = await searchParams;
  const className = ['5학년 2반', '6학년 1반', '4학년 3반'].includes(query.className) ? query.className : '5학년 2반';
  return <ClassWorkspacePreview key={className} className={className} />;
}
