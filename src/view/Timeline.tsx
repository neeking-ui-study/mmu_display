import { REGIONS, SIZES } from '../layout';
import { TOKENS } from '../tokens';
import type { Step } from '../types';

const SHORT: Record<Step['kind'], string> = {
  addr_split: 'split',
  tlb_lookup: 'lookup',
  tlb_hit: 'hit',
  tlb_miss: 'miss',
  walk_read: 'read',
  walk_leaf: 'leaf',
  tlb_fill: 'fill',
  tlb_evict: 'evict',
  fault_page: 'page fault',
  fault_perm: 'perm fault',
  fault_handle: 'handle',
  done: 'done',
};

/** 时间轴：横向等宽分段；当前段 focus 底，异常段 error 底，已过段 linePassed。 */
export default function Timeline({
  steps,
  cursor,
  onSeek,
}: {
  steps: Step[];
  cursor: number;
  onSeek: (index: number) => void;
}) {
  const region = REGIONS.timeline;
  return (
    <section
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.w,
        height: region.h,
        boxSizing: 'border-box',
        padding: '8px 12px',
        background: TOKENS.color.panel,
        border: `1px solid ${TOKENS.color.line}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: SIZES.gap,
      }}
    >
      {steps.map((step, index) => {
        const current = index === cursor;
        const failed = step.error.length > 0;
        const past = index < cursor;
        return (
          <div
            key={step.id}
            role="button"
            tabIndex={0}
            title={`第 ${index + 1} 步 · ${SHORT[step.kind]}`}
            onClick={() => onSeek(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSeek(index);
            }}
            style={{
              flex: 1,
              height: SIZES.timelineH,
              lineHeight: `${SIZES.timelineH}px`,
              textAlign: 'center',
              font: TOKENS.font.mono,
              fontSize: 11,
              borderRadius: 3,
              cursor: 'pointer',
              color: current || past || failed ? TOKENS.color.bg : TOKENS.color.textMuted,
              background: current
                ? TOKENS.color.focus
                : failed
                  ? TOKENS.color.error
                  : past
                    ? TOKENS.color.linePassed
                    : TOKENS.color.bg,
              border: `1px solid ${
                current ? TOKENS.color.focus : failed ? TOKENS.color.error : TOKENS.color.line
              }`,
              transition: TOKENS.motion.base,
            }}
          >
            {SHORT[step.kind]}
            {step.level !== null ? ` ${step.level}` : ''}
          </div>
        );
      })}
    </section>
  );
}
