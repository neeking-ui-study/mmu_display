import { REGIONS, SIZES } from '../layout';
import { TOKENS } from '../tokens';
import type { Step } from '../types';
import SegmentBand from './SegmentBand';

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
      <div style={{ font: TOKENS.font.ui, fontSize: 10.5, color: TOKENS.color.textMuted, marginBottom: 3 }}>
        槽位 · VPN（VA&gt;&gt;12）· PFN · 权限 R/W/X · tick（最近使用）
      </div>
      {step && (
        <div style={{ marginBottom: 4 }}>
          <SegmentBand cfg={step.state.cfg} width={region.w - 20} height={12} />
        </div>
      )}
      {Array.from({ length: 8 }, (_, slot) => {
        const entry = tlb[slot];
        const active = focus.has(`tlb.${slot}`);
        const failed = errors.has(`tlb.${slot}`);
        const text = entry
          ? `#${slot} · VPN ${hex(entry.vpn, 8)} · PFN ${hex(entry.pfn, 3)} · R=${entry.r} W=${entry.w} X=${entry.x} · tick=${entry.tick}`
          : `#${slot} · 空槽`;
        return (
          <div
            key={slot}
            style={{
              height: SIZES.tlbRowH,
              lineHeight: `${SIZES.tlbRowH}px`,
              padding: '0 4px',
              font: TOKENS.font.mono,
              fontSize: 10,
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
