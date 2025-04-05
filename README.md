# Free Upload

一个 VSCode 扩展，用于快速启动文件上传服务器。

## 功能

- 快速启动文件上传服务器
- 支持本地和远程访问
- 实时文件上传进度
- 支持大文件分片上传

## 项目结构

这是一个使用 pnpm monorepo 管理的项目：

```
free-upload/
├── apps/
│   └── web/           # Next.js 前端应用
├── packages/
│   └── server/        # Express 服务器
├── src/               # VSCode 插件核心代码
├── package.json       # 根目录配置
└── pnpm-workspace.yaml # 工作区配置
```

## 开发

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

### 启动

```bash
pnpm start
```

## 配置

在 VSCode 设置中可以配置以下选项：

- `free-upload.uploadFolder`: 上传文件存储的文件夹
- `free-upload.authToken`: 公共服务器的令牌

## 许可证

MIT
