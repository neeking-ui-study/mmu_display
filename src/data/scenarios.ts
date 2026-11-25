import aSpec from '../../configs/a-tlb-hit.json';
import bSpec from '../../configs/b-walk-4level.json';
import cSpec from '../../configs/c-walk-no-tlb.json';
import dSpec from '../../configs/d-page-fault.json';
import eSpec from '../../configs/e-perm-fault.json';
import fSpec from '../../configs/f-39bit.json';
import hSpec from '../../configs/h-2m-block.json';
import { deriveLevels } from '../config';
import type { AddrWidth, Config, PageSize, TlbEntry } from '../types';
import { buildMemImage, validateSpec } from './memory';
import type { MemImage, MemSpec } from './memory';

export type ScenarioId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface Scenario {
  id: ScenarioId;
  name: string;
  va: number;
  cfg: Config;
  mem: MemImage;
}

const SCENARIO_NAMES: Record<ScenarioId, string> = {
  A: 'TLB 命中',
  B: 'TLB 缺失 + 4 级 walk',
  C: '纯 walk（TLB 关）',
  D: '页缺失回填',
  E: '权限异常',
  F: '39 位三级对照',
  G: 'TLB 满淘汰',
  H: '2 MB block walk（3 级）',
};

export interface ScenarioMeta {
  id: ScenarioId;
  name: string;
  addrWidth: AddrWidth;
  pageSize: PageSize;
}

const VA_48 = 0x0000_0123_4567_89ab;
const VA_39 = 0x7f_1234_5678;

const SPECS: Record<Exclude<ScenarioId, 'G'>, unknown> = {
  A: aSpec,
  B: bSpec,
  C: cSpec,
  D: dSpec,
  E: eSpec,
  F: fSpec,
  H: hSpec,
};

const TLB_OFF: ScenarioId[] = ['C', 'F'];
const WRITE_ACCESS: ScenarioId[] = ['E'];

function fullTlb(): TlbEntry[] {
  return Array.from({ length: 8 }, (_, i) => ({
    vpn: 0x100 + i,
    pfn: 0x040 + i,
    r: 1,
    w: 1,
    x: 1,
    tick: i + 1,
    asid: 0,
  }));
}

function specOf(id: ScenarioId): MemSpec {
  if (id === 'G') return { ...validateSpec(aSpec), tlb: fullTlb() };
  return validateSpec(SPECS[id]);
}

/** 场景下拉元数据：id、名称与该场景配置的位宽 / 页大小。 */
export const SCENARIO_LIST: ScenarioMeta[] = (
  Object.keys(SCENARIO_NAMES) as ScenarioId[]
).map((id) => {
  const spec = specOf(id);
  return {
    id,
    name: SCENARIO_NAMES[id],
    addrWidth: spec.addrWidth,
    pageSize: spec.pageSize,
  };
});

export function loadScenario(id: ScenarioId): Scenario {
  const spec = specOf(id);
  const cfg: Config = {
    addrWidth: spec.addrWidth,
    pageSize: spec.pageSize,
    levels: deriveLevels(spec.addrWidth, spec.pageSize),
    tlbEnabled: !TLB_OFF.includes(id),
    tlbCapacity: 8,
    access: WRITE_ACCESS.includes(id) ? 'write' : 'read',
  };
  return {
    id,
    name: SCENARIO_NAMES[id],
    va: id === 'F' ? VA_39 : VA_48,
    cfg,
    mem: buildMemImage(spec),
  };
}
