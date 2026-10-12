'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { studentActivityTimeline } from '@/lib/recordChart.mjs';
import { studentLabel } from '@/lib/workRecords.mjs';
import { formatAmount, formatCheckedAt } from '@/lib/storedWorkRecords.mjs';
import styles from './SlideDashboardPreview.module.css';

const signed = (value) => `${value > 0 ? '+' : ''}${formatAmount(value)}`;
const changed = (bin) => bin.added + bin.removed;
const otherChanges = (bin) => bin.imageAdded + bin.imageRemoved + bin.slideAdded + bin.slideRemoved;
const pointTime = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '시각 미기록';

function ChangeWords({ bin }) {
  return <>{bin.added > 0 && <span>글자 {formatAmount(bin.added)}자 추가</span>}{bin.removed > 0 && <span>글자 {formatAmount(bin.removed)}자 삭제</span>}{bin.textUncertain && <span>글자 변화량 미확인</span>}{bin.imageAdded > 0 && <span>이미지 {formatAmount(bin.imageAdded)}개 추가</span>}{bin.imageRemoved > 0 && <span>이미지 {formatAmount(bin.imageRemoved)}개 삭제</span>}{bin.slideAdded > 0 && <span>슬라이드 {formatAmount(bin.slideAdded)}장 추가</span>}{bin.slideRemoved > 0 && <span>슬라이드 {formatAmount(bin.slideRemoved)}장 삭제</span>}{!changed(bin) && !otherChanges(bin) && !bin.textUncertain && <span>슬라이드별 변화 확인</span>}</>;
}

function GraphExplanation() {
  return <details className={styles.graphExplanation}>
    <summary>그래프 표시 기준</summary>
    <div><p>화면에 표시하는 기간이 짧으면 작은 간격으로, 길면 큰 간격으로 모아 보여줍니다. 크게 보기에서 기간을 좁히면 더 자세히 볼 수 있어요.</p>
      <table><thead><tr><th scope="col">표시 기간</th><th scope="col">모아 보는 단위</th></tr></thead><tbody>{[['30분 이내', '3분'], ['30분 초과 ~ 2시간', '5분'], ['2시간 초과 ~ 6시간', '10분'], ['6시간 초과 ~ 하루', '30분'], ['하루 초과 ~ 이틀', '1시간'], ['이틀 초과 ~ 48일', '하루'], ['48일 초과 ~ 96일', '2일'], ['96일 초과 ~ 336일', '7일'], ['336일 초과', '전체 기간에 맞춰 더 넓게']].map(([period, unit]) => <tr key={period}><td>{period}</td><td>{unit}</td></tr>)}</tbody></table>
      <p>실시간 확인 중에는 약 30초마다 상태를 확인합니다. 위 단위는 기록을 저장하는 간격이 아니라 그래프에서 묶어 보여주는 간격이에요. 막대나 점을 누르면 묶인 개별 기록을 확인할 수 있습니다.</p>
      <p>막대 높이는 추가·삭제된 글자 수의 합입니다. 이미지·슬라이드 변화는 점으로 표시합니다. 처음 확인한 상태와 기본 템플릿은 작업 증가량으로 세지 않습니다.</p>
      <p>시계 시각을 기준으로 묶으므로 시작과 끝의 막대는 일부 시간만 담을 수 있습니다. 앱을 닫거나 확인이 중단된 사이의 변화는 마지막 확인 시점에 표시하며, 실제로 언제 작성했는지는 알 수 없어요.</p>
    </div>
  </details>;
}

