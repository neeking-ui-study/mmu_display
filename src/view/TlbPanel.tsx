import { REGIONS, SIZES } from '../layout';
import { TOKENS } from '../tokens';
import type { Step } from '../types';

const hex = (value: number, width: number) =>
  `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;

/** TLB 区：8 行槽位；关闭时整区置灰并显示「TLB 已关闭」，不隐藏。 */
export default function TlbPanel({ step, enabled }: { step: Step | null; enabled: boolean }) {
  const region = REGIONS.tlb;
  const tlb = step?.state.tlb ?? [];
  const focus = new Set(step?.focus ?? []);
  const errors = new Set(step?.error ?? []);

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
        opacity: enabled ? 1 : 0.55,
        transition: TOKENS.motion.base,
      }}
    >
      <div style={{ font: TOKENS.font.ui, fontSize: 11, color: TOKENS.color.textMuted, marginBottom: 4 }}>
        槽 · VPN · PFN · R/W/X · tick
      </div>
      {Array.from({ length: 8 }, (_, slot) => {
        const entry = tlb[slot];
        const active = focus.has(`tlb.${slot}`);
        const failed = errors.has(`tlb.${slot}`);
        const text = entry
          ? `#${slot} · ${hex(entry.vpn, 8)} · ${hex(entry.pfn, 3)} · ${entry.r}/${entry.w}/${entry.x} · ${entry.tick}`
          : `#${slot} · —`;
        return (
          <div
            key={slot}
            style={{
              height: SIZES.tlbRowH,
              lineHeight: `${SIZES.tlbRowH}px`,
              padding: '0 4px',
              font: TOKENS.font.mono,
              fontSize: 11,
              color: failed ? TOKENS.color.error : entry ? TOKENS.color.text : TOKENS.color.textMuted,
              background: failed
                ? `${TOKENS.color.error}14`
                : active
                  ? `${TOKENS.color.focus}26`
                  : 'transparent',
              outline: active ? `2px solid ${TOKENS.color.focus}` : 'none',
              boxShadow: active ? TOKENS.focusRing.glow : 'none',
              borderRadius: 2,
              transition: TOKENS.motion.base,
            }}
          >
            {text}
          </div>
        );
      })}
      {!enabled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            font: TOKENS.font.title,
            color: TOKENS.color.textMuted,
            background: `${TOKENS.color.bg}CC`,
            borderRadius: 6,
          }}
        >
          TLB 已关闭
        </div>
      )}
    </section>
  );
}
