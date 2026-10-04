# 贪吃奶娃 · 自由开饭

一个使用 HTML、CSS 和 JavaScript 编写的网页贪吃蛇小游戏。手机与电脑浏览器都能玩。

- 32 个关卡，分为 4 个章节。
- 无尽模式、电脑对手、多种食物、冲刺与护盾。
- 图片、背景音乐、语音和视频随项目提供；游戏运行不依赖外部接口或 CDN。
- 记录保存在当前浏览器中，无需玩家登录。

## 本地运行

在项目目录启动静态网页服务，然后在浏览器访问对应地址。例如安装 Python 后：

```sh
python -m http.server 8000
```

打开 `http://localhost:8000/`。部分音频使用浏览器 fetch 加载，因此请通过网页服务运行。

## 免费发布到 GitHub Pages

1. 创建公开仓库，将本目录的文件上传到仓库根目录，包括 `assets` 文件夹和 `.nojekyll`。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment** 下选择 **Deploy from a branch**。
4. 选择 **main** 分支、**/(root)** 目录，保存。
5. 等待发布完成，在 Pages 页面点击 **Visit site**，复制游戏链接。

默认游戏网址的形式是 `https://公开用户名或组织名.github.io/仓库名/`。
请使用希望公开的昵称；该名称会显示在游戏网址中。
GitHub Pages 可用于 GitHub Free 的公开仓库，不必自行购买域名或服务器。
不同网络的访问效果可能不同，请用准备分享给朋友的网络实测。

官方文档：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html` | 自动适配手机和电脑的入口 |
| `mobile.html` / `desktop.html` | 手机 / 电脑入口 |
| `arena-engine.js` | 游戏规则与关卡 |
| `arena.js` | 输入、画面和音频 |
| `arena.css` | 页面样式 |
| `assets/` | 图片、音频和视频 |
| `tests/progression.cjs` | 游戏引擎的既有关卡回归检查 |

无需构建。编辑这些文件后即可发布；修改共有页面内容时，请同步三个 HTML 入口。

## 运行既有检查

安装 Node.js 后执行：

```sh
node tests/progression.cjs
```

## 公开信息与素材

此发布副本不包含原项目的 Git 历史、原托管配置或个人工作记录。
后续提交时请使用 GitHub 的隐藏邮箱设置或明确用于公开提交的身份，避免把个人邮箱写入提交记录。

本项目原创代码使用 MIT 许可证。第三方角色形象、图片、录音和视频的权利归各自权利人，
不纳入本项目的 MIT 授权；素材出处见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