function ActivityPlot({ timeline, interactive = false, selectedId, onSelect }) {
  const { bins, start, end } = timeline;
  const min = Date.parse(start), max = Date.parse(end), short = max - min <= 48 * 3600000;
  const left = 60, right = 660, top = 34, bottom = 232;
  const largest = Math.max(1, ...bins.map(changed));
  const step = 10 ** Math.floor(Math.log10(largest)), ceiling = Math.ceil(largest / step) * step;
  const y = (amount) => bottom - amount / ceiling * (bottom - top);
  const x = (bin) => max === min ? (left + right) / 2 : left + 14 + (Date.parse(bin.plotAt || bin.end) - min) / (max - min) * (right - left - 28);
  const distances = bins.slice(1).map((bin, index) => x(bin) - x(bins[index])).filter((distance) => distance > 0);
  const barWidth = Math.max(3, Math.min(24, distances.length ? Math.min(...distances) * .72 : 24));
  const dateLabel = (value) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', ...(short ? { hour: '2-digit', minute: '2-digit', hour12: false } : { month: 'numeric', day: 'numeric' }) });
  return <div className={styles.activityPlot}>
    <div className={styles.chartHeading}><span>바뀐 글자 수 <small>(자)</small></span><span className={styles.activityPlotKey}><i />글자 변화 <b>●</b> 이미지·슬라이드 변화</span></div>
    <svg className={styles.unifiedChartSvg} viewBox="0 0 680 280" role={interactive ? 'group' : 'img'} aria-label="시간에 따른 학생 작업 변화">
      {[...new Set([0, Math.round(ceiling / 2), ceiling])].map((tick) => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#9caf9f' : '#e3eae3'} strokeDasharray={tick === 0 ? undefined : '3 5'} /><text x={left - 10} y={y(tick) + 4} textAnchor="end" className={styles.axisText}>{formatAmount(tick)}</text></g>)}
      {bins.map((bin) => {
        const center = x(bin), selected = selectedId === bin.id, amount = changed(bin), other = otherChanges(bin);
        const description = `${bin.label}, ${bin.textUncertain && !amount ? '글자 변화량 미확인' : `글자 ${formatAmount(amount)}자 변화`}${other ? `, 이미지 ${bin.imageAdded + bin.imageRemoved}개 변화, 슬라이드 ${bin.slideAdded + bin.slideRemoved}장 변화` : ''}`;
        return <g key={bin.id} {...(interactive ? { role: 'button', tabIndex: 0, 'aria-pressed': selected, 'aria-label': description, className: styles.chartHit, onClick: () => onSelect(bin.id), onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(bin.id); } } } : {})}>
          <title>{description}</title><rect x={center - Math.max(16, barWidth) / 2} y={top - 12} width={Math.max(16, barWidth)} height={bottom - top + 24} fill={selected ? '#edf4ee' : 'transparent'} rx="3" />
          {amount > 0 && <rect x={center - barWidth / 2} y={y(amount)} width={barWidth} height={Math.max(2, bottom - y(amount))} fill={selected ? '#286344' : '#5d9775'} rx="2" />}
          {(other > 0 || !amount) && <circle cx={center} cy={amount ? y(amount) - 8 : bottom - 6} r="4" fill="#365c45" stroke="#fcfdfb" strokeWidth="1.5" />}
          {(selected || bins.length <= 8) && amount > 0 && <text x={center} y={y(amount) - (other ? 18 : 8)} className={styles.barText} textAnchor="middle">{formatAmount(amount)}</text>}
        </g>;
      })}
      {Array.from({ length: max === min ? 1 : 5 }, (_, index) => { const ratio = max === min ? .5 : index / 4; return <text key={index} x={left + 14 + ratio * (right - left - 28)} y="267" textAnchor="middle" className={styles.axisText}>{dateLabel(min + ratio * (max - min))}</text>; })}
    </svg>
    <p className={styles.chartRange}>{formatCheckedAt(start)} — {formatCheckedAt(end)}<br />{timeline.grouping.label} 단위로 모아 표시</p>
  </div>;
}

function PointDetails({ bin }) {
  return <section className={styles.activityPointDetails} aria-label="선택한 시점의 작업 내역" aria-live="polite">
    <h3>{bin.label}</h3><div className={styles.activityChangeWords}><ChangeWords bin={bin} /></div>
    <ol className={styles.activityPointList}>{bin.activities.map(({ record, previousCheckedAt, deltas, pages, textUncertain, templateAdjusted }, index) => <li key={record.id || index}>
      <time>{pointTime(record.checkedAt)}</time><p>{deltas.map((value, metric) => value != null && value !== 0 ? <span key={metric}>{['글자', '이미지', '슬라이드'][metric]} {signed(value)}{['자', '개', '장'][metric]}</span> : null)}</p>
      {pages.length > 0 && <ul>{pages.map((page, pageIndex) => <li key={`${page.number}-${pageIndex}`}>{page.number}번 슬라이드 {page.kind === 'added' ? '추가' : page.kind === 'removed' ? '삭제' : <>{page.chars ? `글자 ${signed(page.chars)}자` : ''}{page.chars && page.images ? ', ' : ''}{page.images ? `이미지 ${signed(page.images)}개` : ''}</>}</li>)}</ul>}
      {previousCheckedAt && <small>{pointTime(previousCheckedAt)} 이후 확인된 변화</small>}
      {textUncertain && <small>이 시점의 글자 변화량은 확인되지 않았어요.</small>}
      {templateAdjusted && <small>기본 템플릿 분량을 맞춰 비교했습니다.</small>}
    </li>)}</ol>
    <p className={styles.smallNote}>저장된 수치로 확인한 변화입니다. 당시 본문이 저장되지 않은 기록은 글의 내용까지 확인할 수 없어요.</p>
  </section>;
}

