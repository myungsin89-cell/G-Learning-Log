import StudentEntry from '@/components/StudentEntry';

export default function Page() {
  return <StudentEntry example={{ className: '5학년 2반', assignmentName: '달의 모양 관찰하기', students: [{ number: 1, name: '김누리' }, { number: 4, name: '송명신' }, { number: 5, name: '달빛' }, { number: 6, name: '김하늘' }, { number: 7, name: '박유진' }, { number: 8, name: '이봄' }] }} />;
}
