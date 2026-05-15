# Teleprompter Online

[English](README.md) · [简体中文](README.zh-CN.md)

![Teleprompter Online 录制模式预览](assets/readme-preview.png)

Teleprompter Online 帮助创作者、教育者、创业者和演讲者在阅读脚本时依然自然表达。它直接运行在浏览器中，无需构建步骤，支持清爽的提词器模式，也支持带 16:9 摄像头预览和可调文字浮层的录制模式。

[打开 Teleprompter Online](https://teleprompter.works) · [下载免费的 iPhone、iPad 和 Mac App](https://apps.apple.com/app/teleprompter-scrolling-scripts/id6767148844)

## 项目简介

这个仓库包含 Teleprompter 的轻量 Web 版本，适合 TikTok、Reels、YouTube 视频、演示、在线课程、访谈、产品 Demo 和其他需要脚本辅助的内容创作场景。

Web 版本刻意保持简单：使用静态 `HTML`、`CSS` 和 `JavaScript`，设置保存在浏览器本地，没有运行时依赖。

开源在线提词器，部署在 [teleprompter.works](https://teleprompter.works)。

## 功能特性

- 提词器模式：适合全屏、平滑地阅读脚本。
- 录制模式：提供居中的 16:9 摄像头预览。
- 录制模式下支持拖动和调整脚本文字浮层大小。
- 滚动速度支持 10 到 500 WPM。
- 支持文字大小、行距、字间距、文字颜色、背景颜色、对齐方式和镜像设置。
- 提供适合 Web 使用的顶部、底部、左侧、右侧、居中预设布局。
- 提词器模式支持语音控制命令。
- 使用 `localStorage` 保存本地设置。
- 静态部署，无需构建步骤。

## 快速开始

克隆仓库：

```bash
git clone https://github.com/wendy7756/teleprompter-online.git
cd teleprompter-online
```

在本地启动静态服务：

```bash
python3 -m http.server 8787
```

打开：

```text
http://localhost:8787
```

你也可以直接打开 `index.html`，但建议使用本地服务访问，因为浏览器摄像头权限在 `localhost` 下通常更稳定。

## 项目结构

```text
.
├── assets/
│   ├── logo.svg
│   └── readme-preview.png
├── app.js
├── index.html
├── styles.css
├── LICENSE
├── README.md
└── README.zh-CN.md
```

## 部署

这是一个静态网站，可以部署到任意静态托管服务：

- Cloudflare Pages
- GitHub Pages
- Netlify
- Vercel
- 任意静态文件服务器

如果在生产环境使用摄像头和麦克风权限，请使用 HTTPS 部署。

## 浏览器支持

现代 Chromium、Safari 和 Firefox 浏览器都可以运行提词器界面。摄像头录制依赖浏览器对以下能力的支持：

- `getUserMedia`
- `MediaRecorder`
- Canvas capture

在浏览器支持的情况下，录制视频会导出为 `.webm` 文件。

## 原生 App

Teleprompter 原生 App 支持 iPhone、iPad 和 Mac：

[在 App Store 下载 Teleprompter](https://apps.apple.com/app/teleprompter-scrolling-scripts/id6767148844)

原生 App 单独分发。这个仓库只包含 Teleprompter 的开源在线 Web 部分。

## 参与贡献

欢迎提交 issue 和 pull request。涉及 UI 的改动请尽量保持应用轻量、响应式，并避免引入不必要的依赖；只有当依赖能明显改善核心体验时，才建议添加。

提交 pull request 前建议运行：

```bash
node --check app.js
python3 -m http.server 8787
```

然后在浏览器中测试主要流程：

- 编辑脚本
- 提词器播放
- 录制模式布局
- 摄像头开关
- 文字浮层拖动和调整大小

## 许可证

本项目使用 [LICENSE](LICENSE) 中声明的许可证。
