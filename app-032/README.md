# 花灯骨架放样与蒙面裁片 · Lantern Frame Lofting

纯前端工具：选灯型 → 填直径/高度/收口 → 出「每根竹篾截多长、弯什么角度」的骨架件表、带缝份的蒙面裁片、以及可 100% 打印的 1:1 放样图与备料单。无后端、无网络请求，断网可用。

## 技术栈

- Vue 3（`<script setup>` 单文件组件）+ TypeScript + Vite 6
- 状态：Vue 自带 `ref / reactive / computed / watch`（无 Pinia / Vuex）
- 额外依赖仅 `vue-router` 4（规格书要求的 6 个路由）
- 手写 CSS；无 UI 组件库、无图表库、无游戏引擎/物理库
- 字体、灯型数据包（`src/data/lantern-types.json`）全部本地打包，无外网 CDN

## 目录结构

```
.
├─ index.html
├─ package.json / tsconfig.json / vite.config.ts
├─ Dockerfile / docker-compose.yml / nginx.conf
├─ .dockerignore / .gitignore
├─ lantern-frame-lofting.md          # 规格书（只读，未改动）
└─ src/
   ├─ main.ts / App.vue / env.d.ts
   ├─ router/index.ts                # 6 个路由
   ├─ components/
   │  ├─ LanternPreview.vue          # 正视 / 俯视 / 等轴测 + 可拖动贝塞尔控制点
   │  ├─ PanelDiagram.vue            # 裁片尺寸箭头 + 缝份虚线 + 对位十字
   │  └─ ChecksPanel.vue             # 断言结果面板（CHK-01 ~ CHK-09）
   ├─ core/
   │  ├─ types.ts                    # 数据模型（规格书 §7）
   │  ├─ geometry.ts                 # 轮廓 / 分段 / 周长 / 面积 / 体积
   │  ├─ frame.ts                    # 骨架构件表（净长 + 绑扎余量）
   │  ├─ panels.ts                   # 展开裁片（含缝份与对位标记）
   │  ├─ materials.ts                # 备料统计与批量汇总
   │  ├─ craft.ts                    # 工艺参数、蒙面类型
   │  ├─ paginate.ts                 # 1:1 分页（裁片不跨页、长条搭接）
   │  ├─ checks.ts                   # computeAll + CHK-01~09 断言
   │  ├─ exporter.ts                 # CSV 导出
   │  └─ store.ts                    # localStorage 灯样库
   └─ views/                         # / · /design · /frame · /panels · /print · /materials
```

## 启动

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # vue-tsc --noEmit && vite build
npm run preview
```

## Docker 构建

```bash
docker compose build
docker compose up -d            # http://localhost:8112
curl http://localhost:8112/healthz
docker compose down
```

多阶段：`node:20-alpine` 构建 → `nginx:1.27-alpine` 只托管 `dist/` 与 `nginx.conf`（SPA 回退、哈希资源 immutable、index.html no-cache、gzip、SVG MIME、`/healthz` 健康检查）。

## 验收结果（规格书 §10）

| 用例 | 结果 | 关键证据 |
| --- | --- | --- |
| 几何手算核对 | 通过 | 正六棱柱底边(D200) 100.000 / 手算 100.000（Δ0.000）；正八棱柱 76.537 / 76.537；圆形周长 628.319 / 628.319；六边形周长 600.000 / 600.000 |
| 竖篾 = 分段高累计 | 通过 | 六角宫灯：竖篾净长 467.6mm，分段高累计 420.0，母线折线长累计 467.6（收口段横向偏移 47.6mm），Δ折线 0.0mm |
| 缝份 = 净尺寸 + 缝份×边数 | 通过 | 6/6 种裁片三向均 = 净尺寸 + 10.0×2mm；图上实线=裁切线、绿色虚线=净样 |
| 备料守恒 | 通过 | 六角宫灯 Σ备料 7.148m / Σ净长 6.308m，差值 840.0mm = 余量总和；莲花灯 Σ备料 8.621m / Σ净长 8.101m，差 520.0mm |
| 面积核对 | 通过 | 六角宫灯 裁片净面积 0.373m² / 灯体表面积 0.373m² = 100.03%；莲花灯 0.317 / 0.315 = 100.64%（∈[0.97,1.03]） |
| 分页 | 通过 | 6 种裁片每块只出现在一页且完整，超区整块输出 0 块；跨页仅骨架长条，带对位十字与搭接 10.0mm |
| 批量守恒 | 通过 | 20 个 × 1.10 损耗：竹篾 7.148 → 157.256m（= 7.148×20×1.10）；蒙面 0.508 → 11.176m²；扎线 21.000 → 462.000m；胶 12.7 → 279.4g；净长/净面积等几何量只 ×20；LED 12 → 240 颗（整数，不记损耗） |
| 材料口径一致 | 通过 | 扎线 = 绑扎总处数 42 处 × 0.5m/处 = 21.000m；胶 = 含缝份裁片面积 0.508m² × 绸布 25g/m² = 12.7g（换宣纸 45g/m² → 22.9g）；材料页 / 备料单 CSV / 裁片页含缝份面积 / 骨架件表净长同一份数 |
| 1:1 打印 | 通过 | `@page { size: 210mm 297mm; margin: 0 }`，图纸宽 793.6875px = 210.0mm；100mm 校验尺实测 377.946px = 99.9991mm（误差 0.0009mm ≤ 1mm） |
| 性能 | 通过 | 计算耗时 0.7 ~ 2.1ms（< 100ms） |

自检面板（每页底部）显示 **9 / 9 通过**，浏览器控制台无报错、无警告。
