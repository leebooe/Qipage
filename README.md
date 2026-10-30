# 栖页 Qipage

一个以自然风景为背景的 Chrome / Microsoft Edge 新标签页扩展。使用原生 HTML、CSS 和 JavaScript，直接加载项目目录即可使用。

## 安装到浏览器

1. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择此项目目录 `G:\code\Qipage`（包含 `manifest.json` 的目录）。
4. 新建一个标签页。浏览器出现新标签页变更提示时，选择保留栖页。

Chrome 和 Edge 使用相同目录。扩展代码更新后，在扩展管理页点击「重新加载」。

## 已实现的功能

- **自然壁纸**：从指定的早晨、白天、傍晚、夜间 Unsplash 合集中各选 4 张图片，按本地时段切换，保留森林离线背景；配置 Unsplash Access Key 后从对应完整合集中随机获取图片；配置 Pixabay API Key 后按关键词获取视频壁纸。视频静音循环，后台暂停，尊重减少动态效果的系统偏好。
- **外观调节**：壁纸亮度、壁纸不透明度、卡片不透明度、卡片背景模糊。
- **自动切换**：图片默认跟随四个时段；支持每天、每次新建标签页、每小时、30 / 15 / 5 分钟轮换。自动模式在时段变化时更新图片；点击精选缩略图后进入手动模式，保留所选背景。
- **时间与陪伴**：本机时间、日期、星期、12 / 24 小时制、秒数、个性化时段问候。每日暖心短句按本地日期轮换。
- **分组快捷访问**：增删改分组和网址、自动网站图标、图标底色、平铺排列、组内拖拽排序与跨组拖拽。
- **自由布局**：桌面端以整个页面为画布，时钟、搜索、分组、笔记与每日一句组件均可拖到页面两侧及上下边缘；默认排列保留居中留白。拖动组件右下角调整大小，靠近其他组件或页面边缘、中心时显示对齐线，并在 6 像素内自动吸附。工具栏与设置按钮保持置顶。位置与大小自动保存，已有布局自动迁移到页面坐标；窄屏采用响应式排列。
- **Markdown 笔记**：多篇笔记、自动保存、编辑 / 预览、全尺寸并排实时预览、任务清单、表格、代码块、Markdown 文件导入与导出。预览经 DOMPurify 清理。
- **搜索**：Bing、Google、百度、DuckDuckGo；可直接输入网址。
- **专注模式**：收起工具和卡片，保留时间与每日一句。
- **备份恢复**：JSON 导出与导入，恢复前展示数据数量并确认。备份会省略 API 密钥，恢复时保留当前浏览器的密钥。

## 壁纸 API 配置

打开右上角设置 →「壁纸与外观」→「壁纸 API 配置」。

### Unsplash

