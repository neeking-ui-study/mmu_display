# mmu_display

把 MMU 的多级页表 walk 过程做成可逐步回放的动画：地址拆分、TLB 查询、逐级读表、缺页 / 权限异常、物理地址合成，每一步都有对应的高亮与旁白。

固定 1440×900 视口，纯前端、无后端，状态全部来自内存中的配置。

## 线上站点

https://37lw7xwbr6qd6xr5rcp.traesite.cn

- 更新代码后重新 `npm run build` 并重新部署即可，URL 保持不变。
- 站点部署在域名根路径，Vite 的 `base` 保持默认 `/` 即可。

## 本地运行

要求 Node.js ≥ 20.19（Vite 7 的最低版本）。

```bash
npm ci          # 安装依赖，或 npm install
npm run dev     # 开发模式，默认 http://localhost:5173
npm test        # vitest 单测
npm run typecheck
npm run build   # tsc --noEmit + vite build，产物在 dist/
npm run preview # 构建后预览，默认 http://localhost:4173
```

预览构建产物时先 `npm run build`，再 `npm run preview`。不要直接双击 `dist/index.html` 用 `file://` 打开：浏览器会以 CORS 限制拦截模块脚本，且产物里的资源引用是 `/assets/...` 这类绝对路径，直接打开会白屏或 404；需要通过 `npm run preview` 或任意静态服务器访问。

## 目录与职责

```
configs/                A–H 场景的页表配置 JSON（G 复用 a-tlb-hit.json，由装配层补 TLB）
src/
  main.tsx              React 入口
  app.tsx               应用外壳：工具栏、模型状态、错误条、场景 / 地址 / 配置载入
  types.ts              AddrWidth、PageSize、Config、Pte、TlbEntry、Step、ViewRef 等契约
  config.ts             位段表（唯一来源）、deriveLevels / deriveIndices、PAGE_SIZES
  layout.ts             1440×900 下的区域坐标与尺寸常量
  tokens.ts             颜色与字体 token
  data/
    memory.ts           MemSpec / MemImage、validateSpec、parseSpec、buildMemImage
    configDoc.ts        载入配置文档：MemSpec + 可选 va / access / tlbEnabled
    scenarios.ts        A–H 场景装配，场景下拉的位宽 / 页大小元数据
    controls.ts         控件注册表（plain / register 两套标签与寄存器说明）
  engine/
    run.ts              run(va, cfg, mem) → Step[]，纯函数，每步产出完整快照
    walk.ts             逐级读表
    tlb.ts              TLB 查找、填入、LRU 淘汰
    fault.ts            缺页回填与权限判定
  player/
    usePlayer.ts        游标、播放 / 暂停、调速
  view/
    AddressBar.tsx      地址位条（每 3 位一格，索引段与偏移段）
    TableTree.tsx       页表区，每级 16 格窗口 + 折叠计数
    TlbPanel.tsx        TLB 8 行表格
    MemPanel.tsx        物理内存 16×16 帧格
    NarrationPanel.tsx  旁白区
    Timeline.tsx        时间轴
  tests/                run.spec.ts、configDoc.spec.ts
```

分层依赖：`view → player → engine → data → config/types`，视图只读 `Step`，不自己算索引或物理地址。

## 场景一览（A–H）

| id | 场景 | 位宽 / 页大小 | 级数 | 步数 |
| -- | ---- | ------------- | ---- | ---- |
| A | TLB 命中 | 48 位 / 4 KB | 4 | 4 |
| B | TLB 缺失 + 4 级 walk | 48 位 / 4 KB | 4 | 9 |
| C | 纯 walk（TLB 关） | 48 位 / 4 KB | 4 | 6 |
| D | 页缺失回填 | 48 位 / 4 KB | 4 | 12 |
| E | 权限异常 | 48 位 / 4 KB | 4 | 9 |
| F | 39 位三级对照 | 39 位 / 4 KB | 3 | 5 |
| G | TLB 满淘汰 | 48 位 / 4 KB | 4 | 10 |
| H | 2 MB block walk | 48 位 / 2 MB | 3 | 8 |

场景下拉的每一项都标注了该场景的位宽与页大小，例如 `H · 48 位 · 2 MB`。

## 配置格式

`configs/*.json` 是页表的语义描述，由 `buildMemImage` 展开成内存镜像；不允许预置 Step。

```json
{
  "version": 1,
  "va": "0x123456789AB",
  "tlbEnabled": true,
  "addrWidth": 48,
  "pageSize": 2097152,
  "rootFrame": "0x001",
  "frameCount": 256,
  "freeFrameStart": "0x030",
  "mappings": [
    {
      "vaBase": "0x12345600000",
      "pages": 1,
      "pa": "0x08000000",
      "v": 1, "r": 1, "w": 1, "x": 1, "u": 1, "a": 1, "d": 0
    }
  ],
  "tlb": []
}
```

- 必填：`version`（固定 1）、`addrWidth`（48 / 39）、`pageSize`（4096 / 2097152）、`rootFrame`、`frameCount`（固定 256）、`mappings`、`tlb`。
- 可选：`freeFrameStart`（默认 0x030）、`va`（载入后直接复现的地址，缺省取首个 mapping 的 vaBase）、`access`（read / write / exec，默认 read）、`tlbEnabled`（默认由 `tlb` 是否为空决定）。
- 数值字段既可写整数，也可写 `"0x..."` 字符串。
- 校验：`vaBase` / `pa` 按页大小对齐，映射区间不得重叠，物理帧号 ≤ 255，`tlb` 最多 8 项，末级 PTE 组合合法；报错带字段路径，如 `mappings[3].pa`。

## 三种加载方式

1. **内置场景**：工具栏「场景」下拉选择 A–H，内置配置随包发布。
2. **文件选择或拖入**：点「载入…」选择 `.json`，或把文件直接拖进页面。载入失败时保留当前配置，只显示错误条。
3. **URL 参数**：`?config=./configs/a-tlb-hit.json`，支持相对或绝对地址；启动时自动载入，失败同样只出错误条。

## 双视角

- `plain`：控件用中文语义名，如「页大小」。
- `register`：控件用寄存器名与位域，如 `TCR_EL1.TG0`，并在控件下常驻一行说明，同时标注「模拟值，非真实寄存器写入」。

用工具栏「视角」切换，或通过 `?view=register` 直接进入；切换视角只换标签，不重新 `run`、不重置游标。

## 已知限制

- 物理内存固定 256 帧；TLB 容量固定 8 项；仅模拟单地址空间（`asid` 恒为 0）。
- 位宽 / 页大小下拉不会重建页表：与当前配置不匹配时只出错误条并提示「载入匹配配置或换场景」，原配置保持不变；要换组合请载入对应配置或切换场景。
- 不建模非末级表项 `v=0`（构造期直接报错）；缺页只做「取最小空闲帧 → 回填 PTE → 重读」三步，无磁盘 I/O。
- 布局固定 1440×900，不做响应式缩放。
- 无持久化：刷新后回到默认场景（除非 URL 带 `?config=`）。
