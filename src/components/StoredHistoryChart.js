'use client';

import { useState } from 'react';
import { formatAmount, formatCheckedAt } from '@/lib/storedWorkRecords.mjs';
import { compactChartBins, legacyChangeBins } from '@/lib/recordChart.mjs';
import RecordChangeChart from './RecordChangeChart';
import styles from './SlideDashboardPreview.module.css';

const metrics = { charCount: { label: '글자', unit: '자' }, imageCount: { label: '이미지', unit: '개' }, slideCount: { label: '슬라이드', unit: '장' } };

export default function StoredHistoryChart({ records, templateBaseline }) {
  const [metric, setMetric] = useState('charCount');
  const [grouping, setGrouping] = useState('day');
  const [selectedId, setSelectedId] = useState(null);
  const allBins = legacyChangeBins(records, metric, grouping, templateBaseline);
  const bins = compactChartBins(allBins);
  const selected = bins.find((bin) => bin.id === selectedId);
  const unknown = allBins.reduce((sum, bin) => sum + bin.unknown, 0);
  const { label, unit } = metrics[metric];
  const reset = () => setSelectedId(null);

  return <div>
    <div className={styles.historyChartControls}><div className={styles.periodControls} aria-label="기존 기록 그래프 수치">{Object.entries(metrics).map(([key, item]) => <button key={key} aria-pressed={metric === key} onClick={() => { setMetric(key); reset(); }}>{item.label}</button>)}</div><div className={styles.periodControls} aria-label="기존 기록 묶음"><button aria-pressed={grouping === 'day'} onClick={() => { setGrouping('day'); reset(); }}>날짜별</button><button aria-pressed={grouping === 'record'} onClick={() => { setGrouping('record'); reset(); }}>확인 구간별</button></div></div>
    <RecordChangeChart bins={bins} label={label} unit={unit} selectedId={selectedId} onSelect={setSelectedId} ordered={grouping === 'record'} />
    <p className={styles.chartDescription}>첫 확인은 기준점입니다. 처음 담긴 템플릿·분량은 증가량에 넣지 않고, 이후 저장 수치의 증가·감소를 표시합니다. 막대를 누르면 해당 기록을 볼 수 있어요.</p>
    <p className={styles.smallNote}>기존 저장 시점 사이의 차이이며 실제 작성 시각이나 모든 편집량을 뜻하지 않습니다.{unknown ? ` 집계 기준이 불명확한 ${unknown}구간은 변화량을 계산하지 않았습니다.` : ''}{bins.length < allBins.length ? ` 전체 ${allBins.length}구간을 ${bins.length}묶음으로 모았습니다.` : ''}</p>
    {selected && <div className={styles.historySelection}><div className={styles.recordHeading}><h4>{selected.label} · 기록 확인</h4><button className={styles.textAction} onClick={() => setSelectedId(null)}>선택 해제</button></div><ol className={styles.activityList}>{selected.comparisons.map(({ previous, current, difference, templateAdjusted, templateReference }, index) => <li key={current.id || index}><time>{previous ? `${formatCheckedAt(previous.checkedAt)} → ` : ''}{formatCheckedAt(current.checkedAt)}</time><div><span>{templateReference ? '초기 템플릿이 포함된 상태 · 작업 증가량에서 제외' : previous ? difference === null ? '변화량 미확인' : `저장 ${label} 차이 ${difference > 0 ? '+' : ''}${formatAmount(difference)}${unit}` : '첫 확인 기준 · 초기 분량은 작업 증가량에서 제외'}</span>{templateAdjusted && <small>기존 템플릿 포함 수치를 템플릿 제외 기준으로 맞춰 비교했습니다.</small>}<small>원본 저장 글자 {formatAmount(current.charCount)}자 · 슬라이드 {formatAmount(current.slideCount)}장 · 이미지 {formatAmount(current.imageCount)}개</small></div></li>)}</ol></div>}
  </div>;
}
