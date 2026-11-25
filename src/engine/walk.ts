import { ConfigError } from '../types';
import type { Pte } from '../types';

/** 读一级表项；非末级表项缺失属于未建模的「建表」，构造期即拦截。 */
export function readLevel(
  tables: Record<number, Record<number, Pte>>,
  frame: number,
  index: number,
): Pte {
  const table = tables[frame];
  if (!table) throw new ConfigError('表帧不存在', `tables[0x${frame}]`);
  const pte = table[index];
  if (!pte) throw new ConfigError('表项缺失', `tables[0x${frame}][0x${index}]`);
  return pte;
}
