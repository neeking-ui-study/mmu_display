import { deriveLevels } from '../config';
import { ConfigError } from '../types';
import type { AccessKind, Config } from '../types';
import { validateSpec } from './memory';
import type { MemSpec } from './memory';

const ACCESS_KINDS: AccessKind[] = ['read', 'write', 'exec'];

export interface LoadedConfig {
  spec: MemSpec;
  va: number;
  access: AccessKind;
  tlbEnabled: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseVa(value: unknown, addrWidth: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    if (value >= 2 ** addrWidth) throw new ConfigError('地址超出位宽', 'va');
    return value;
  }
  if (typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)) {
    const parsed = parseInt(value.slice(2), 16);
    if (Number.isSafeInteger(parsed) && parsed < 2 ** addrWidth) return parsed;
    throw new ConfigError('地址超出位宽', 'va');
  }
  throw new ConfigError('必须是非负整数或 0x 十六进制字符串', 'va');
}

/**
 * 载入配置文档：`MemSpec` 加可选的 `va` / `access` / `tlbEnabled`。
 * 校验全部走 `validateSpec`，错误路径沿用 `mappings[i].pa` 之类。
 */
export function parseConfigDoc(text: string): LoadedConfig {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ConfigError('JSON 解析失败', 'file');
  }
  if (!isRecord(data)) throw new ConfigError('配置必须是对象', 'config');

  const spec = validateSpec(data);
  const va = data.va === undefined ? spec.mappings[0].vaBase : parseVa(data.va, spec.addrWidth);

  let access: AccessKind = 'read';
  if (data.access !== undefined) {
    if (!ACCESS_KINDS.includes(data.access as AccessKind)) {
      throw new ConfigError('只支持 read / write / exec', 'access');
    }
    access = data.access as AccessKind;
  }

  let tlbEnabled = spec.tlb.length > 0;
  if (data.tlbEnabled !== undefined) {
    if (typeof data.tlbEnabled !== 'boolean') throw new ConfigError('必须是布尔值', 'tlbEnabled');
    tlbEnabled = data.tlbEnabled;
  }

  return { spec, va, access, tlbEnabled };
}

/** 由载入结果生成运行配置；levels 按位宽与页大小推导。 */
export function configOfLoaded(loaded: LoadedConfig): Config {
  return {
    addrWidth: loaded.spec.addrWidth,
    pageSize: loaded.spec.pageSize,
    levels: deriveLevels(loaded.spec.addrWidth, loaded.spec.pageSize),
    tlbEnabled: loaded.tlbEnabled,
    tlbCapacity: 8,
    access: loaded.access,
  };
}
