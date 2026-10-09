'use client';

import { formatAmount, formatCheckedAt } from '@/lib/storedWorkRecords.mjs';
import styles from './SlideDashboardPreview.module.css';

const dateLabel = (value) => new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
const signed = (value) => `${value > 0 ? '+' : ''}${formatAmount(value)}`;
const ceiling = (value) => {
  if (!value) return 0;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
};

export default function RecordChangeChart({ bins, unit = '자', label = '글자', selectedId, onSelect, ordered = false }) {
  if (!bins.length) return <p className={styles.smallNote}>그래프를 만들 수 있는 저장 시각이 없습니다.</p>;
  const width = 680, height = 276, left = 58, right = 660, top = 30, bottom = 222;
  const positive = ceiling(Math.max(...bins.map((bin) => bin.added)));
  const negative = ceiling(Math.max(...bins.map((bin) => bin.removed)));
  const domain = (positive || (negative ? 0 : 1)) + negative;
  const y = (value) => top + ((positive || (negative ? 0 : 1)) - value) / domain * (bottom - top);
  const zero = y(0);
  const dates = bins.flatMap((bin) => [Date.parse(bin.start), Date.parse(bin.end)]).filter(Number.isFinite);
  const min = Math.min(...dates), max = Math.max(...dates);
  const x = (bin, index) => ordered || max === min ? left + 16 + (index + .5) / bins.length * (right - left - 32) : left + 16 + (Date.parse(bin.end) - min) / (max - min) * (right - left - 32);
  const barWidth = Math.min(24, Math.max(4, (right - left - 32) / (bins.length + 1) * .55));
  const ticks = [...new Set([positive, positive / 2, 0, -negative / 2, -negative])].filter((value) => Number.isInteger(value));
  const selected = bins.find((bin) => bin.id === selectedId);
  const labelCount = Math.min(5, bins.length);
  const dateTicks = Array.from({ length: labelCount }, (_, index) => {
    const ratio = labelCount === 1 ? .5 : index / (labelCount - 1);
    const recordIndex = Math.round(ratio * (bins.length - 1));
    return { x: left + 16 + ratio * (right - left - 32), text: ordered ? dateLabel(bins[recordIndex].end) : dateLabel(new Date(min + ratio * (max - min)).toISOString()) };
  });
  return <div className={styles.unifiedChart}>
    <div className={styles.chartHeading}><span>저장 {label} 수의 구간별 변화 <small>({unit})</small></span><span className={styles.chartKey}><i />증가 <i className={styles.chartNegativeKey} />감소</span></div>
    <svg className={styles.unifiedChartSvg} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${label} 증가와 감소를 한 좌표에 표시한 막대그래프`}>
      {ticks.map((tick) => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#9caf9f' : '#e3eae3'} strokeDasharray={tick === 0 ? undefined : '3 5'} /><text x={left - 10} y={y(tick) + 4} textAnchor="end" className={styles.axisText}>{tick > 0 ? '+' : ''}{formatAmount(tick)}</text></g>)}
      {bins.map((bin, index) => {
        const center = x(bin, index), selected = selectedId === bin.id;
        return <g key={bin.id} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${bin.label}, 증가 ${formatAmount(bin.added)}${unit}, 감소 ${formatAmount(bin.removed)}${unit}${bin.reference ? ', 첫 확인 기준 포함' : ''}${bin.unknown ? ', 비교 미확인 구간 포함' : ''}`} className={styles.chartHit} onClick={() => onSelect(selected ? null : bin.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selected ? null : bin.id); } }}>
          <title>{`${formatCheckedAt(bin.start)} → ${formatCheckedAt(bin.end)}\n증가 ${bin.added}${unit} · 감소 ${bin.removed}${unit}`}</title>
          <rect x={center - Math.max(barWidth, 14) / 2} y={top} width={Math.max(barWidth, 14)} height={bottom - top} fill={selected ? '#edf4ee' : 'transparent'} />
          {bin.added > 0 && <rect x={center - barWidth / 2} y={y(bin.added)} width={barWidth} height={zero - y(bin.added)} rx="2" fill={selected ? '#286344' : '#5d9775'} />}
          {bin.removed > 0 && <rect x={center - barWidth / 2} y={zero} width={barWidth} height={y(-bin.removed) - zero} rx="2" fill="#bf8a69" />}
          {!bin.added && !bin.removed && <circle cx={center} cy={zero} r={bin.reference ? 4 : 2.5} fill={bin.unknown ? '#abb6ad' : '#627f6b'} />}
          {(bins.length <= 10 || selected) && bin.added > 0 && <text x={center} y={y(bin.added) - 7} textAnchor="middle" className={styles.barText}>{signed(bin.added)}</text>}
          {(bins.length <= 10 || selected) && bin.removed > 0 && <text x={center} y={y(-bin.removed) + 15} textAnchor="middle" className={styles.barText}>{signed(-bin.removed)}</text>}
        </g>;
      })}
      {dateTicks.map((tick, index) => <text key={index} x={tick.x} y={height - 16} textAnchor="middle" className={styles.axisText}>{tick.text}</text>)}
    </svg>
    <p className={styles.chartRange}>{formatCheckedAt(new Date(min).toISOString())} — {formatCheckedAt(new Date(max).toISOString())}{ordered ? ' · 저장 시점 순서' : ' · 저장 확인일 기준'}</p>
    {selected && <div className={styles.chartSelectionSummary}>{selected.label} · 증가 {formatAmount(selected.added)}{unit} · 감소 {formatAmount(selected.removed)}{unit}</div>}
  </div>;
}
