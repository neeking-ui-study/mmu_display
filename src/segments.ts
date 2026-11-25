import { bitFieldOf } from './config';
import { TOKENS } from './tokens';
import type { Config } from './types';

export interface LevelInfo {
  level: number;
  alias: string;
  high: number;
  low: number;
  indexBits: number;
  /** 该级一个表项覆盖的字节数 */
  entrySpan: number;
  /** 该级一张表覆盖的字节数 */
  tableSpan: number;
  entries: number;
}

const NAMES = ['PGD', 'PUD', 'PMD', 'PTE'] as const;

/** Linux 折叠习惯：3 级折叠 PUD，2 级再折叠 PMD，不做简单平移。 */
function aliasesOf(levels: number): { aliases: string[]; folded: string[] } {
  if (levels >= 4) return { aliases: [...NAMES], folded: [] };
  if (levels === 3) return { aliases: ['PGD', 'PMD', 'PTE'], folded: ['PUD'] };
  return { aliases: ['PGD', 'PTE'], folded: ['PUD', 'PMD'] };
}

export function levelInfos(cfg: Config): { infos: LevelInfo[]; folded: string[] } {
  const { offsetBits, indexBits, levels } = bitFieldOf(cfg.addrWidth, cfg.pageSize);
  const { aliases, folded } = aliasesOf(levels);
  const infos = Array.from({ length: levels }, (_, level) => {
    const high = offsetBits + (levels - level) * indexBits - 1;
    const entryBits = offsetBits + (levels - 1 - level) * indexBits;
    return {
      level,
      alias: aliases[level],
      high,
      low: high - indexBits + 1,
      indexBits,
      entrySpan: 2 ** entryBits,
      tableSpan: 2 ** (entryBits + indexBits),
      entries: 2 ** indexBits,
    };
  });
  return { infos, folded };
}

export function segmentColor(level: number | null): string {
  if (level === null) return TOKENS.color.segOff;
  return [TOKENS.color.segL0, TOKENS.color.segL1, TOKENS.color.segL2, TOKENS.color.segL3][level];
}

export function segmentLabel(level: number | null, alias?: string): string {
  if (level === null) return 'OFF';
  return alias ? `L${level}·${alias}` : `L${level}`;
}

export function fmtSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[unit]}`;
}
