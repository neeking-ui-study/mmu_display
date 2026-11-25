import { ConfigError } from './types';
import type { AddrWidth, Config, PageSize } from './types';

export interface BitField {
  offsetBits: number;
  indexBits: number;
  levels: 2 | 3 | 4;
}

/** 位段表：唯一来源，deriveIndices 只查表，不写死移位量。 */
const BIT_FIELDS: Record<string, BitField> = {
  '48:4096': { offsetBits: 12, indexBits: 9, levels: 4 },
  '39:4096': { offsetBits: 12, indexBits: 9, levels: 3 },
  '48:2097152': { offsetBits: 21, indexBits: 9, levels: 3 },
  '39:2097152': { offsetBits: 21, indexBits: 9, levels: 2 },
};

/** 位宽可选页大小：下拉只列合法组合。 */
export const PAGE_SIZES: Record<AddrWidth, PageSize[]> = {
  48: [4096, 2097152],
  39: [4096, 2097152],
};

export function isSupportedCombo(addrWidth: AddrWidth, pageSize: PageSize): boolean {
  return `${addrWidth}:${pageSize}` in BIT_FIELDS;
}

export function bitFieldOf(addrWidth: AddrWidth, pageSize: PageSize): BitField {
  const field = BIT_FIELDS[`${addrWidth}:${pageSize}`];
  if (!field) {
    throw new ConfigError('不支持的配置', 'addrWidth/pageSize');
  }
  return field;
}

export function deriveLevels(addrWidth: AddrWidth, pageSize: PageSize): 2 | 3 | 4 {
  return bitFieldOf(addrWidth, pageSize).levels;
}

export function deriveIndices(va: number, cfg: Config): { indices: number[]; offset: number } {
  const field = bitFieldOf(cfg.addrWidth, cfg.pageSize);
  if (cfg.levels !== field.levels) {
    throw new ConfigError(`levels 应为 ${field.levels}`, 'levels');
  }
  if (!Number.isInteger(va) || va < 0) {
    throw new ConfigError('地址必须是非负整数', 'va');
  }
  if (va >= 2 ** cfg.addrWidth) {
    throw new ConfigError('地址超出当前位宽', 'va');
  }
  const indices: number[] = [];
  const span = 2 ** field.indexBits;
  for (let i = 0; i < field.levels; i += 1) {
    const shift = field.offsetBits + field.indexBits * (field.levels - 1 - i);
    indices.push(Math.floor(va / 2 ** shift) % span);
  }
  const offset = va % 2 ** field.offsetBits;
  return { indices, offset };
}

export const DEFAULT_CFG: Config = {
  addrWidth: 48,
  pageSize: 4096,
  levels: 4,
  tlbEnabled: true,
  tlbCapacity: 8,
  access: 'read',
};
