# 栖页 Qipage

一个以自然风景为背景的 Chrome / Microsoft Edge 新标签页扩展。使用原生 HTML、CSS 和 JavaScript，直接加载项目目录即可使用。

## 安装到浏览器

1. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择此项目目录 `G:\code\Qipage`（包含 `manifest.json` 的目录）。
4. 新建一个标签页。浏览器出现新标签页变更提示时，选择保留栖页。

Chrome 和 Edge 使用相同目录。扩展代码更新后，在扩展管理页点击「重新加载」。

## 已实现的功能

- **自然壁纸**：使用 Picsum 公开图库随机获取背景，完整图片列表分页读取并缓存 24 小时，图片通过 Picsum 及其图片 CDN 加载。视频壁纸使用 Apple 的 114 段航拍影片，可按自然、城市、太空和水下分类选择，支持自动画质、4K SDR 与 1080p。视频静音循环，后台暂停，尊重减少动态效果的系统偏好。
- **外观调节**：主题色支持 6 种预设、自定义取色与恢复默认，即时更新按钮、选中状态和面板配色并自动保存；支持壁纸亮度、壁纸不透明度、卡片不透明度、卡片背景模糊。
- **自动切换**：图片默认跟随四个时段；支持每天、每次新建标签页、每小时、30 / 15 / 5 分钟轮换。自动模式在时段变化时更新图片；手动模式保留当前背景，每次点击换图时从 Picsum 完整图库随机选取。
- **时间与陪伴**：本机时间、日期、星期、12 / 24 小时制、秒数、个性化时段问候。每日暖心短句按本地日期轮换。
- **分组快捷访问**：增删改分组和网址、自动网站图标、手动上传自定义图标及预览、恢复网站图标、图标底色、平铺排列、组内拖拽排序与跨组拖拽。
- **自由布局**：桌面端以整个页面为画布，时钟、搜索、分组、笔记与每日一句组件均可拖到页面两侧及上下边缘；默认排列保留居中留白。拖动组件右下角调整大小，靠近其他组件或页面边缘、中心时显示对齐线，并在 6 像素内自动吸附。工具栏与设置按钮保持置顶。位置与大小自动保存，已有布局自动迁移到页面坐标；窄屏采用响应式排列。
- **Markdown 笔记**：多篇笔记、自动保存、编辑 / 预览、全尺寸并排实时预览、任务清单、表格、代码块、Markdown 文件导入与导出。预览经 DOMPurify 清理。
- **搜索**：Bing、Google、百度、DuckDuckGo；可直接输入网址。
- **专注模式**：收起工具和卡片，保留时间与每日一句。
- **备份恢复**：JSON 导出与导入，恢复前展示数据数量并确认。备份包含链接、自定义图标、当前本地壁纸、笔记、布局、外观以及航拍分类与画质设置。

## 壁纸来源与视频配置

打开右上角设置 →「壁纸与外观」，可选择图片或视频壁纸，以及自动切换频率。

### 本地壁纸与图标

- 在「图片壁纸」中点击「上传本地壁纸」，选择图片后替换当前背景，并固定为手动切换。点击「换一张图片」或选择自动频率可恢复在线背景；本地上传替换当前壁纸，切换其他背景后可再次上传原文件。
- 添加或编辑快捷链接时，点击「上传图标」选择图片，查看预览后点击「保存链接」。点击「恢复网站图标」并保存，可重新使用自动获取的网站图标。
- 支持 PNG、JPG、WebP、SVG、ICO 等浏览器可解码的图片，单个原文件上限 20 MB。壁纸自动缩放和压缩，图标保存为透明背景的静态 PNG。上传内容仅在当前浏览器本地处理和保存，并随 JSON 备份导出、恢复。

### Picsum

