import { levelInfos, segmentColor, segmentLabel } from '../segments';
import { TOKENS } from '../tokens';
import type { Config } from '../types';

/** 同一条分段色带：高位到低位依次 L0–L3 与 OFF，供地址条、页表、TLB、旁白共用。 */
export default function SegmentBand({
  cfg,
  width,
  height = 14,
  showLabels = true,
}: {
  cfg: Config;
  width: number;
  height?: number;
  showLabels?: boolean;
}) {
  const { infos } = levelInfos(cfg);
  const offsetBits = Math.log2(cfg.pageSize);
  const segments = [
    ...infos.map((info) => ({
      key: `${info.level}`,
      bits: info.high - info.low + 1,
      color: segmentColor(info.level),
      label: segmentLabel(info.level, info.alias),
      title: `${segmentLabel(info.level, info.alias)} 索引 bit ${info.high}:${info.low}`,
    })),
    {
      key: 'off',
      bits: offsetBits,
      color: segmentColor(null),
      label: 'OFF',
      title: `页内偏移 bit ${offsetBits - 1}:0`,
    },
  ];
  return (
    <div
      style={{
        display: 'flex',
        width,
        height,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${TOKENS.color.line}`,
        boxSizing: 'border-box',
      }}
    >
      {segments.map((segment, index) => (
        <div
          key={segment.key}
          title={segment.title}
          style={{
            flex: segment.bits,
            background: segment.color,
            color: '#FFFFFF',
            font: TOKENS.font.mono,
            fontSize: 8,
            lineHeight: `${height - 2}px`,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            borderRight: index === segments.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.7)',
          }}
        >
          {showLabels ? segment.label : ''}
        </div>
      ))}
    </div>
  );
}
