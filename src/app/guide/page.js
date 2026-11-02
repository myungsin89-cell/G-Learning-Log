import GuideCarousel from '@/components/GuideCarousel';

export const metadata = {
  title: '슬.기록 시작 가이드',
  description: '학급 등록부터 슬라이드 과제 배부, 모니터링과 피드백까지 차례로 살펴보세요.',
};

export default async function GuidePage({ searchParams }) {
  const query = await searchParams;
  const requested = Number(query.step);
  const initialStep = Number.isSafeInteger(requested) && requested > 0 ? requested - 1 : 0;
  return <GuideCarousel initialStep={initialStep} />;
}
