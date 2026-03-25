# Excel Compare and Import - 二次开发指南

## 📋 项目概述

这是一个飞书多维表格扩展插件，用于将 Excel 数据导入/合并到多维表格中。支持多种字段类型、关联字段、批量导入等功能。

---

## 🏗️ 架构概览

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Vue 3 + TypeScript + Vite | UI 界面和交互逻辑 |
| **后端** | Python + FastAPI | 数据处理（可选） |
| **SDK** | @lark-base-open/js-sdk | 飞书多维表格 API |

### 目录结构

```
client/                          # 前端项目
├── src/
│   ├── components/              # Vue 组件
│   │   ├── setting-form/        # 导入设置表单
│   │   ├── field-setting/       # 字段格式设置
│   │   ├── link-setting/        # 关联字段设置
│   │   ├── concat-setting/      # 【新增】字段拼接设置
│   │   └── ...
│   ├── composables/             # 组合式函数
│   ├── utils/
│   │   ├── import/              # 导入核心逻辑
│   │   │   ├── import.ts        # 主导入函数
│   │   │   └── ...
│   │   └── cellValue/           # 单元格值转换
│   ├── types/
│   │   └── types.ts             # TypeScript 类型定义
│   └── i18n/                    # 国际化
│       ├── zh.ts                # 中文
│       └── en.ts                # 英文
└── ...

server/                          # 后端项目（可选）
├── app/
│   ├── api/                     # API 路由
│   ├── base/                    # Base 操作封装
│   └── data_parser/             # 数据解析
└── ...
```

---

## 🔧 核心概念

### 1. 字段映射 (fieldMap)

`fieldMap` 是多维表格字段与 Excel 字段的映射关系：

```typescript
interface fieldMap {
  key: string                    // 唯一标识
  field: IFieldMeta             // 多维表格字段元数据
  table: string                 // 所属表ID
  excel_field: string | undefined  // 对应的Excel字段名
  config: {
    format?: string | string[]  // 日期格式
    separator?: string          // 分隔符
    boolValue?: { true: string[], false: string[] }  // 布尔值映射
    concatConfig?: ConcatConfig // 【新增】字段拼接配置
  }
  writable: boolean             // 是否可写
  hasChildren: boolean          // 是否有子字段（关联字段）
  children?: fieldMap[]         // 子字段映射
  linkConfig?: {                // 关联字段配置
    allowAdd?: boolean
    primaryKey?: string
  }
}
```

### 2. 导入模式

- **append**: 直接追加记录
- **merge_direct**: 覆盖原记录
- **compare_merge**: 保留原记录（比较后合并）

### 3. 数据流

```
1. 用户上传 Excel 文件
   ↓
2. 解析 Excel 数据 (readXLSX.ts)
   ↓
3. 配置字段映射 (setting-form)
   ↓
4. 执行导入 (import.ts)
   ├─ 分析记录（比较、判断增删改）
   ├─ 处理异步字段（附件、用户等）
   ├─ 批量添加记录
   ├─ 批量更新记录
   └─ 批量删除记录
   ↓
5. 导入完成
```

---

## ✨ 新增功能：多字段拼接

### 功能说明

允许将多个 Excel 字段拼接成一个值，插入到多维表格的单个字段中。

### 使用场景

- 将 "姓" 和 "名" 拼接成 "姓名"
- 将 "省"、"市"、"区" 拼接成完整地址
- 组合多个编号生成唯一标识

### 技术实现

#### 1. 类型定义 (`types/types.ts`)

```typescript
export interface ConcatConfig {
  enabled: boolean      // 是否启用
  fields: string[]      // 要拼接的字段列表
  separator: string     // 分隔符
  order: number[]       // 拼接顺序
}
```

#### 2. 前端组件 (`components/concat-setting/index.vue`)

- 启用/禁用拼接开关
- 多字段选择（el-select-v2）
- 字段顺序调整（上下移动）
- 分隔符设置
- 实时预览

#### 3. 导入逻辑 (`utils/import/import.ts`)

```typescript
// 处理字段拼接
function concatFieldValues(
  record: Record<string, string | null>,
  concatConfig: ConcatConfig,
): string | null {
  // 按顺序获取字段值并拼接
  const values = concatConfig.fields
    .map((fieldName, index) => ({
      value: record[fieldName] ?? "",
      order: concatConfig.order[index] ?? index
    }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.value)
    .filter((v) => v !== null && v !== "")
  
  return values.join(concatConfig.separator)
}
```

#### 4. 在添加策略中应用