图片壁纸通过 [Lorem Picsum](https://picsum.photos/) 的公开图片接口获取，选择「图片壁纸」即可使用。点击「换一张图片」从完整图库中随机选择，优先避开当前图片。

项目通过 `/v2/list?page={page}&limit=100` 分页读取完整图库，筛选原图宽度至少 3840、高度至少 2160 的图片，列表缓存 24 小时。图片使用 `/id/{id}/3840/2160.webp` 地址，以 4K（3840×2160）、16:9 比例显示；图片下载由 Picsum 及 `fastly.picsum.photos` 提供。摄影师姓名和原作链接保留在页面左下角；Picsum 的原作链接可能指向 Unsplash，图片列表与背景文件均通过 Picsum 读取。

4K 图片文件保存在浏览器本地 Cache Storage，最多保留最近使用的 6 张。再次打开新标签页时优先读取本地图片；当前背景显示后，后台随机选择并预加载下一张 4K 图片，换图时优先使用已准备好的图片。旧分辨率图片、目录缓存和预加载记录会失效，首次需要重新获取 4K 图库并下载图片。图片列表更新失败时继续使用上次完整的 4K 图库缓存，5 分钟后再尝试更新。

原有自动切换时间规则继续生效：跟随时间模式在本地时间 05:00、10:00、17:00、20:00 变化时重新随机选图，并支持每天、每次新标签页、每小时、30 / 15 / 5 分钟与手动切换。各时段共用 Picsum 完整图库。

升级时，已上传的本地壁纸、自定义图标和 Apple 航拍设置继续保留；旧在线壁纸会重新选择 Picsum 图片，旧图片文件缓存会自动清理。更新后请在扩展管理页重新加载栖页，并按浏览器提示确认 Picsum 站点访问权限，再新建标签页使用。
### Apple 航拍

选择「视频壁纸」即可使用，提供「全部风景」「自然风光」「城市航拍」「太空俯瞰」「水下世界」五种分类。沿用现有自动切换频率，点击「换一段航拍」会从当前分类随机选择另一段影片。

`assets/aerials.json` 内置 114 段影片的地址、分类及中英文地点说明，来自 [aerial-tv 的航拍目录](https://github.com/pengchujin/aerial-tv/blob/9ffa2c309c8b4fbfe292e926fa6a083829cbd8cf/app/src/main/assets/aerials.json)，上游由 [Apple 官方资源包](https://sylvan.apple.com/Aerials/resources-16.tar) 生成。影片通过 HTTPS 从 `sylvan.apple.com` 直接加载，分段读取和媒体缓存由浏览器管理。目录随扩展发布更新，来源声明见 `vendor/aerial-tv-LICENSE.txt`。

画质可选「自动 · 优先 4K」「4K SDR · HEVC」「1080p · H.264」。通过浏览器的 Media Capabilities 和媒体类型支持检测判断 4K HEVC 播放能力；自动与 4K 选项在设备兼容时使用 4K SDR（约 12 Mbps），兼容性回退使用 1080p H.264（约 10 Mbps）。4K 加载失败或前台等待首帧超过 25 秒时，切到同一段的 1080p，并在当前页面会话优先使用 1080p。1080p 加载失败时保留图片背景，提供换片提示。壁纸使用 SDR 格式。

旧版本视频设置会迁移到 Apple 航拍，原有链接、笔记、布局和图片壁纸继续保留。

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

- 扩展以 `chrome.storage.local` 保存链接、笔记、布局和设置，容量受浏览器本地存储配额限制；网页预览使用当前来源的 `localStorage`。
- 不同浏览器和用户配置文件各自保存数据，可通过 JSON 备份迁移。
- 图片列表通过 Picsum 公开接口读取，图片通过 Picsum 及其图片 CDN 加载；航拍影片直接从 Apple 视频服务器加载。
- 手动上传的壁纸与快捷链接图标保存在本机，JSON 备份中包含图片内容。
- 网站图标优先使用浏览器 favicon 接口；网页预览与加载失败时使用 Google favicon 服务，该服务会接收目标网站域名。
- 笔记中主动插入的 HTTPS 图片由对应远程服务器加载。Markdown 外链通过独立标签页打开。
- 卸载扩展会清除相应扩展存储，建议定期导出备份。

## 本地网页预览

需要 Node.js 20 或更新版本，在项目目录执行：

```powershell
npm run dev
```

访问 `http://127.0.0.1:3000`。网页预览与扩展分别保存数据。本地预览服务转发 Picsum 的公开图片列表，处理网页跨域读取；扩展直接向 Picsum 请求。上游暂时不可用时，页面会保留当前背景并显示错误提示。更换端口：

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
src/wallpapers.js       图片 / 航拍选择与轮换规则
src/aerials.js          Apple 航拍目录、分类、画质检测与回退
src/wallpaper-periods.js 图片自动切换时段
src/wallpaper-images.js  图片文件本地缓存、读取与淘汰
src/picsum-source.js     Picsum 地址与来源校验
src/picsum-photos.js     Picsum 完整图库分页读取与缓存
src/icons.js            本地 SVG 图标
assets/                 品牌图标、本地资源与 aerials.json 航拍目录
vendor/                 本地 Markdown 与 HTML 清理依赖及许可证
scripts/dev-server.mjs  使用 Node 标准库的本地预览服务
scripts/create-icons.mjs 从项目原生叶片矢量生成扩展 PNG 图标
```

Manifest 申请 `storage`、`favicon`、Picsum 服务与图片 CDN、Apple 视频服务器的主机权限。JavaScript 依赖随扩展打包，本地加载。

## 资料

- [Chrome：覆盖新标签页](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages)
- [Chrome：获取网站图标](https://developer.chrome.com/docs/extensions/how-to/ui/favicons)
- [Microsoft Edge：Chrome 扩展兼容](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/port-chrome-extension)
- [Lorem Picsum](https://picsum.photos/)
- [Apple TV 4K](https://www.apple.com/apple-tv-4k/)
- [aerial-tv](https://github.com/pengchujin/aerial-tv)，MIT License
- [Marked](https://marked.js.org/)，MIT License
- [DOMPurify](https://github.com/cure53/DOMPurify)，Apache-2.0 / MPL-2.0

图片版权归摄影师所有。内置森林图：Sebastian Unrau / Unsplash。
航拍目录保留 aerial-tv 的 MIT 版权声明；航拍影片由 Apple 提供，影片版权归相应权利人所有。
