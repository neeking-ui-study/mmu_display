import { deriveIndices, deriveLevels } from '../config';
import { ConfigError } from '../types';
import type { AddrWidth, Config, PageSize, Pte, TlbEntry } from '../types';

export const FRAME_COUNT = 256;

export interface MemSpecMapping {
  vaBase: number;
  pages: number;
  pa: number;
  v: 0 | 1;
  r: 0 | 1;
  w: 0 | 1;
  x: 0 | 1;
  u: 0 | 1;
  a: 0 | 1;
  d: 0 | 1;
}

export interface MemSpec {
  version: 1;
  addrWidth: AddrWidth;
  pageSize: PageSize;
  rootFrame: number;
  frameCount: 256;
  freeFrameStart: number;
  mappings: MemSpecMapping[];
  tlb: TlbEntry[];
}

export interface MemImage {
  /** 物理页大小；帧号按此粒度编号（4 KB 页时一帧 4 KB，2 MB 页时一帧 2 MB）。 */
  addrWidth: AddrWidth;
  pageSize: PageSize;
  rootFrame: number;
  tables: Record<number, Record<number, Pte>>;
  tlb: TlbEntry[];
  frameCount: 256;
  freeFrameStart: number;
}

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, path: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)) {
    const parsed = parseInt(value.slice(2), 16);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  throw new ConfigError('必须是非负整数或 0x 十六进制字符串', path);
}

function toFlag(value: unknown, path: string): 0 | 1 {
  if (value === 0 || value === 1) return value;
  throw new ConfigError('必须是 0 或 1', path);
}

function toWidth(value: unknown): AddrWidth {
  if (value === 48 || value === 39) return value;
  throw new ConfigError('只支持 48 或 39', 'addrWidth');
}

function toPageSize(value: unknown): PageSize {
  if (value === 4096 || value === 2097152) return value;
  throw new ConfigError('只支持 4096 或 2097152', 'pageSize');
}

/** 结构层 + 语义层校验，错误路径形如 mappings[3].pa。 */
export function validateSpec(value: unknown): MemSpec {
  if (!isRecord(value)) throw new ConfigError('配置必须是对象', 'config');
  if (value.version !== 1) throw new ConfigError('version 必须为 1', 'version');
  const addrWidth = toWidth(value.addrWidth);
  const pageSize = toPageSize(value.pageSize);
  if (value.frameCount !== FRAME_COUNT) {
    throw new ConfigError(`必须为 ${FRAME_COUNT}`, 'frameCount');
  }
  const rootFrame = toNumber(value.rootFrame, 'rootFrame');
  if (rootFrame >= FRAME_COUNT) throw new ConfigError('帧号越界', 'rootFrame');
  const freeFrameStart =
    value.freeFrameStart === undefined ? 0x030 : toNumber(value.freeFrameStart, 'freeFrameStart');
  if (freeFrameStart >= FRAME_COUNT) throw new ConfigError('帧号越界', 'freeFrameStart');

  const rawMappings = value.mappings;
  if (!Array.isArray(rawMappings) || rawMappings.length === 0) {
    throw new ConfigError('必须是非空数组', 'mappings');
  }
  const mappings = rawMappings.map((item, i): MemSpecMapping => {
    const path = `mappings[${i}]`;
    if (!isRecord(item)) throw new ConfigError('必须是对象', path);
    const mapping: MemSpecMapping = {
      vaBase: toNumber(item.vaBase, `${path}.vaBase`),
      pages: toNumber(item.pages, `${path}.pages`),
      pa: toNumber(item.pa, `${path}.pa`),
      v: toFlag(item.v, `${path}.v`),
      r: toFlag(item.r, `${path}.r`),
      w: toFlag(item.w, `${path}.w`),
      x: toFlag(item.x, `${path}.x`),
      u: toFlag(item.u, `${path}.u`),
      a: toFlag(item.a, `${path}.a`),
      d: toFlag(item.d, `${path}.d`),
    };
    if (mapping.vaBase % pageSize !== 0) {
      throw new ConfigError('必须按页大小对齐', `${path}.vaBase`);
    }
    if (mapping.pages < 1) throw new ConfigError('至少映射 1 页', `${path}.pages`);
    if (mapping.pa % pageSize !== 0) throw new ConfigError('必须按页大小对齐', `${path}.pa`);
    const span = mapping.pages * pageSize;
    if (mapping.vaBase + span > 2 ** addrWidth) {
      throw new ConfigError('超出地址位宽', `${path}.vaBase`);
    }
    if (mapping.pa / pageSize + mapping.pages > FRAME_COUNT) {
      throw new ConfigError('物理帧越界', `${path}.pa`);
    }
    return mapping;
  });

  for (let i = 0; i < mappings.length; i += 1) {
    for (let j = i + 1; j < mappings.length; j += 1) {
      const a = mappings[i];
      const b = mappings[j];
      if (a.vaBase < b.vaBase + b.pages * pageSize && b.vaBase < a.vaBase + a.pages * pageSize) {
        throw new ConfigError('映射区间重叠', `mappings[${j}].vaBase`);
      }
    }
  }

  const rawTlb = value.tlb === undefined ? [] : value.tlb;
  if (!Array.isArray(rawTlb)) throw new ConfigError('必须是数组', 'tlb');
  const tlb = rawTlb.map((item, i): TlbEntry => {
    const path = `tlb[${i}]`;
    if (!isRecord(item)) throw new ConfigError('必须是对象', path);
    return {
      vpn: toNumber(item.vpn, `${path}.vpn`),
      pfn: toNumber(item.pfn, `${path}.pfn`),
      r: toFlag(item.r, `${path}.r`),
      w: toFlag(item.w, `${path}.w`),
      x: toFlag(item.x, `${path}.x`),
      tick: toNumber(item.tick, `${path}.tick`),
      asid: item.asid === undefined ? 0 : toNumber(item.asid, `${path}.asid`),
    };
  });
  if (tlb.length > 8) throw new ConfigError('最多 8 项', 'tlb');

  return {
    version: 1,
    addrWidth,
    pageSize,
    rootFrame,
    frameCount: FRAME_COUNT,
    freeFrameStart,
    mappings,
    tlb,
  };
}

