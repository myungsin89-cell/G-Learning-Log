'use client';

import SlideDashboardPreview from './SlideDashboardPreview';
import useLiveWorkspace from './useLiveWorkspace';

export default function ConnectedAssignment({ data, onBack, onHome, onRefresh, loadPresentation, loadComments, loadWorkspace, authorize, configureEntry }) {
  const workspace = useLiveWorkspace(data, { authorize, loadWorkspace, loadPresentation, loadComments });
  return <SlideDashboardPreview className={data.className} assignment={data.assignment} initialData={data} workspace={workspace}
    onBack={onBack} onHome={onHome} onRefresh={onRefresh} onLoadComments={loadComments} onLoadPresentation={loadPresentation} onConfigureEntry={configureEntry ? async (mode) => { const entry = await configureEntry(mode); await workspace.refreshSettings(); return entry; } : undefined} />;
}
