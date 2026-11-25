import { REGIONS, SIZES } from '../layout';
import { TOKENS } from '../tokens';
import type { Config, Step } from '../types';
import { Probe } from './Marks';

const hex = (value: number, width: number) =>
  `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
const bits = (value: number, width: number) => `0b${value.toString(2).padStart(width, '0')}`;
const levelRange = (cfg: Config, level: number, offsetBits: number) => {
  const indexBits = (cfg.addrWidth - offsetBits) / cfg.levels;
  const high = offsetBits + (cfg.levels - level) * indexBits - 1;
  return { high, low: high - indexBits + 1, indexBits };
};

/** 地址位条：每 3 位一格，索引位着 vpn，偏移位着 offset。 */
export default function AddressBar({
  cfg,
  va,
  step,
}: {
  cfg: Config;
  va: number;
  step: Step | null;
}) {
  const region = REGIONS.addrBar;
  const offsetBits = Math.log2(cfg.pageSize);
  const indexBits = (cfg.addrWidth - offsetBits) / cfg.levels;
  const cellCount = SIZES.addrCells[cfg.addrWidth];
  const focus = new Set(step?.focus ?? []);

  let focusLevel: number | null = null;
  for (const ref of focus) {
    const matched = /^addr\.index\.(\d+)$/.exec(ref);
    if (matched) {
      focusLevel = Number(matched[1]);
      break;
    }
  }
  const focusOffset = focus.has('addr.offset');
  const focusAll = focus.has('addr.bits');

  const levelOf = (cell: number): number | null => {
    const low = cfg.addrWidth - 3 * (cell + 1);
    if (low < offsetBits) return null;
    return cfg.levels - 1 - Math.floor((low - offsetBits) / indexBits);
  };

  const cells = Array.from({ length: cellCount }, (_, cell) => {
    const low = cfg.addrWidth - 3 * (cell + 1);
    const value = Math.floor(va / 2 ** low) % 8;
    return { cell, low, value, level: levelOf(cell) };
  });

  const probeCell =
    focusLevel === null
      ? cells.find((cell) => cell.level === null)?.cell ?? 0
      : cells.find((cell) => cell.level === focusLevel)?.cell ?? 0;

  const result = step?.state.result ?? null;
  const activeIndex = focusLevel !== null && step ? step.state.indices[focusLevel] : null;
  const activeRange = focusLevel !== null ? levelRange(cfg, focusLevel, offsetBits) : null;
  const allRanges = Array.from({ length: cfg.levels }, (_, lvl) => {
    const range = levelRange(cfg, lvl, offsetBits);
    return `L${lvl} ${range.high}:${range.low}`;
  }).join(' · ');

  return (
    <section
      style={{
        position: 'absolute',
        left: region.x,
        top: region.y,
        width: region.w,
        height: region.h,
        boxSizing: 'border-box',
        padding: '10px 16px',
        background: TOKENS.color.panel,
        border: `1px solid ${TOKENS.color.line}`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: SIZES.gap,
          position: 'relative',
          height: SIZES.addrCellH + SIZES.gap,
        }}
      >
        {cells.map(({ cell, low, value, level }) => {
          const isOffset = level === null;
          const active =
            focusAll || (isOffset ? focusOffset : focusLevel === level);
          return (
            <div
              key={cell}
              title={`bit ${low + 2}:${low} · ${isOffset ? '页内偏移' : `L${level} 索引`}`}
              style={{
                flex: 1,
                height: SIZES.addrCellH,
                lineHeight: `${SIZES.addrCellH}px`,
                textAlign: 'center',
                font: TOKENS.font.mono,
                fontSize: 12,
                color: isOffset ? TOKENS.color.offset : TOKENS.color.vpn,
                background: isOffset ? `${TOKENS.color.offset}1A` : `${TOKENS.color.vpn}1A`,
                borderRadius: 3,
                outline: active ? `2px solid ${TOKENS.color.focus}` : 'none',
                boxShadow: active ? TOKENS.focusRing.glow : 'none',
                transition: TOKENS.motion.base,
              }}
            >
              {value.toString(2).padStart(3, '0')}
            </div>
          );
        })}
        <Probe
          leftPct={((probeCell + 0.5) / cellCount) * 100}
          top={SIZES.addrCellH / 2}
          active={Boolean(step) && (focusAll || focusOffset || focusLevel !== null)}
        />
      </div>
      <div
        style={{
          marginTop: 4,
          font: TOKENS.font.mono,
          fontSize: 11,
          color: TOKENS.color.textMuted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {focusLevel !== null && activeIndex !== null && activeRange
          ? `本级 L${focusLevel} 取 VA bit ${activeRange.high}:${activeRange.low} = ${bits(
              activeIndex,
              activeRange.indexBits,
            )} → 第 ${activeIndex} 槽（索引 ${hex(activeIndex, 3)}）`
          : focusOffset
            ? `页内偏移取 VA bit ${offsetBits - 1}:0，不参与选槽`
            : `每级取 ${(cfg.addrWidth - offsetBits) / cfg.levels} 位作槽号：${allRanges} · offset ${
                offsetBits - 1
              }:0`}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          font: TOKENS.font.mono,
          color: TOKENS.color.textMuted,
        }}
      >
        <span>VA {hex(va, Math.ceil(cfg.addrWidth / 4))}</span>
        <span>
          VPN（VA&gt;&gt;{offsetBits}）{hex(Math.floor(va / 2 ** offsetBits), 8)} · offset{' '}
          {hex(va % 2 ** offsetBits, offsetBits / 4)}
        </span>
        <span style={{ color: result?.pa != null ? TOKENS.color.hit : TOKENS.color.textMuted }}>
          PA {result?.pa != null ? hex(result.pa, 6) : '—'}
        </span>
      </div>
    </section>
  );
}
