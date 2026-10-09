import SlideDashboardPreview from '@/components/SlideDashboardPreview';
import { previewAssignments } from '@/lib/slidePreviewData';
import { parseRosterInput } from '@/lib/workRecords.mjs';

export const metadata = { title: 'G배움로그 학생 작업 현황 시안' };

export default async function DashboardPreviewPage({ searchParams }) {
  const query = await searchParams;
  const assignment = previewAssignments.find((item) => item.id === query.assignment) || previewAssignments[0];
  const className = ['5학년 2반', '6학년 1반', '4학년 3반'].includes(query.className) ? query.className : '5학년 2반';
  const custom = query.assignment === 'custom';
  const customKeywords = typeof query.keywords === 'string' ? query.keywords.slice(0, 500).split(',').map((word) => word.trim()).filter(Boolean) : [];
  const config = custom ? {
    name: typeof query.title === 'string' ? query.title.slice(0, 80) : '슬라이드 과제',
    keywords: [...new Set(customKeywords)],
    students: Math.max(1, Math.min(24, Number(query.students) || 24)),
    closed: false,
  } : assignment;
  let parsedRoster = null;
  if (typeof query.roster === 'string' && query.roster.length < 12000) {
    try {
      const input = JSON.parse(query.roster);
      parsedRoster = parseRosterInput(input.map((student) => `${student.number} ${student.name}`).join('\n'));
    } catch { /* Invalid preview query falls back to the example roster. */ }
  }
  return <SlideDashboardPreview key={`${className}-${query.assignment || 'climate'}-${query.roster || ''}`} className={className} assignment={parsedRoster ? { ...config, students: parsedRoster.length, roster: parsedRoster } : config} />;
}