export function parseSpec(text: string): MemSpec {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ConfigError('JSON 解析失败', 'file');
  }
  return validateSpec(data);
}

function cfgOf(spec: MemSpec): Config {
  return {
    addrWidth: spec.addrWidth,
    pageSize: spec.pageSize,
    levels: deriveLevels(spec.addrWidth, spec.pageSize),
    tlbEnabled: false,
    tlbCapacity: 8,
    access: 'read',
  };
}

/** 纯函数：只读 spec，同 spec 两次调用逐字段一致。 */
export function buildMemImage(spec: MemSpec): MemImage {
  const field = deriveLevels(spec.addrWidth, spec.pageSize);
  const cfg = cfgOf(spec);
  const tables: Record<number, Record<number, Pte>> = {};
  let nextFrame = spec.rootFrame;

  const allocTable = (): number => {
    const frame = nextFrame;
    if (frame >= spec.frameCount) throw new ConfigError('页表帧越界', 'rootFrame');
    nextFrame += 1;
    tables[frame] = {};
    return frame;
  };

  const root = allocTable();
  for (const mapping of spec.mappings) {
    for (let page = 0; page < mapping.pages; page += 1) {
      const va = mapping.vaBase + page * spec.pageSize;
      const { indices } = deriveIndices(va, cfg);
      let frame = root;
      for (let level = 0; level < field; level += 1) {
        const index = indices[level];
        const table = tables[frame];
        if (level === field - 1) {
          const existing = table[index];
          if (existing && existing.leaf) throw new ConfigError('叶子重复映射', 'mappings');
          table[index] = {
            v: mapping.v,
            r: mapping.r,
            w: mapping.w,
            x: mapping.x,
            u: mapping.u,
            a: mapping.a,
            d: mapping.d,
            pfn: mapping.pa / spec.pageSize + page,
            leaf: true,
          };
        } else {
          const existing = table[index];
          if (existing) {
            if (existing.leaf) throw new ConfigError('表项层级冲突', 'mappings');
            frame = existing.pfn;
          } else {
            const child = nextFrame;
            if (child >= spec.frameCount) throw new ConfigError('页表帧越界', 'rootFrame');
            nextFrame += 1;
            tables[child] = {};
            table[index] = {
              v: 1,
              r: 1,
              w: 1,
              x: 0,
              u: 0,
              a: 1,
              d: 0,
              pfn: child,
              leaf: false,
            };
            frame = child;
          }
        }
      }
    }
  }

  return {
    addrWidth: spec.addrWidth,
    pageSize: spec.pageSize,
    rootFrame: root,
    tables,
    tlb: spec.tlb.map((entry) => ({ ...entry })),
    frameCount: FRAME_COUNT,
    freeFrameStart: spec.freeFrameStart,
  };
}

/** 取 from 起第一个不在 tables 中的帧。 */
export function allocFrame(mem: MemImage, from: number): number {
  for (let frame = from; frame < mem.frameCount; frame += 1) {
    if (!(frame in mem.tables)) return frame;
  }
  throw new ConfigError('没有空闲帧', 'freeFrameStart');
}