```typescript
async function addStrategy(...) {
  let value: string | null = null
  
  // 优先处理字段拼接
  if (fieldMap.config?.concatConfig?.enabled) {
    value = concatFieldValues(record, fieldMap.config.concatConfig)
  } else if (fieldMap.excel_field) {
    value = record[fieldMap.excel_field] ?? null
  }
  
  // 继续处理...
}
```

---

## 🚀 开发环境搭建

### 前置要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
cd client
npm install
```

### 开发模式

```bash
# 开发服务器
npm run dev

# 带 Beta 配置
npm run dev:Beta
```

### 代码规范

```bash
# 格式化代码
npm run style
```

---

## 📦 构建与部署

### 本地构建

```bash
# 生产构建
npm run build

# GitHub Pages 构建
npm run github:build
```

构建产物在 `client/dist` 目录。

### 部署方式

#### 方式 1：飞书扩展脚本（推荐）

1. 在飞书多维表格中打开「扩展脚本」
2. 创建新的扩展脚本
3. 将 `dist/index.html` 的内容复制粘贴
4. 发布扩展脚本

#### 方式 2：GitHub Pages

1. Fork 本仓库
2. 启用 GitHub Pages
3. 配置 Actions 自动部署

#### 方式 3：自有服务器

```bash
# 构建后将 dist 目录部署到 Web 服务器
scp -r dist/* user@server:/var/www/html/
```

---

## 🔌 后端部署（可选）

后端主要用于处理大量数据或复杂计算。

### 安装依赖

```bash
cd server
pip install uv
uv sync
```

### 运行

```bash
# 开发模式
uv run main.py

# Docker 部署
docker-compose up -d
```

---

## 🧪 测试

```bash
# 运行单元测试
npm run test

# 运行测试（带 UI）
npm run test:ui
```

---

## 📝 添加新功能的步骤

以添加 "字段拼接" 功能为例：

### 1. 定义类型

```typescript
// types/types.ts
export interface ConcatConfig {
  enabled: boolean
  fields: string[]
  separator: string
  order: number[]
}

// 添加到 fieldMap.config
interface fieldMap {
  config: {
    concatConfig?: ConcatConfig
  }
}
```

### 2. 创建配置组件

```vue
<!-- components/concat-setting/index.vue -->
<template>
  <!-- 字段选择、顺序调整、分隔符设置 -->
</template>
```

### 3. 修改导入逻辑

```typescript
// utils/import/import.ts
function concatFieldValues(...) { ... }

// 在 addStrategy 中调用
```

### 4. 添加到设置表单

```vue
<!-- setting-form/index.vue -->
<concatSetting
  ref="concatRef"
  @confirmConcat="setConcatConfig"
/>
```

### 5. 更新国际化

```typescript
// i18n/zh.ts 和 i18n/en.ts
{
  h: { concatSetting: "字段拼接设置" },
  form: { label: { enableConcat: "启用字段拼接" } }
}
```

### 6. 配置导入导出

确保配置可以保存和恢复。

---

## 🐛 调试技巧

### 1. 使用日志

```typescript
import { Log, Error, Warn, Info } from "@/utils"

Log({ title: "Debug", message: "Something happened" })
Error({ title: "Error", message: "Error details", error: e })
```

### 2. 查看运行日志

点击界面右上角的 🐛 图标查看运行日志。

### 3. 浏览器开发者工具

```javascript
// 在控制台访问 SDK
const { bitable } = await import("@lark-base-open/js-sdk")
const table = await bitable.base.getActiveTable()
```

---

## 📚 相关资源

- [飞书多维表格扩展脚本开发指南](https://bytedance.feishu.cn/docx/VxhudDXbyo1V7jxAcTbctJQ5nvc)
- [多维表格扩展脚本开发指南（中文）](https://bytedance.feishu.cn/docx/HazFdSHH9ofRGKx8424cwzLlnZc)
- [使用指南](https://ct8hv7vfy1.feishu.cn/docx/EOALdRssWoxksuxy7gucmECQnEc)

---

## 💡 常见问题

### Q: 如何处理新的字段类型？

1. 在 `utils/cellValue/` 下创建新的转换器
2. 继承 `BaseTranslator`
3. 实现 `match` 和 `trans` 方法
4. 注册到 `cellTranslator`

### Q: 如何修改导入批量大小？

修改 `utils/import/const.ts`：

```typescript
export const ADD_RECORDS_LIMIT = 5000
export const UPDATE_RECORDS_LIMIT = 5000
```

### Q: 如何添加新的导入模式？

1. 在 `types.ts` 的 `importModes` 枚举中添加新模式
2. 在 `import.ts` 中实现对应的处理逻辑
3. 在 UI 中添加模式选择

---

## 📄 License

MIT License
