import { DEFAULT_CFG } from '../config';
import { REGIONS, SIZES } from '../layout';
import { fmtSize, levelInfos, segmentColor } from '../segments';
import { TOKENS } from '../tokens';
import type { Pte, Step, ViewMode } from '../types';

const ENTRIES = 512;
const hex = (value: number, width = 3) =>
  `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
const bits = (value: number, width = 9) => `0b${value.toString(2).padStart(width, '0')}`;

/** 模拟 32 位描述符：[47:12]=pfn，低位依次放 v/r/w/x/u/a/d，仅用于讲解，非真实编码。 */
function descriptorOf(pte: Pte): number {
  return (
    ((pte.pfn << 12) |
      pte.v |
      (pte.r << 1) |
      (pte.w << 2) |
      (pte.x << 3) |
      (pte.u << 4) |
      (pte.a << 6) |
      (pte.d << 7)) >>>
    0
  );
}

/** 页表区：每级一行，16 格窗口以当前索引居中，两端折叠计数。 */
export default function TableTree({ step, viewMode }: { step: Step | null; viewMode: ViewMode }) {
  const region = REGIONS.pageTable;
  const state = step?.state ?? null;
  const passed = new Set(step?.passed ?? []);
  const focus = new Set(step?.focus ?? []);
  const { infos, folded } = levelInfos(state?.cfg ?? DEFAULT_CFG);

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
      <div style={{ font: TOKENS.font.mono, fontSize: 10.5, color: TOKENS.color.textMuted }}>
        页表 · {infos.map((info) => `L${info.level} · ${info.alias}`).join(' / ')}
        {folded.length > 0 ? `（${folded.join('、')} 折叠）` : ''}
      </div>
      {rows.map(({ level, frame, index, table, current }) => {
        const start = Math.min(Math.max(index - 8, 0), ENTRIES - SIZES.pageWindow);
        const windowCells = Array.from({ length: SIZES.pageWindow }, (_, i) => start + i);
        const offsetBits = state ? Math.log2(state.cfg.pageSize) : 0;
        const indexBits = state ? (state.cfg.addrWidth - offsetBits) / state.cfg.levels : 0;
        const high = state ? offsetBits + (state.cfg.levels - level) * indexBits - 1 : 0;
        const low = high - indexBits + 1;
        const info = infos[level];
        const color = segmentColor(level);
        const addrHexWidth = state ? Math.ceil(state.cfg.addrWidth / 4) : 12;
        const tableBase = state ? Math.floor(state.va / info.tableSpan) * info.tableSpan : 0;
        return (
          <div key={level} style={{ flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: TOKENS.font.mono, color, width: 150 }}>
                {viewMode === 'register' && level === 0
                  ? `TTBR0_EL1 基址 ${hex(frame)}`
                  : `L${level} · ${info.alias} · 帧 ${hex(frame)}`}
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
                      title={`第 ${cell} 槽 · 索引 ${hex(cell)}`}
                      style={{
                        flex: 1,
                        height: SIZES.cell.h,
                        lineHeight: `${SIZES.cell.h}px`,
                        textAlign: 'center',
                        font: TOKENS.font.mono,
                        fontSize: 11,
                        borderRadius: 2,
                        border: `1px solid ${color}55`,
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
              第 {index} 槽（索引 {hex(index)}）· 本级取 VA bit {high}:{low} = {bits(index)}
            </div>
            <div
              style={{
                font: TOKENS.font.mono,
                fontSize: 11,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {current ? (
                <>
                  <span style={{ color: TOKENS.color.textMuted }}>描述符 </span>
                  <span style={{ color: TOKENS.color.text }}>{hex(descriptorOf(current), 8)}</span>
                  <span style={{ color: TOKENS.color.textMuted }}>（模拟布局）</span>
                  <span style={{ color: TOKENS.color.textMuted }}> · PFN </span>
                  <span style={{ color: TOKENS.color.vpn }}>{hex(current.pfn)}</span>
                  <span style={{ color: TOKENS.color.textMuted }}>
                    （{current.leaf ? '数据页帧' : '下一级表帧'}）
                  </span>
                  <span style={{ color: TOKENS.color.textMuted }}>
                    {' '}
                    · v={current.v} r={current.r} w={current.w} x={current.x} u={current.u} a=
                    {current.a} d={current.d} · {current.leaf ? '叶子表项' : '非叶子表项'}
                  </span>
                </>
              ) : (
                <span style={{ color: TOKENS.color.error }}>该槽无表项（v=0，访问会触发页缺失）</span>
              )}
            </div>
            <div
              style={{
                font: TOKENS.font.mono,
                fontSize: 11,
                color: TOKENS.color.textMuted,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              本表覆盖 VA {hex(tableBase, addrHexWidth)}–{hex(tableBase + info.tableSpan - 1, addrHexWidth)}
              （{fmtSize(info.tableSpan)}）· 每项 {fmtSize(info.entrySpan)} · {info.entries} 项 × 8 B ={' '}
              {fmtSize(info.entries * 8)}，刚好一页
            </div>
          </div>
        );
      })}
    </section>
  );
}