function ExpandedGraph({ records, templateBaseline, student, onClose }) {
  const ref = useRef(null), headingId = useId();
  const [rangeMs, setRangeMs] = useState(null);
  const timeline = studentActivityTimeline(records, templateBaseline, { rangeMs });
  const [selectedId, setSelectedId] = useState(timeline.bins.at(-1)?.id);
  const selected = timeline.bins.find((bin) => bin.id === selectedId) || timeline.bins.at(-1);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className={styles.activityGraphDialog} aria-labelledby={headingId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}>
    <header className={styles.modalHeader}><h2 id={headingId}>{studentLabel(student)} 작업 기록 자세히 보기</h2><button className={styles.secondaryButton} onClick={onClose} autoFocus>닫기</button></header>
    <div className={styles.activityGraphBody}><p className={styles.activityGraphIntro}>막대나 점을 누르면 그때의 작업 내역이 열려요.</p><div className={styles.graphRanges} aria-label="그래프 표시 기간">{[[null, '전체'], [30 * 60000, '최근 30분'], [120 * 60000, '최근 2시간'], [24 * 3600000, '최근 하루']].map(([value, label]) => <button key={label} aria-pressed={rangeMs === value} onClick={() => { setRangeMs(value); setSelectedId(null); }}>{label}</button>)}<small>마지막 확인 시각 기준</small></div><div className={styles.activityGraphLayout}><div><ActivityPlot timeline={timeline} interactive selectedId={selected?.id} onSelect={setSelectedId} />{!timeline.bins.length && <p className={styles.smallNote}>이 기간에 확인된 변화가 없어요.</p>}{timeline.textUncertain && <p className={styles.smallNote}>글자 변화량이 확인되지 않은 날은 막대로 표시하지 않습니다. 막대가 없는 날도 글을 썼을 수 있어요.</p>}<p className={styles.smallNote}>기준 분량은 작업량에서 제외합니다. 날짜와 시각은 기록을 확인한 때이며, 확인 사이의 실제 편집 시각은 알 수 없어요.</p><div className={styles.activityDateList} aria-label="작업 시점 선택">{timeline.bins.map((bin) => <button key={bin.id} aria-pressed={selected?.id === bin.id} onClick={() => setSelectedId(bin.id)}>{bin.label}</button>)}</div></div>{selected && <PointDetails bin={selected} />}</div></div>
    <div className={styles.activityGraphBody}><GraphExplanation /></div>
  </dialog>;
}

export default function StudentActivityGraph({ records, templateBaseline, student }) {
  const [expanded, setExpanded] = useState(false);
  const timeline = studentActivityTimeline(records, templateBaseline);
  if (!timeline.bins.length) return <p className={styles.smallNote}>{timeline.textUncertain ? '저장된 기록의 글자 변화량이 확인되지 않아 작업량을 표시할 수 없어요.' : '저장된 기록에서 확인되는 변화가 아직 없어요.'}</p>;
  return <><button className={styles.activityGraphPreview} aria-label="작업 그래프 크게 보기" onClick={() => setExpanded(true)}><ActivityPlot timeline={timeline} /><span className={styles.activityGraphOpen}>크게 보고 작업 내역 확인하기 <span aria-hidden="true">↗</span></span></button>{timeline.textUncertain && <p className={styles.smallNote}>글자 변화량이 확인되지 않은 날은 막대로 표시하지 않습니다. 막대가 없는 날도 글을 썼을 수 있어요.</p>}<p className={styles.smallNote}>기준 분량은 작업량에서 제외합니다. 기록을 확인한 시점을 표시합니다.</p><GraphExplanation />{expanded && <ExpandedGraph records={records} templateBaseline={templateBaseline} student={student} onClose={() => setExpanded(false)} />}</>;
}
