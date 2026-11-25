import { describe, expect, it } from 'vitest';
import { parseSpec } from '../data/memory';
import { loadScenario } from '../data/scenarios';
import { run } from '../engine/run';
import { ConfigError } from '../types';
import type { Step } from '../types';

const kinds = (steps: Step[]) =>
  steps.map((step) => (step.level === null ? step.kind : `${step.kind}:${step.level}`));

function execute(id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H') {
  const scenario = loadScenario(id);
  return { scenario, steps: run(scenario.va, scenario.cfg, scenario.mem) };
}

describe('A TLB 命中', () => {
  it('4 步且结果正确', () => {
    const { steps } = execute('A');
    expect(steps).toHaveLength(4);
    expect(kinds(steps)).toEqual(['addr_split', 'tlb_lookup', 'tlb_hit', 'done']);
    expect(steps[0].state.indices).toEqual([0x002, 0x08d, 0x02b, 0x078]);
    expect(steps[0].state.offset).toBe(0x9ab);
    expect(steps.at(-1)!.state.result).toEqual({ pfn: 0x021, pa: 0x219ab });
  });
});

describe('B TLB 缺失 + 4 级 walk', () => {
  it('9 步且回填一项', () => {
    const { steps } = execute('B');
    expect(steps).toHaveLength(9);
    expect(kinds(steps)).toEqual([
      'addr_split',
      'tlb_lookup',
      'tlb_miss',
      'walk_read:0',
      'walk_read:1',
      'walk_read:2',
      'walk_leaf:3',
      'tlb_fill',
      'done',
    ]);
    expect(steps.at(-1)!.state.tlb).toHaveLength(1);
    expect(steps.at(-1)!.state.result?.pa).toBe(0x219ab);
  });
});

describe('C 纯 walk（TLB 关）', () => {
  it('6 步且不查 TLB', () => {
    const { steps } = execute('C');
    expect(steps).toHaveLength(6);
    expect(kinds(steps)).toEqual([
      'addr_split',
      'walk_read:0',
      'walk_read:1',
      'walk_read:2',
      'walk_leaf:3',
      'done',
    ]);
    expect(steps.at(-1)!.state.result?.pa).toBe(0x219ab);
  });
});

describe('D 页缺失回填', () => {
  it('12 步，故障在 L3[0x078]，回填后 PA 指向空闲帧', () => {
    const { steps } = execute('D');
    expect(steps).toHaveLength(12);
    const fault = steps.find((step) => step.kind === 'fault_page');
    expect(fault?.state.fault).toEqual({ kind: 'page', level: 3, index: 0x078 });
    const final = steps.at(-1)!.state;
    expect(final.result).toEqual({ pfn: 0x030, pa: 0x309ab });
    expect(final.tlb).toHaveLength(1);
  });
});

describe('E 权限异常', () => {
  it('9 步，最后无物理地址', () => {
    const { steps } = execute('E');
    expect(steps).toHaveLength(9);
    expect(kinds(steps).slice(-2)).toEqual(['fault_perm:3', 'done']);
    const final = steps.at(-1)!.state;
    expect(final.fault).toEqual({ kind: 'perm', level: 3, index: 0x078 });
    expect(final.result).toBeNull();
  });
});

describe('F 39 位三级对照', () => {
  it('5 步且索引为 3 段', () => {
    const { steps } = execute('F');
    expect(steps).toHaveLength(5);
    expect(kinds(steps)).toEqual([
      'addr_split',
      'walk_read:0',
      'walk_read:1',
      'walk_leaf:2',
      'done',
    ]);
    expect(steps[0].state.indices).toEqual([0x1fc, 0x091, 0x145]);
    expect(steps.at(-1)!.state.result?.pa).toBe(0x22678);
  });
});

describe('G TLB 满淘汰', () => {
  it('10 步，满 8 项后先淘汰再回填', () => {
    const { steps } = execute('G');
    expect(steps).toHaveLength(10);
    expect(kinds(steps).slice(-3)).toEqual(['tlb_evict', 'tlb_fill', 'done']);
    expect(steps.at(-1)!.state.tlb).toHaveLength(8);
  });
});

describe('H 2 MB block walk', () => {
  it('3 级 8 步，末级为 block 映射', () => {
    const { scenario, steps } = execute('H');
    expect(scenario.cfg.pageSize).toBe(2097152);
    expect(scenario.cfg.levels).toBe(3);
    expect(steps).toHaveLength(8);
    expect(kinds(steps)).toEqual([
      'addr_split',
      'tlb_lookup',
      'tlb_miss',
      'walk_read:0',
      'walk_read:1',
      'walk_leaf:2',
      'tlb_fill',
      'done',
    ]);
    expect(steps[0].state.indices).toEqual([0x002, 0x08d, 0x02b]);
    expect(steps[0].state.offset).toBe(0x789ab);
  });

  it('21 位 offset 合成与回拼一致', () => {
    const { scenario, steps } = execute('H');
    const first = steps[0].state;
    const reassembled =
      first.indices.reduce((acc, index, i) => acc + index * 2 ** (21 + 9 * (2 - i)), 0) +
      first.offset;
    expect(reassembled).toBe(scenario.va);

    const final = steps.at(-1)!.state;
    expect(final.result?.pfn).toBe(0x40);
    expect(final.result?.pa).toBe(0x80789ab);
    expect((final.result!.pa! & 0x1fffff)).toBe(first.offset);
    expect(Math.floor(final.result!.pa! / 2097152)).toBe(0x40);
  });
});

describe('确定性与入参校验', () => {
  it('同一输入两次 run 结果逐字段一致', () => {
    const scenario = loadScenario('D');
    const first = run(scenario.va, scenario.cfg, scenario.mem);
    const second = run(scenario.va, scenario.cfg, scenario.mem);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('地址超出位宽抛 ConfigError', () => {
    const scenario = loadScenario('A');
    expect(() => run(2 ** 48, scenario.cfg, scenario.mem)).toThrow(ConfigError);
  });

  it('levels 与位宽/页大小不符抛 ConfigError', () => {
    const scenario = loadScenario('A');
    expect(() => run(scenario.va, { ...scenario.cfg, levels: 3 }, scenario.mem)).toThrow(
      ConfigError,
    );
  });

  it('页表位宽与当前配置不匹配抛 ConfigError', () => {
    const scenario = loadScenario('A');
    expect(() =>
      run(scenario.va, { ...scenario.cfg, addrWidth: 39, levels: 3 }, scenario.mem),
    ).toThrow(/mem\.addrWidth/);
  });

  it('页表页大小与当前配置不匹配抛 ConfigError', () => {
    const scenario = loadScenario('A');
    expect(() =>
      run(scenario.va, { ...scenario.cfg, pageSize: 2097152, levels: 3 }, scenario.mem),
    ).toThrow(/mem\.pageSize/);
  });

  it('非法 JSON 报字段路径', () => {
    expect(() => parseSpec('{')).toThrow(ConfigError);
    const broken = {
      version: 1,
      addrWidth: 48,
      pageSize: 4096,
      rootFrame: 1,
      frameCount: 256,
      mappings: [{ vaBase: 0x12345678000, pages: 1, pa: 0x21001, v: 1, r: 1, w: 1, x: 1, u: 1, a: 1, d: 0 }],
      tlb: [],
    };
    expect(() => parseSpec(JSON.stringify(broken))).toThrow(/mappings\[0\]\.pa/);
  });
});
