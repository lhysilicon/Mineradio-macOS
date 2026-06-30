# Mineradio (macOS)

Mineradio 是个音乐可视化播放器:搜歌、放歌、歌词舞台、粒子视觉、3D 歌单架,接网易云和 QQ 音乐(用你自己的账号)。原版只有 Windows,这个 fork 把它搬到了 macOS,顺手加了点 mac 上才有的东西。

最值得说的是桌面壁纸模式:把整个可视化器沉到桌面图标下面当动态壁纸,图标照常显示——而且跟一般的"动态壁纸"不一样,它能直接上手操作。

> 非官方 fork。基于 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)(GPL-3.0),macOS 部分由 lhysilicon 维护,跟原作者没有隶属关系、也未经其背书。Mineradio 这个名字、MR logo 和原创视觉都归原作者。

![platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-black?logo=apple)
![license](https://img.shields.io/badge/license-GPL--3.0-blue)
![release](https://img.shields.io/github/v/release/lhysilicon/Mineradio-macOS?include_prereleases&label=release)

![Mineradio on macOS](./docs/assets/readme/mineradio-macos.png)

## 桌面壁纸模式

进去之后窗口沉到桌面图标下面,可视化器当背景跟着音乐动,图标全程在上面照用。和大多数动态壁纸不同,它能直接交互:

- 在壁纸上点歌单卡片就放歌,滚轮缩放,点 3D 歌架。点一下只是放歌,不会顺手把 3D 视角带歪;真想换个角度就按住拖一下,松手会自己转回正面。
- 鼠标移到屏幕左缘 / 底部 / 顶部,歌单、控制条、搜索栏会像在普通窗口里那样滑出来,能点能滚——整套界面都在壁纸里。
- 底部有颗迷你播放器(封面、上一首、播放暂停、下一首、退出),不抢当前 App 的键盘焦点,能拖到任意位置。
- 锁屏或睡眠时自动停渲染,不在你没看的时候空耗电,醒了再恢复。

进出壁纸:右下角那个壁纸按钮、`⌥⌘W`、或者「壁纸」菜单。

有一处绕不过去:键盘。macOS 不会把按键发给沉在图标下面的窗口,所以要在搜索框打字或者登录的时候,用菜单栏图标里的「前置浏览」把窗口临时抬上来,弄完按 `Esc` 沉回去就行。

底层是一个只读的鼠标监听(listen-only event tap):只看鼠标、不读键盘、不改也不注入任何输入,只在壁纸模式期间跑。第一次要在「系统设置 → 隐私与安全性 → 输入监控」里勾一下它。

## 装

到 [Releases](https://github.com/lhysilicon/Mineradio-macOS/releases) 下 `Mineradio-<版本>-arm64.dmg`,拖进「应用程序」。没签名也没公证,第一次打开被 Gatekeeper 拦了就右键选「打开」,或者终端跑一次 `xattr -cr /Applications/Mineradio.app`。只有 Apple Silicon 版。

## 原来就有的功能(都留着)

天气电台(按位置、城市、天气生成播放队列)、每日推荐、私人电台、继续听、听歌画像、我的歌单;没放歌时是干净的银河首页,放起来切到视觉态,歌词舞台和粒子舞台一起跑;基于节奏的电影镜头视觉、给长播客和 DJ 曲目的专属视觉模式;自定义歌词、自定义封面上传裁剪;右键唤出 3D 歌单架。

## 从源码跑

```bash
npm install
npm start          # 开发模式,Electron 加载本地服务
npm run build:mac  # 打包 .dmg / .app,产物在 dist/
```

源码在 Windows 上也能跑(`npm run build:win` 还在),不过这个 fork 主要管 macOS。具体改了哪些,见 [CHANGELOG](./CHANGELOG.md) 的「macOS fork」节。

## 几点说明

第三方平台:Mineradio 不是网易云 / QQ 音乐的官方客户端,也不属于任何平台。接入只为个人用自己的账号听歌,请遵守各平台的协议和会员规则;不提供绕过付费、会员、破解音质或重新分发音乐内容的能力。

隐私:登录 Cookie、搜索记录、自定义封面 / 歌词、节奏缓存这些只存在本机(`~/Library/Application Support/Mineradio/`),不进仓库。详见 [PRIVACY.md](./PRIVACY.md)。

许可:GPL-3.0(本 fork 也是),见 [LICENSE](./LICENSE)。© 2026 XxHuberrr(原作)/ lhysilicon(macOS 改动部分)。名字、logo 和原创视觉归原作者,本 fork 不主张其品牌权利,用的是独立中性图标。原作者发布的早期共创与测试致谢(emily、小天才e宝、应春日、锋将军、軌跡、林中、骊、风痕、花椰菜🥦)原样保留。

原项目:https://github.com/XxHuberrr/Mineradio
