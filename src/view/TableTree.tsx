import { REGIONS, SIZES } from '../layout';
import { TOKENS } from '../tokens';
import type { Pte, Step } from '../types';

const ENTRIES = 512;
const hex = (value: number) => `0x${value.toString(16).toUpperCase().padStart(3, '0')}`;

/** 页表区：每级一行，16 格窗口以当前索引居中，两端折叠计数。 */
export default function TableTree({ step }: { step: Step | null }) {
  const region = REGIONS.pageTable;
  const state = step?.state ?? null;
  const passed = new Set(step?.passed ?? []);
  const focus = new Set(step?.focus ?? []);

  interface Row {
    level: number;
    frame: number;
    index: number;
    table: Record<number, Pte>;
    current: Pte | undefined;
  }
  const rows: Row[] = [];
  if (state) {
    let frame = state.rootFrame;
    for (let level = 0; level < state.cfg.levels; level += 1) {
      const table = state.tables[frame];
      if (!table) break;
      const index = state.indices[level];
      const current = table[index];
      rows.push({ level, frame, index, table, current });
      if (!current || current.leaf) break;
      frame = current.pfn;
    }
  }

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
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {rows.map(({ level, frame, index, table, current }) => {
        const start = Math.min(Math.max(index - 8, 0), ENTRIES - SIZES.pageWindow);
        const windowCells = Array.from({ length: SIZES.pageWindow }, (_, i) => start + i);
        return (
          <div key={level} style={{ flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: TOKENS.font.mono, color: TOKENS.color.text, width: 96 }}>
                L{level} 帧 0x{frame.toString(16).toUpperCase().padStart(3, '0')}
              </span>
              <span style={{ font: TOKENS.font.mono, fontSize: 11, color: TOKENS.color.textMuted }}>
                ‹ {start}
              </span>
              <div style={{ display: 'flex', gap: SIZES.gap, flex: 1 }}>
                {windowCells.map((cell) => {
                  const pte = table[cell];
                  const isCurrent = cell === index;
                  const isPassed = passed.has(`pte.${frame}.${cell}`);
                  const isFocus = isCurrent && focus.has(`pte.${frame}.${cell}`);
                  const invalid = pte ? pte.v === 0 : false;
                  return (
                    <div
                      key={cell}
                      title={`索引 ${hex(cell)}`}
                      style={{
                        flex: 1,
                        height: SIZES.cell.h,
                        lineHeight: `${SIZES.cell.h}px`,
                        textAlign: 'center',
                        font: TOKENS.font.mono,
                        fontSize: 11,
                        borderRadius: 2,
                        color: invalid
                          ? TOKENS.color.error
                          : pte
                            ? TOKENS.color.text
                            : TOKENS.color.textMuted,
                        background: invalid
                          ? `${TOKENS.color.error}1A`
                          : isCurrent
                            ? `${TOKENS.color.focus}26`
                            : isPassed
                              ? `${TOKENS.color.linePassed}14`
                              : TOKENS.color.panel,
                        outline: isFocus ? `2px solid ${TOKENS.color.focus}` : 'none',
                        boxShadow: isFocus ? TOKENS.focusRing.glow : 'none',
                        transition: TOKENS.motion.base,
                      }}
                    >
                      {pte ? cell.toString(16).toUpperCase().padStart(3, '0') : '—'}
                    </div>
                  );
                })}
              </div>
              <span style={{ font: TOKENS.font.mono, fontSize: 11, color: TOKENS.color.textMuted }}>
                {ENTRIES - start - SIZES.pageWindow} ›
              </span>
            </div>
            <div
              style={{
                font: TOKENS.font.mono,
                fontSize: 11,
                color: TOKENS.color.textMuted,
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              索引 {hex(index)} ·
              {current
                ? ` v${current.v} r${current.r} w${current.w} x${current.x} u${current.u} a${current.a} d${current.d} · PFN 0x${current.pfn
                    .toString(16)
                    .toUpperCase()
                    .padStart(3, '0')} · ${current.leaf ? 'leaf' : 'table'}`
                : ' 表项缺失'}
            </div>
          </div>
        );
      })}
    </section>
  );
}
