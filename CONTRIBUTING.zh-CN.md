# 为 dsh-autofix 贡献

[English](CONTRIBUTING.md)

感谢你帮助 DSH 任务减少报错后的中断。

## 先提交 Recipe 需求

新增错误类型请使用 Recipe Issue 表单，并提供完整的去敏错误、准确的 DSH/Node/OS 版本、工具名、当前手工恢复方式和最小复现。不要提交凭据或私密 session 数据。

一个良好的贡献包含：

1. 一个窄范围匹配的 Recipe；
2. 一个确定性回归测试；
3. `recipes/catalog.json` 中一个简短条目。

未知错误必须保持原样。Recipe 不得增加审批、安装软件、任意重写命令、修改 profile/session 数据或改变成功工具结果。

## 开发

要求 Node.js 22.19+ 与 npm。

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify
npm pack --dry-run
```

`npm run check` 会执行完整本地门禁。测试使用合成数据和确定性 fixture；不要指向个人或生产 profile。

## Recipe 接口

Recipe 实现公开的 `AutoFixRecipe` 接口。匹配应优先使用结构化错误字段和受控签名。恢复只返回简短下一步或不采取动作；它必须响应取消，且绝不能替换原工具结果。

## Pull Request

说明要消除的用户中断、准确匹配边界、成功/未知错误透明性的证据、兼容性影响和回滚方式。用户可见行为变化时同步更新中英文公开文档。
