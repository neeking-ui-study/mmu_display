import { describe, expect, it } from 'vitest';
import aSpec from '../../configs/a-tlb-hit.json';
import hSpec from '../../configs/h-2m-block.json';
import { configOfLoaded, parseConfigDoc } from '../data/configDoc';
import { buildMemImage } from '../data/memory';
import { run } from '../engine/run';
import { ConfigError } from '../types';

describe('配置文档载入', () => {
  it('缺省取首个映射的 vaBase，TLB 有表项时默认开启', () => {
    const loaded = parseConfigDoc(JSON.stringify(aSpec));
    expect(loaded.va).toBe(0x12345678_000);
    expect(loaded.access).toBe('read');
    expect(loaded.tlbEnabled).toBe(true);
    const cfg = configOfLoaded(loaded);
    expect(cfg).toMatchObject({ addrWidth: 48, pageSize: 4096, levels: 4, tlbCapacity: 8 });
    const steps = run(loaded.va, cfg, buildMemImage(loaded.spec));
    expect(steps.at(-1)!.state.result?.pa).toBe(0x21000);
  });

  it('可覆盖 va / access / tlbEnabled 并直接运行', () => {
    const doc = { ...aSpec, va: '0x12345678000', access: 'write', tlbEnabled: false };
    const loaded = parseConfigDoc(JSON.stringify(doc));
    expect(loaded).toMatchObject({ va: 0x12345678000, access: 'write', tlbEnabled: false });
    const cfg = configOfLoaded(loaded);
    expect(cfg.tlbEnabled).toBe(false);
    const steps = run(loaded.va, cfg, buildMemImage(loaded.spec));
    expect(steps[0].kind).toBe('addr_split');
    expect(steps.some((step) => step.kind === 'tlb_lookup')).toBe(false);
  });

  it('H fixture 自带 va 与 tlbEnabled，载入后与内置 H 场景一致', () => {
    const loaded = parseConfigDoc(JSON.stringify(hSpec));
    expect(loaded.va).toBe(0x123456789ab);
    expect(loaded.tlbEnabled).toBe(true);
    const cfg = configOfLoaded(loaded);
    expect(cfg).toMatchObject({ addrWidth: 48, pageSize: 2097152, levels: 3 });
    const steps = run(loaded.va, cfg, buildMemImage(loaded.spec));
    expect(steps).toHaveLength(8);
    expect(steps.at(-1)!.state.result?.pa).toBe(0x80789ab);
  });

  it('va 超位宽报 va 路径', () => {
    const doc = { ...aSpec, va: '0x1_0000_0000_0000' };
    expect(() => parseConfigDoc(JSON.stringify(doc))).toThrow(/^va: /);
  });

  it('access 非法报 access 路径', () => {
    const doc = { ...aSpec, access: 'jump' };
    expect(() => parseConfigDoc(JSON.stringify(doc))).toThrow(/^access: /);
  });

  it('JSON 解析失败报 file 路径', () => {
    expect(() => parseConfigDoc('{')).toThrow(ConfigError);
    expect(() => parseConfigDoc('{')).toThrow(/^file: /);
  });
});
