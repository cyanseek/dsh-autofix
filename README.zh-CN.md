# dsh-autofix

[English](README.md)

> DSH 报错后别停：自动重试、自动刷新、自动换路，任务继续跑。

安装一次，然后照常使用 DeepSeek Harness。命中支持范围的错误时给出一次明确恢复动作；未知错误保持不变。

- Web 或 API 瞬时错误：重试一次
- 编辑期间文件变化：刷新当前上下文
- 当前系统缺少命令：使用已安装的等价命令
- 常见 DSH 错误：给 Agent 可直接执行的下一步

## 安装

```bash
npx -y dsh-autofix install
```

完成。之后正常使用 DSH。

## 使用前后

### Web 工具返回 502

```text
以前：HTTP 502 → 任务暂停 → 用户说“继续”
现在：HTTP 502 → AutoFix 要求重试一次 → 任务继续
```

### 编辑时文件发生变化

```text
以前：old text not found → 用户转述错误 → Agent 再读取
现在：old text not found → AutoFix 刷新有界片段 → Agent 重新编辑
```

### 不同平台的命令名称不同

```text
以前：找不到 rg → 任务停止
现在：找不到 rg → AutoFix 找到已安装的等价命令 → Agent 继续
```

## 恢复 Recipe

| Recipe | 识别范围 | 动作 |
| --- | --- | --- |
| 瞬时工具错误 | 限流、部分 408/5xx、超时和传输重置 | 要求 Agent 对同一操作重试一次，再失败就换方案 |
| 过期文件上下文 | 明确的编辑过期和替换未命中错误 | DSH 文件服务可用时附加当前文件的有界片段 |
| 命令替代 | Shell 工具的 command-not-found 错误 | 只推荐当前 PATH 中真实存在的第一个等价命令 |
| DSH Error Atlas | 一组受控且有版本的常见 DSH 错误 | 附加简短下一步，不改写 profile 或 session 数据 |

公开目录见 [`recipes/catalog.json`](recipes/catalog.json)。欢迎通过 [Recipe 需求表单](https://github.com/cyanseek/dsh-autofix/issues/new?template=recipe.yml) 补充常见错误。

## 零打断契约

dsh-autofix 只在工具已经失败后工作。它不增加审批弹窗、不修改工具参数、不改变成功结果、不安装系统命令、不要求额外服务，也不增加 UI。

同一错误在短窗口内最多触发一次恢复。第二次相同失败保持可见，让 Agent 换方案。取消会停止待处理的恢复工作；卸载会移除插件和随包 Skill。

未知错误保持原样。

## 兼容性

当前版本已经在真实 `@deepseek-ai/dsh-tools` `0.1.0-rc.6` 运行时上验证。Linux/WSL 的 Node.js `24.19.0` 与 Windows 的 Node.js `22.19.0` 均已通过严格类型检查、构建和完整测试。Windows CLI 路径也已通过 WSL 互操作，在隔离的真实 DSH profile 上完成安装、重复安装、生效配置和卸载检查。独立 Windows 客户端运行与原生 macOS 安装仍需发布候选验证。

准确证据与限制见[兼容矩阵](docs/COMPATIBILITY.md)。

## 高级 Test Kit

维护者可以运行随包提供的确定性恢复检查：

```bash
dsh-autofix test --scenario transient-tool-error --json
```

可用场景为 `transient-tool-error`、`stale-file`、`command-alternative` 和 `error-atlas`。

插件作者可以导入稳定的 Recipe 接口：

```ts
import { applyRecipes } from 'dsh-autofix'
import type { AutoFixRecipe } from 'dsh-autofix/recipes'

const recipes: AutoFixRecipe[] = [myRecipe]
applyRecipes(ctx, recipes)
```

该高级入口应放入一个自定义 bundle，不要再同时挂载默认 bundle。Recipe 按 priority 降序执行，重复 ID 会立即报错。

旧的确定性故障引擎继续作为高级回归测试工具提供：

```ts
import { ChaosEngine } from 'dsh-autofix/testkit'
```

普通用户无需使用 Test Kit。

## 开发与贡献

```bash
npm ci --ignore-scripts
npm run check
```

一个恢复贡献应保持很小：一个 Recipe、一个确定性回归测试和一个简短目录条目。提交前请阅读 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。

## 许可证

[MIT](LICENSE)
