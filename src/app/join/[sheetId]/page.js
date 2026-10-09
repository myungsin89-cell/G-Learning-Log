import StudentEntry from '@/components/StudentEntry';

export default async function Page({ params }) {
  const { sheetId } = await params;
  return <StudentEntry sheetId={sheetId} />;
}