在 [Unsplash Developers](https://unsplash.com/oauth/applications) 创建应用，将 **Access Key** 填入设置，点击「从当前时段合集换一张」。

项目根据浏览器本地时间选择下列合集，通过官方随机照片 API 的 `collections` 参数获取横向图片，保留摄影师与平台链接，并对选用图片触发下载统计。内置的 16 张图片精选可直接使用，图片由 Unsplash CDN 加载。

| 时段 | 本地时间 | 背景合集 |
| --- | --- | --- |
| 早晨 | 05:00–10:00 | [早晨合集](https://unsplash.com/collections/GD4aOSg4yQE) |
| 白天 | 10:00–17:00 | [白天合集](https://unsplash.com/collections/o8uX55RbBPs) |
| 傍晚 | 17:00–20:00 | [傍晚合集](https://unsplash.com/collections/3M2rKTckZaQ) |
| 夜间 | 20:00–次日 05:00 | [夜间合集](https://unsplash.com/collections/bHDh4Ae7O8o) |

页面在前台时每 30 秒处理自动切换，恢复到前台时立即匹配当前时段。手动模式保留所选图片，点击「从当前时段合集换一张」会在当前时段中选择另一张图片。设置面板可浏览四组缩略图，并通过「查看合集」打开原合集。

### Pixabay

在 [Pixabay API 文档](https://pixabay.com/api/docs/) 登录并获取 **API Key**。填写后选择「视频壁纸」，输入主题并切换壁纸。

同一密钥与主题的 API 搜索结果缓存 24 小时。换壁纸从缓存池中选择另一段视频；缓存过期后更新。视频媒体从 Pixabay CDN 直接加载。

密钥存于当前浏览器扩展存储，适用于个人本地安装。发布面向公众的版本时，建议通过自有服务管理统一密钥和服务配额。

## 操作方式

| 操作 | 方法 |
| --- | --- |
| 添加链接 / 分组 / 笔记 | 左侧 `+` |
| 编辑快捷链接 | 悬停图标后点击小铅笔 |
| 编辑分组 | 分组右上角 `···` |
| 快捷链接排序 / 移动到分组 | 拖动图标到目标图标之前或目标分组空白处 |
| 调整页面布局 | 右上角「编辑布局」→ 拖动组件顶部把手 / 右下角 |
| 展开笔记 | 笔记卡片右上角展开按钮 |
| 管理多篇笔记 | 左侧笔记图标，或笔记卡片 `···` |
| 专注模式 | 页面右下角展开图标 |
| 聚焦搜索 | `/` |
| 关闭面板 / 退出专注 | `Esc` |
| 立即保存 | `Ctrl+S` / `Cmd+S` |

## 数据与隐私

- 扩展以 `chrome.storage.local` 保存链接、笔记、布局、设置和密钥，容量受浏览器本地存储配额限制；网页预览使用当前来源的 `localStorage`。
- 不同浏览器和用户配置文件各自保存数据，可通过 JSON 备份迁移。
- 在线壁纸请求发送给 Unsplash / Pixabay；密钥仅发送给对应平台。
- 网站图标优先使用浏览器 favicon 接口；网页预览与加载失败时使用 Google favicon 服务，该服务会接收目标网站域名。
- 笔记中主动插入的 HTTPS 图片由对应远程服务器加载。Markdown 外链通过独立标签页打开。
- 卸载扩展会清除相应扩展存储，建议定期导出备份。

## 本地网页预览

需要 Node.js 20 或更新版本，在项目目录执行：

```powershell
npm run dev
```

访问 `http://127.0.0.1:3000`。网页预览与扩展分别保存数据。更换端口：

```powershell
$env:PORT = '3100'
npm run dev
```

## 目录

```text
manifest.json           Manifest V3 与新标签页入口
index.html              页面壳与导航
styles.css              响应式外观与布局
src/app.js              组件、编辑、拖拽、设置、笔记与备份
src/store.js            数据结构、导入规范化、本地持久化
src/wallpapers.js       Unsplash / Pixabay、缓存与轮换
src/wallpaper-collections.js 四个时段、合集来源与 16 张图片精选
src/icons.js            本地 SVG 图标
assets/                 森林壁纸与品牌图标
vendor/                 本地 Markdown 与 HTML 清理依赖及许可证
scripts/dev-server.mjs  使用 Node 标准库的本地预览服务
scripts/create-icons.mjs 从项目原生叶片矢量生成扩展 PNG 图标
```

Manifest 仅申请 `storage`、`favicon` 和两个壁纸 API 的主机权限。JavaScript 依赖随扩展打包，本地加载。

## 资料

- [Chrome：覆盖新标签页](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)
- [Chrome：获取网站图标](https://developer.chrome.com/docs/extensions/how-to/ui/favicons)
- [Microsoft Edge：Chrome 扩展兼容](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/port-chrome-extension)
- [Unsplash API](https://unsplash.com/documentation)
- [Pixabay API](https://pixabay.com/api/docs/)
- [Marked](https://marked.js.org/)，MIT License
- [DOMPurify](https://github.com/cure53/DOMPurify)，Apache-2.0 / MPL-2.0

图片版权归摄影师所有。内置森林图：Sebastian Unrau / Unsplash。
