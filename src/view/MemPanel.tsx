import { REGIONS, SIZES } from '../layout';
import { TOKENS } from '../tokens';
import type { Step } from '../types';

/** 物理内存：16×16 帧格，页表帧标 T，数据帧标 D，目标帧 hit 描边。 */
export default function MemPanel({ step }: { step: Step | null }) {
  const region = REGIONS.memory;
  const state = step?.state ?? null;
  const tableFrames = new Set<number>();
  const dataFrames = new Set<number>();
  if (state) {
    for (const [frame, table] of Object.entries(state.tables)) {
      tableFrames.add(Number(frame));
      for (const pte of Object.values(table)) {
        if (pte.leaf && pte.v === 1) dataFrames.add(pte.pfn);
      }
    }
  }
  const target = state?.result?.pfn ?? null;
  const cell = SIZES.frame.w;
  const pageLabel = state?.cfg.pageSize === 2097152 ? '2 MB' : '4 KB';

  return (
    <section
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.w,
        height: region.h,
        boxSizing: 'border-box',
        padding: '8px 10px',
        background: TOKENS.color.panel,
        border: `1px solid ${TOKENS.color.line}`,
        borderRadius: 6,
      }}
    >
      <div style={{ font: TOKENS.font.ui, fontSize: 11, color: TOKENS.color.textMuted, marginBottom: 6 }}>
        物理内存 · 256 帧 · {pageLabel}/帧
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SIZES.memGrid}, ${cell}px)`,
          gridAutoRows: `${cell}px`,
          gap: SIZES.gap,
        }}
      >
        {Array.from({ length: SIZES.memGrid * SIZES.memGrid }, (_, frame) => {
          const isTable = tableFrames.has(frame);
          const isData = dataFrames.has(frame);
          const marker = isTable ? 'T' : isData ? 'D' : '';
          const isTarget = frame === target;
          return (
            <div
              key={frame}
              title={`帧 0x${frame.toString(16).toUpperCase().padStart(3, '0')}`}
              style={{
                width: cell,
                height: cell,
                lineHeight: `${cell}px`,
                textAlign: 'center',
                font: TOKENS.font.mono,
                fontSize: 9,
                color: isTable
                  ? TOKENS.color.tableTag
                  : isData
                    ? TOKENS.color.textMuted
                    : TOKENS.color.line,
                background: isTarget ? `${TOKENS.color.hit}26` : TOKENS.color.bg,
                border: `1px solid ${
                  isTarget ? TOKENS.color.hit : isData ? TOKENS.color.line : `${TOKENS.color.line}66`
                }`,
                boxSizing: 'border-box',
                borderRadius: 2,
                transition: TOKENS.motion.fade,
              }}
            >
              {marker}
            </div>
          );
        })}
      </div>
    </section>
  );
}
