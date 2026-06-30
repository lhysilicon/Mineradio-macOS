# Mineradio for macOS 🎵🌌

> **Turn your macOS desktop into a living, music-reactive wallpaper you can actually click.**
> 把你的 macOS 桌面变成一张会随音乐律动、还能**直接点歌操作**的动态壁纸——桌面图标照常保留。

![platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-black?logo=apple)
![license](https://img.shields.io/badge/license-GPL--3.0-blue)
![release](https://img.shields.io/github/v/release/lhysilicon/Mineradio-macOS?include_prereleases&label=release)
![stars](https://img.shields.io/github/stars/lhysilicon/Mineradio-macOS?style=social)

![Mineradio macOS](./docs/assets/readme/mineradio-macos.png)

**Mineradio** 是一款沉浸式音乐播放器——搜索播放、歌词舞台、粒子视觉、3D 歌单架，组合成一个有现场感的私人音乐空间。本 macOS fork 最大的不同是那张**会随音乐律动、还能直接交互的桌面动态壁纸**：可视化器沉到桌面图标**下方**（图标照常显示），你能直接在壁纸上点歌、看歌词、把鼠标移到边缘唤出歌单和控制条——这是普通"动态壁纸"做不到的。

> ⚠️ **非官方 fork / Unofficial fork.** 本仓库是对 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)（GPL-3.0）的**非官方 macOS 适配**，由 lhysilicon 自 2026-06 起维护，**与原作者无隶属、未经其背书**。`Mineradio` 名称与 MR Logo 归原作者所有。This is an unofficial macOS fork, not affiliated with or endorsed by the original author.

## ✨ 招牌：会随音乐律动、还能直接点的桌面壁纸

把整个可视化播放器沉到桌面当一张动态壁纸，**同时保留全部交互**：

- **图标照常、画面在底** — 窗口沉到桌面图标下方，可视化随音乐律动当背景，你的文件图标全程可见可用。
- **直接点壁纸操作** — 在壁纸上点歌单卡片即播放、滚轮缩放、点 3D 歌架；点击只播放、**不会把视角转歪**，想换角度按住拖一下、**松手自动归正**。
- **悬停唤出完整界面** — 鼠标移到屏幕左缘出歌单、移到底部出控制条、移到顶部出搜索栏，和普通窗口一样可点可滚——**完整功能都在壁纸里**。
- **不抢焦点的迷你播放器** — 屏幕底部一颗悬浮药丸：封面 / 上一首 / 播放暂停 / 下一首 / 退出，跟随真实播放态，可拖动吸边、闲置淡隐，**不会抢走你当前 App 的键盘焦点**。
- **自动省电** — 锁屏或系统睡眠时（壁纸没人看）自动停渲染、降到几乎零 GPU 负载，唤醒即恢复。
- **安全的实现** — 原理是一个 **只读（listen-only）鼠标事件监听**：只看鼠标、不读键盘、永不修改或注入任何输入，仅在壁纸模式期间运行。首次需给一次 **输入监控（Input Monitoring）** 授权（比"辅助功能"更轻）。

> 进入 / 退出：右下角壁纸按钮、`⌥⌘W`、或「壁纸」菜单。需要打字（搜索 / 登录）时，用菜单栏图标的「前置浏览」把窗口临时置顶，完事按 `Esc` 沉回——系统不会把键盘转发给沉在图标下的窗口，这是唯一需要"抬一下"的操作。

## 🚀 快速开始

1. 到 [Releases](https://github.com/lhysilicon/Mineradio-macOS/releases) 下载 `Mineradio-<版本>-arm64.dmg`，拖进「应用程序」。
2. 应用未做苹果签名/公证，首次打开若被 Gatekeeper 拦：**右键 →「打开」**，或终端跑一次 `xattr -cr /Applications/Mineradio.app`。
3. 打开后按 `⌥⌘W` 进壁纸模式，授一次「输入监控」即可直接在桌面上点歌。

> 仅支持 Apple Silicon（arm64）。也可从源码运行，见下方「从源码运行」。

## 🎨 完整特性（保留原版全部能力）

- 按位置 / 城市 / 天气 mood 生成播放队列的**天气电台**；首页含每日推荐、私人电台、继续听、听歌画像、我的歌单
- 未播放时是干净的**银河首页**背景，播放后切到视觉态：**歌词舞台 + 粒子舞台**同步工作
- 基于节奏的**电影镜头**视觉系统、面向长播客 / DJ 曲目的专属视觉模式
- 自定义歌词与视觉控制、自定义专辑封面上传与裁剪
- 右键唤起 **3D 歌单架**；网易云音乐 / QQ 音乐的搜索、登录态与音源接入（**使用你自己的账号**）
- macOS 原生红黄绿灯窗口、原生应用菜单、`.dmg` 打包与中性图标

## 🛠 从源码运行

```bash
npm install
npm start            # 开发模式：Electron 加载本地服务
npm run build:mac    # 生成 macOS .dmg / .app，产物在 dist/
```

源码同样可在 Windows 上运行（`npm run build:win` 仍可用）；本 fork 的发布产物以 macOS（Apple Silicon）为主。逐条改动见 [CHANGELOG.md](./CHANGELOG.md) 的「macOS fork」节。

## 📄 第三方平台 · 隐私 · 许可

- **第三方音乐平台**：Mineradio 不是网易云 / QQ 音乐 / 腾讯音乐的官方客户端，也不隶属任何平台。接入仅用于个人学习与**用户自有账号**的播放辅助；请遵守对应平台的协议与会员规则。项目**不提供**绕过付费 / 会员 / 破解音质 / 重新分发音乐内容的能力。
- **隐私**：登录 Cookie、搜索历史、自定义封面 / 歌词、节奏缓存等只存本机用户数据目录（`~/Library/Application Support/Mineradio/`），不入仓库。详见 [PRIVACY.md](./PRIVACY.md)。
- **许可**：本项目（含本 fork）以 **GPL-3.0** 发布，详见 [LICENSE](./LICENSE)。Copyright © 2026 XxHuberrr（原始作品）/ lhysilicon（macOS fork 修改部分）。`Mineradio` 名称、MR Logo 与原创视觉表达归**原作者 XxHuberrr** 所有，本 fork 不主张其品牌权利、使用独立中性图标。
- **致谢**：原项目 Mineradio 由 **XxHuberrr** 主要设计与打造；早期视觉共创与测试反馈致谢 emily、小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦（原作者发布的致谢，原样保留）。macOS 适配由 lhysilicon 完成。

原项目 / Upstream: https://github.com/XxHuberrr/Mineradio
