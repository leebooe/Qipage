import { icon, hydrateIcons } from './icons.js';
import { defaults, DEFAULT_LAYOUT, SETTINGS, uid, clone, safeUrl, normalize, readState, writeState, watchState } from './store.js';
import { timePeriod, chooseWallpaper, isDue } from './wallpapers.js';
import { AERIAL_CATEGORIES, AERIAL_QUALITIES, AERIAL_SOURCE_URL, prepareAerial, lowerAerial } from './aerials.js';

const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
let state = await readState();
let editingLayout = false;
let noteMode = 'preview';
let savingTimer, toastTimer, modalFocus, videoLoadTimer, wallpaperGeneration = 0;
let wallpaperRetryAt = 0, wallpaperRequest = 0;
let dragState = null, pendingExternal = null;
let lastDate = '';
const workspace = $('#workspace');
const mobile = () => matchMedia('(max-width:760px)').matches;
const baseHeight = () => Math.max(innerHeight, innerWidth >= 1600 ? 760 : 720);
const minimumWidgetWidth = id => id === 'clock' ? 250 : id === 'search' ? 280 : 180;

// Keep the original centered composition as the initial arrangement on the page.
function contentFrame() {
  const pageWidth = Math.max(document.documentElement.clientWidth, 761);
  const compact = pageWidth <= 1100;
  const width = compact ? pageWidth - 125 : Math.min(1450, pageWidth - 190);
  return {
    pageWidth, width, left: compact ? 85 : (pageWidth - width) / 2,
    top: compact ? 80 : 92,
    height: Math.max(innerHeight - (compact ? 145 : 155), pageWidth >= 1600 ? 760 : 720),
  };
}
function pagePosition(position, id) {
  const frame = contentFrame();
  const legacyMinimum = id === 'clock' ? (frame.pageWidth > 1100 ? 290 : 260)
    : id === 'search' ? 280 : id === 'quote' ? 270 : frame.pageWidth > 1100 ? 180 : 150;
  const width = Math.min(frame.pageWidth, Math.max(position.w / 100 * frame.width, legacyMinimum));
  return {
    x: clamp((frame.left + position.x / 100 * frame.width) / frame.pageWidth * 100, 0, 100 - width / frame.pageWidth * 100),
    y: (frame.top + position.y / 100 * frame.height) / baseHeight() * 100,
    w: width / frame.pageWidth * 100, h: position.h,
  };
}
function migratePageLayout() {
  if (state.layoutSpace === 'page' || mobile()) return false;
  state.layout = Object.fromEntries(Object.entries(state.layout).map(([id, position]) => [id, pagePosition(position, id)]));
  state.layoutSpace = 'page';
  return true;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4400);
}
async function persist() {
  clearTimeout(savingTimer);
  savingTimer = null;
  try {
    pendingExternal = null;
    await writeState(clone(state));
    if ($('#note-save-state')) $('#note-save-state').textContent = '已保存到本机';
    if ($('#full-note-status')) $('#full-note-status').textContent = `已保存到本机 · ${currentNote()?.content.length || 0} 字`;
    return true;
  }
  catch { toast('本机存储空间不足，请导出备份并清理较长的笔记。'); return false; }
}
function saveSoon() { clearTimeout(savingTimer); savingTimer = setTimeout(persist, 350); }
function currentNote() { return state.notes.find(n => n.id === state.activeNote) || state.notes[0]; }
function markdown(content) {
  if (!globalThis.marked || !globalThis.DOMPurify) return `<p>${escape(content).replace(/\n/g, '<br>')}</p>`;
  return DOMPurify.sanitize(marked.parse(content, { gfm: true, breaks: true }), { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'iframe', 'video', 'audio', 'button'], FORBID_ATTR: ['style', 'id', 'name'] });
}
function prepareMarkdown(root) {
  $$('a', root).forEach(a => {
    if (!safeUrl(a.getAttribute('href') || '')) a.removeAttribute('href');
    else { a.href = safeUrl(a.getAttribute('href')); a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  });
  $$('img', root).forEach(img => { if (!/^https:\/\//i.test(img.getAttribute('src') || '')) img.remove(); else { img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; } });
}
function widget(id, type, content, label) {
  return `<section class="widget widget-${type}" data-widget="${escape(id)}" aria-label="${escape(label)}"><button class="widget-handle" aria-label="移动${escape(label)}">${icon('move')}${escape(label)}</button><div class="widget-inner">${content}</div><div class="widget-resize" role="separator" aria-label="调整${escape(label)}大小" tabindex="-1"></div></section>`;
}
const engines = { bing: ['必应', 'https://www.bing.com/search?q='], google: ['Google', 'https://www.google.com/search?q='], baidu: ['百度', 'https://www.baidu.com/s?wd='], duckduckgo: ['DuckDuckGo', 'https://duckduckgo.com/?q='] };
function renderWorkspace() {
  const note = currentNote();
  workspace.innerHTML = widget('clock', 'clock', '<div class="clock-time" id="clock-time"></div><div class="clock-date" id="clock-date"></div><div class="clock-greeting" id="clock-greeting"></div>', '时钟与日期') +
    widget('search', 'search', `<form class="search-form" id="search-form"><select class="search-engine" aria-label="搜索引擎">${Object.entries(engines).map(([id, [label]]) => `<option value="${id}" ${state.settings.searchEngine === id ? 'selected' : ''}>${label}</option>`).join('')}</select><span></span><input type="search" id="search-input" aria-label="搜索关键词或输入网址" placeholder="搜索世界，也发现自己" autocomplete="off"><button class="icon-button search-submit" type="submit" aria-label="搜索">${icon('search')}</button></form><div class="search-hint"><kbd>/</kbd> 开始搜索，去往心之所向</div>`, '搜索') +
    state.groups.map(renderGroup).join('') +
    (state.settings.showNotes ? widget('notes', 'notes', renderNotes(note), '我的笔记') : '') +
    (state.settings.showQuote ? widget('quote', 'quote', '<blockquote class="daily-quote" id="daily-quote"></blockquote>', '每日一句') : '');
  $$('.markdown', workspace).forEach(prepareMarkdown);
  attachFavicons();
  applyLayout();
  updateClock();
  renderQuote();
}
function renderGroup(group) {
  return widget(`group-${group.id}`, 'group', `<div class="glass-card" style="height:100%"><div class="card-heading"><span class="heading-symbol">${icon('folder')}</span><div class="card-titles"><h2>${escape(group.name)}</h2><div class="eyebrow">${escape(group.subtitle || 'MY COLLECTION')}</div></div><button class="icon-button" data-action="edit-group" data-id="${escape(group.id)}" aria-label="编辑${escape(group.name)}" title="编辑分组">${icon('more')}</button></div><div class="group-links" data-group="${escape(group.id)}">${group.links.map(link => renderLink(link, group.id)).join('')}<button class="shortcut" data-action="new-link" data-group="${escape(group.id)}" title="添加快捷链接"><span class="shortcut-icon shortcut-add">${icon('plus')}</span><span class="shortcut-label">添加</span></button></div></div>`, group.name);
}
function renderLink(link, groupId) {
  return `<div class="shortcut" draggable="true" data-link="${escape(link.id)}" data-group="${escape(groupId)}"><a href="${escape(link.url)}" ${state.settings.newTab ? 'target="_blank" rel="noopener noreferrer"' : ''} class="shortcut-icon" style="--link-color:${escape(link.color)}" title="${escape(link.title)} · ${escape(new URL(link.url).hostname)}"><span>${escape(link.title.slice(0, 1).toUpperCase())}</span><img data-favicon="${escape(link.url)}" alt="" referrerpolicy="no-referrer" loading="lazy"></a><span class="shortcut-label">${escape(link.title)}</span><button class="shortcut-edit" data-action="edit-link" data-id="${escape(link.id)}" data-group="${escape(groupId)}" aria-label="编辑${escape(link.title)}">${icon('edit')}</button></div>`;
}
function attachFavicons() {
  $$('img[data-favicon]', workspace).forEach(img => {
    const url = img.dataset.favicon;
    const remote = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`;
    const initial = img.previousElementSibling;
    let fallback = false;
    img.addEventListener('load', () => { initial.hidden = true; });
    img.addEventListener('error', () => {
      initial.hidden = false;
      if (!fallback && img.src !== remote) { fallback = true; img.src = remote; }
      else img.remove();
    });
    img.src = globalThis.chrome?.runtime?.id ? `${chrome.runtime.getURL('_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=64` : remote;
  });
}
function renderNotes(note) {
  return `<div class="glass-card notes-card" style="height:100%"><div class="card-heading"><span class="heading-symbol">${icon('note')}</span><div class="card-titles"><h2>随手记</h2><div class="eyebrow">A LITTLE SPACE FOR YOUR MIND</div></div><button class="icon-button" data-action="notes" title="笔记列表" aria-label="笔记列表">${icon('more')}</button><button class="icon-button" data-action="expand-note" title="展开笔记" aria-label="展开笔记">${icon('expand')}</button></div><div class="note-tabs"><button class="note-tab ${noteMode === 'preview' ? 'active' : ''}" data-action="note-preview">预览</button><button class="note-tab ${noteMode === 'edit' ? 'active' : ''}" data-action="note-edit">编辑</button><span style="flex:1"></span>${note ? `<select class="note-selector" style="width:110px;font-size:10px;margin-top:-5px;opacity:.65" id="note-selector" aria-label="选择笔记">${state.notes.map(n => `<option value="${escape(n.id)}" ${n.id === note.id ? 'selected' : ''}>${escape(n.title)}</option>`).join('')}</select>` : ''}</div><div class="note-body">${note ? (noteMode === 'edit' ? `<textarea class="note-editor" id="quick-note" aria-label="Markdown 笔记内容" maxlength="100000" spellcheck="false">${escape(note.content)}</textarea>` : `<div class="markdown" id="quick-preview">${markdown(note.content)}</div>`) : '<div class="empty-note">让想法在这里停留。<button class="secondary-button" data-action="new-note">创建第一篇笔记</button></div>'}</div><div class="note-footer"><span id="note-save-state">${note ? '已保存到本机' : '支持 Markdown'}</span><button data-action="expand-note">Markdown ${icon('arrow')}</button></div></div>`;
}
function refreshNotes() {
  const container = $('.widget-notes .widget-inner');
  if (!container) return;
  container.innerHTML = renderNotes(currentNote());
  $$('.markdown', container).forEach(prepareMarkdown);
}
function applyLayout() {
  if (migratePageLayout()) saveSoon();
  let height = baseHeight();
  const canvasWidth = workspace.clientWidth;
  $$('.widget', workspace).forEach(el => {
    const id = el.dataset.widget;
    const fallback = DEFAULT_LAYOUT[id] || { x: 5, y: 48, w: 29, h: 245 };
    const position = state.layout[id] || (state.layoutSpace === 'page' ? pagePosition(fallback, id) : fallback);
    const width = Math.min(canvasWidth, Math.max(position.w / 100 * canvasWidth, minimumWidgetWidth(id)));
    el.style.left = `${clamp(position.x / 100 * canvasWidth, 0, canvasWidth - width)}px`;
    el.style.top = `${position.y / 100 * baseHeight()}px`;
    el.style.width = `${width}px`; el.style.height = `${position.h}px`;
    if (el.dataset.widget === 'clock') {
      const defaultWidth = Math.max(contentFrame().width * DEFAULT_LAYOUT.clock.w / 100, innerWidth > 1100 ? 290 : 260);
      const scale = mobile() ? 1 : Math.min(el.clientWidth / defaultWidth, position.h / DEFAULT_LAYOUT.clock.h);
      el.style.setProperty('--clock-scale', scale);
    }
    height = Math.max(height, position.y / 100 * baseHeight() + position.h + 45);
  });
  workspace.style.height = `${height}px`;
}
function updateClock() {
  const now = new Date();
  const h = now.getHours();
  const hour = state.settings.clock24 ? String(h).padStart(2, '0') : String(h % 12 || 12);
  const time = $('#clock-time');
  if (time) time.innerHTML = `${hour}:${String(now.getMinutes()).padStart(2, '0')}${state.settings.showSeconds ? `<span class="seconds">${String(now.getSeconds()).padStart(2, '0')}</span>` : ''}${state.settings.clock24 ? '' : `<span class="clock-period">${h < 12 ? 'AM' : 'PM'}</span>`}`;
  const date = $('#clock-date');
  if (date) date.textContent = `${now.getMonth() + 1}月${now.getDate()}日${'\u2003'}${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]}`;
  const greeting = $('#clock-greeting');
  if (greeting) { greeting.hidden = !state.settings.showGreeting; greeting.innerHTML = `${h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'}${state.settings.name ? `，${escape(state.settings.name)}` : ''}<span class="greeting-dot">✦</span>${h < 6 ? '愿你有一个好梦' : h < 11 ? '美好的一天，慢慢开始' : h < 18 ? '按自己的节奏，向前走' : '辛苦了，给自己一点时间'}`; }
  if (lastDate !== now.toDateString()) { lastDate = now.toDateString(); renderQuote(); }
}
const quotes = [
  '慢一点也没关系，每一步都在靠近你想去的地方。', '今天的你，也值得被温柔以待。', '把平凡的日子，过成自己喜欢的样子。', '你所热爱的，会在某一天照亮你的生活。',
  '给生活一点留白，让美好有机会发生。', '偶尔停下来，也是一种向前。', '愿你有认真生活的勇气，也有慢慢来的底气。', '不必急着赶路，也看看路边的花。',
  '一杯温水，一次深呼吸，重新开始也很好。', '心里有光，平常的日子也会闪亮。', '小小的进步，也值得给自己一个拥抱。', '让今天的风，带走昨天的疲惫。',
  '你走的每一步，都算数。', '照顾好自己，是今天最重要的小事。', '生活有很多种节奏，找到属于你的那一种。', '把目光放近一点，眼前也有值得珍惜的风景。',
  '你可以一边休息，一边慢慢变好。', '允许自己成长，也允许自己偶尔迷茫。', '认真吃饭，好好睡觉，把日子过得柔软。', '每一个寻常的清晨，都是新的可能。',
  '愿你手里有热茶，心里有牵挂。', '花会沿途盛开，你以后的路也是。', '在自己的时区里，一切都来得及。', '去做让眼睛发亮的小事。',
  '今天，把一点点温柔留给自己。', '安静生长的日子，也有自己的力量。', '此刻的努力，正在为未来铺路。', '世界很大，先照顾好自己的小小天地。',
  '幸福有时很小，小到一束阳光刚好落在桌上。', '带着好奇出发，带着收获回家。', '在忙碌的间隙，记得听听自己的心。',
];
function renderQuote() {
  const el = $('#daily-quote');
  if (!el) return;
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  el.innerHTML = `<div class="quote-mark">“</div><p>${escape(quotes[day % quotes.length])}</p><cite>栖页 · 每日一句温柔</cite>`;
}
function applyAppearance() {
  const s = state.settings;
  const style = document.documentElement.style;
  const channels = s.themeColor.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
  const linear = channels.map(channel => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  style.setProperty('--accent', s.themeColor);
  style.setProperty('--accent-ink', luminance > .179 ? '#18201c' : '#ffffff');
  style.setProperty('--wallpaper-opacity', s.opacity / 100);
  style.setProperty('--wallpaper-brightness', s.brightness / 100);
  style.setProperty('--card-alpha', s.cardOpacity / 100);
  style.setProperty('--glass-blur', `${s.blur}px`);
}
function updateThemeColor(color) {
  if (!/^#[a-f\d]{6}$/i.test(color)) return;
  state.settings.themeColor = color.toLowerCase();
  applyAppearance();
  const picker = $('#theme-color');
  if (picker) picker.value = state.settings.themeColor;
  const output = $('#theme-color-value');
  if (output) output.textContent = state.settings.themeColor.toUpperCase();
  $$('.theme-color-preset').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.color === state.settings.themeColor));
  });
  saveSoon();
}
async function displayWallpaper(wallpaper, startAt = 0) {
  const generation = ++wallpaperGeneration;
  const image = $('#wallpaper-image'), video = $('#wallpaper-video');
  const credit = $('#wallpaper-credit');
  clearTimeout(videoLoadTimer);
  video.onloadeddata = null; video.onloadedmetadata = null; video.onerror = null;
  if (!wallpaper) {
    video.pause(); video.onloadeddata = null; video.onerror = null; video.removeAttribute('src'); video.load(); video.style.display = 'none';
    image.style.removeProperty('background-image');
    $('#video-toggle').hidden = true;
    credit.innerHTML = `${icon('image')}<button data-action="next-wallpaper">从当前来源获取背景</button>`;
    return;
  }
  if (wallpaper.type === 'video') {
    try {
      wallpaper = await prepareAerial(wallpaper, { ...state.settings });
      if (generation !== wallpaperGeneration) return;
      if (state.wallpaper?.id === wallpaper.id && state.wallpaper.url !== wallpaper.url) {
        state.wallpaper = wallpaper; void persist();
      }
    } catch (error) {
      if (generation === wallpaperGeneration) {
        video.pause(); video.removeAttribute('src'); video.load(); video.style.display = 'none';
        $('#video-toggle').hidden = true;
        toast(error.message || '航拍目录暂时无法读取，请换一段风景。');
      }
      return;
    }
  }
  const source = wallpaper.type === 'video' ? `Apple Aerial · ${wallpaper.quality === '4k' ? '4K' : '1080p'}` : 'Unsplash';
  const sourceUrl = wallpaper.type === 'video' ? AERIAL_SOURCE_URL : 'https://unsplash.com/?utm_source=qipage&utm_medium=referral';
  // Attribution uses separate photographer and provider links.
  credit.removeAttribute('href');
  credit.innerHTML = `${icon(wallpaper.type === 'video' ? 'video' : 'image')}<span><a href="${escape(wallpaper.pageUrl || sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(wallpaper.title || '自然之境')}</a>${wallpaper.author ? ` · <a href="${escape(wallpaper.authorUrl)}" target="_blank" rel="noopener noreferrer">${escape(wallpaper.author)}</a>` : ''} / <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${source}</a></span>`;
  $('#video-toggle').hidden = wallpaper.type !== 'video';
  if (wallpaper.type === 'video') {
    video.preload = 'auto';
    let recovering = false;
    video.onloadedmetadata = () => {
      if (generation === wallpaperGeneration && startAt > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(startAt, Math.max(0, video.duration - 1));
    };
    video.onloadeddata = async () => {
      if (generation !== wallpaperGeneration) return;
      clearTimeout(videoLoadTimer);
      video.style.display = 'block';
      if (!document.hidden && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
        try { await video.play(); } catch { /* The play button allows a user gesture. */ }
      }
      updateVideoButton();
    };
    video.onerror = async () => {
      if (generation !== wallpaperGeneration || recovering) return;
      recovering = true;
      clearTimeout(videoLoadTimer);
      const at = video.currentTime;
      video.pause(); video.style.display = 'none';
      try {
        const fallback = await lowerAerial(wallpaper);
        if (generation !== wallpaperGeneration) return;
        if (fallback) {
          state.wallpaper = fallback; void persist();
          toast('已切换到同一段航拍的 1080p 画质。');
          await displayWallpaper(fallback, at);
          return;
        }
      } catch { /* Keep the picture available when the catalogue cannot be read. */ }
      if (generation !== wallpaperGeneration) return;
      video.removeAttribute('src'); video.load();
      updateVideoButton();
      toast('航拍视频暂时无法加载，可点击换一段或稍后重试。');
    };
    const waitForVideo = () => {
      videoLoadTimer = setTimeout(() => {
        if (generation !== wallpaperGeneration || video.readyState >= 2) return;
        if (document.hidden) waitForVideo();
        else void video.onerror?.();
      }, 25000);
    };
    waitForVideo();
    if (video.src !== wallpaper.url) {
      video.pause(); video.style.display = 'none'; video.src = wallpaper.url; video.load();
    }
    if (video.readyState >= 2) video.onloadeddata();
  } else {
    video.pause(); video.onloadeddata = null; video.onerror = null; video.removeAttribute('src'); video.load(); video.style.display = 'none';
    const preload = new Image();
    preload.referrerPolicy = 'no-referrer';
    preload.onload = () => { if (generation === wallpaperGeneration) image.style.backgroundImage = `url("${wallpaper.url.replace(/["\\\n\r]/g, '')}")`; };
    preload.onerror = () => { if (generation === wallpaperGeneration) toast('壁纸暂时无法加载，当前背景会继续陪伴你。'); };
    preload.src = wallpaper.url;
  }
}
function updateVideoButton() {
  const paused = $('#wallpaper-video').paused;
  $('#video-toggle').innerHTML = icon(paused ? 'play' : 'pause');
  $('#video-toggle').setAttribute('aria-label', paused ? '播放视频' : '暂停视频');
  $('#video-toggle').title = paused ? '播放视频' : '暂停视频';
}
async function nextWallpaper(keepFilm = false) {
  document.body.classList.add('busy');
  const requestId = ++wallpaperRequest;
  ++wallpaperGeneration;
  clearTimeout(videoLoadTimer);
  try {
    const settings = { ...state.settings };
    const period = timePeriod().id;
    const next = keepFilm && state.wallpaper?.source === 'apple-aerial' && settings.backgroundType === 'video'
      && (settings.aerialCategory === 'all' || settings.aerialCategory === state.wallpaper.category)
      ? await prepareAerial(state.wallpaper, settings) : await chooseWallpaper(settings, state.wallpaper);
    if (requestId !== wallpaperRequest || settings.backgroundType !== state.settings.backgroundType || settings.aerialCategory !== state.settings.aerialCategory || settings.aerialQuality !== state.settings.aerialQuality || settings.frequency !== state.settings.frequency || (settings.backgroundType === 'image' && period !== timePeriod().id)) return;
    wallpaperRetryAt = 0;
    state.wallpaper = next; await persist();
    if (requestId === wallpaperRequest) await displayWallpaper(next);
  } catch (error) { if (requestId === wallpaperRequest) { wallpaperRetryAt = Date.now() + 300000; toast(error.message || '连接壁纸服务失败，请稍后再试。'); } }
  finally { if (requestId === wallpaperRequest) document.body.classList.remove('busy'); }
}
function closeModal() {
  if (savingTimer) void persist();
  $('#modal-root').innerHTML = '';
  document.body.style.overflow = '';
  refreshNotes();
  if (modalFocus?.isConnected) modalFocus.focus();
  if (pendingExternal) { const external = pendingExternal; pendingExternal = null; applyExternal(external); }
}
function modal(content, cls = '', focus = true) {
  if (!$('#modal-root').firstChild) modalFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-label="栖页设置与编辑">${content}</section></div>`;
  document.body.style.overflow = 'hidden';
  if (focus) requestAnimationFrame(() => $('input:not([type=hidden]), textarea, button', $('#modal-root'))?.focus());
}
function modalHeader(title, symbol = 'edit') { return `<div class="modal-header"><span>${icon(symbol)}</span><h2>${escape(title)}</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div>`; }
function addDialog() {
  modal(`${modalHeader('给栖页添点什么', 'plus')}<div class="modal-body"><p class="modal-subtitle">把常用的网站与闪过的灵感，安放在这里。</p><div class="add-menu">${[['new-link', 'link', '快捷链接', '一键到达你常去的地方'], ['new-group', 'folder', '链接分组', '用自己的方式整理日常'], ['new-note', 'note', 'Markdown 笔记', '给灵感留一个位置']].map(([action, symbol, title, description]) => `<button class="add-option" data-action="${action}"><span>${icon(symbol)}</span><span><strong>${title}</strong><small>${description}</small></span>${icon('chevron')}</button>`).join('')}</div></div>`);
}
function linkDialog(groupId, linkId) {
  if (!state.groups.length) { groupDialog(); return; }
  const group = state.groups.find(g => g.id === groupId) || state.groups[0];
  const link = group.links.find(l => l.id === linkId);
  modal(`${modalHeader(link ? '编辑快捷链接' : '添加快捷链接', 'link')}<form id="link-form" class="modal-body"><p class="modal-subtitle">填写网址，栖页会自动获取网站图标。</p><label class="form-field"><span>名称</span><input name="title" placeholder="例如：我的灵感库" required maxlength="40" value="${escape(link?.title || '')}"></label><label class="form-field"><span>网址</span><input name="url" placeholder="https://example.com" required maxlength="2000" value="${escape(link?.url || '')}" autocomplete="url"><small>支持 HTTPS 与 HTTP 网址。</small></label><label class="form-field"><span>所在分组</span><select name="group">${state.groups.map(g => `<option value="${escape(g.id)}" ${g.id === group.id ? 'selected' : ''}>${escape(g.name)}</option>`).join('')}</select></label><label class="form-field"><span>图标底色</span><div class="color-field"><input type="color" name="color" value="${escape(link?.color || '#53794e')}"><div class="color-swatches">${['#53794e', '#46a8b2', '#292d34', '#eae9e5', '#c84751', '#d8789f'].map(color => `<button type="button" class="color-swatch" data-color="${color}" style="--swatch:${color}" aria-label="选择颜色 ${color}"></button>`).join('')}</div></div></label><div class="form-error" role="alert"></div><div class="form-actions">${link ? `<button type="button" class="danger-button" data-action="delete-link" data-id="${escape(link.id)}" data-group="${escape(group.id)}">${icon('trash')}删除</button>` : ''}<button type="button" class="secondary-button" data-action="close">取消</button><button type="submit" class="primary-button">保存链接</button></div></form>`);
  $('#link-form').addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget), url = safeUrl(data.get('url'));
    if (!url) { $('.form-error', event.currentTarget).textContent = '请输入有效网址，例如 https://example.com。'; return; }
    const target = state.groups.find(g => g.id === data.get('group'));
    if (target.links.length >= 150 && (!link || target.id !== group.id)) { toast('每个分组最多保存 150 个链接，请创建新分组。'); return; }
    const title = data.get('title').trim();
    if (!title) { $('.form-error', event.currentTarget).textContent = '请为链接填写名称。'; return; }
    const previousIndex = link ? group.links.findIndex(l => l.id === link.id) : -1;
    if (link) group.links = group.links.filter(l => l.id !== link.id);
    const updatedLink = { id: link?.id || uid(), title, url, color: data.get('color') };
    if (link && target.id === group.id) target.links.splice(previousIndex, 0, updatedLink);
    else target.links.push(updatedLink);
    if (await persist()) { closeModal(); renderWorkspace(); toast('快捷链接已保存'); }
  });
}
function groupDialog(id) {
  const group = state.groups.find(g => g.id === id);
  modal(`${modalHeader(group ? '编辑分组' : '新建分组', 'folder')}<form id="group-form" class="modal-body"><p class="modal-subtitle">按生活、工作或兴趣，收好你的常用链接。</p><label class="form-field"><span>分组名称</span><input name="name" required maxlength="40" placeholder="例如：工作空间" value="${escape(group?.name || '')}"></label><label class="form-field"><span>英文小标题（选填）</span><input name="subtitle" maxlength="40" placeholder="WORKSPACE" value="${escape(group?.subtitle || '')}"></label>${group ? '<p class="field-hint">删除分组时，组内快捷链接会一同移除。</p>' : ''}<div class="form-error" role="alert"></div><div class="form-actions">${group ? `<button type="button" class="danger-button" data-action="delete-group" data-id="${escape(group.id)}">${icon('trash')}删除分组</button>` : ''}<button type="button" class="secondary-button" data-action="close">取消</button><button type="submit" class="primary-button">保存分组</button></div></form>`);
  $('#group-form').addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget), name = data.get('name').trim();
    if (!name) { $('.form-error', event.currentTarget).textContent = '请填写分组名称。'; return; }
    if (group) { group.name = name; group.subtitle = data.get('subtitle').trim(); }
    else {
      if (state.groups.length >= 30) { toast('最多可以创建 30 个分组。'); return; }
      const id = uid();
      state.groups.push({ id, name, subtitle: data.get('subtitle').trim(), links: [] });
      const height = state.layoutSpace === 'page' ? baseHeight() : contentFrame().height;
      const bottom = Math.max(48, ...Object.entries(state.layout).filter(([key]) => key.startsWith('group-') || key === 'notes').map(([, p]) => p.y + p.h / height * 100));
      const position = { x: 5, y: bottom + 7, w: 29, h: 245 };
      state.layout[`group-${id}`] = state.layoutSpace === 'page' ? { ...pagePosition(position, `group-${id}`), y: position.y } : position;
      if (state.layout.quote) state.layout.quote.y = Math.max(state.layout.quote.y, bottom + 47);
    }
    if (await persist()) { closeModal(); renderWorkspace(); toast('分组已保存，可通过「编辑布局」调整位置'); }
  });
}
function confirmDialog(title, description, callback) {
  modal(`${modalHeader(title, 'trash')}<div class="modal-body"><p class="modal-subtitle">${escape(description)}</p><div class="form-actions"><button class="secondary-button" data-action="close">取消</button><button class="danger-button" id="confirm-action">确认删除</button></div></div>`);
  $('#confirm-action').addEventListener('click', callback, { once: true });
}
function notesDialog() {
  modal(`${modalHeader('我的笔记', 'note')}<div class="modal-body"><p class="modal-subtitle">那些值得记下的小事，都在这里。</p><div class="notes-list">${state.notes.length ? [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt).map(note => `<div class="note-list-item ${state.activeNote === note.id ? 'selected' : ''}"><button class="note-list-open" data-action="open-note" data-id="${escape(note.id)}"><strong>${escape(note.title)}</strong><small>${new Date(note.updatedAt).toLocaleDateString('zh-CN')} · ${note.content.length} 字</small></button><button class="icon-button" data-action="select-note" data-id="${escape(note.id)}" title="显示在主页" aria-label="在主页显示${escape(note.title)}">${icon(state.activeNote === note.id ? 'check' : 'home')}</button><button class="icon-button" data-action="delete-note" data-id="${escape(note.id)}" aria-label="删除${escape(note.title)}">${icon('trash')}</button></div>`).join('') : '<div class="empty-note">还没有笔记，从一个小小的想法开始。</div>'}</div><button class="primary-button" data-action="new-note">${icon('plus')}新建笔记</button><button class="secondary-button" data-action="import-md" style="margin-left:8px">${icon('upload')}导入 .md</button><input id="import-md-file" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden></div>`);
  $('#import-md-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 400000) { toast('单篇笔记请控制在 100,000 字以内。'); return; }
    try { const content = await file.text(); await createNote(file.name.replace(/\.(md|markdown|txt)$/i, ''), content); }
    catch { toast('文件读取失败，请重新选择 Markdown 文件。'); }
  });
}
async function createNote(title = '未命名笔记', content = '') {
  if (state.notes.length >= 100) { toast('最多可以保存 100 篇笔记，请导出并整理现有笔记。'); return; }
  const note = { id: uid(), title: title.slice(0, 80), content: content.slice(0, 100000), updatedAt: Date.now() };
  state.notes.unshift(note); state.activeNote = note.id; state.settings.showNotes = true;
  if (await persist()) { renderWorkspace(); noteDialog(note.id); }
}
function noteDialog(id) {
  const note = state.notes.find(n => n.id === id) || currentNote();
  if (!note) { createNote(); return; }
  state.activeNote = note.id; saveSoon();
  modal(`<div class="modal-header"><span>${icon('note')}</span><input id="note-title" value="${escape(note.title)}" maxlength="80" aria-label="笔记标题" placeholder="未命名笔记"><div class="note-dialog-tools"><button class="icon-button" data-action="export-md" data-id="${escape(note.id)}" title="导出 Markdown" aria-label="导出 Markdown">${icon('download')}</button><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div></div><div class="note-dialog-content"><textarea id="full-note" aria-label="Markdown 编辑器" maxlength="100000" spellcheck="false" placeholder="# 此刻，你在想什么？\n\n支持 Markdown，写一点什么吧。">${escape(note.content)}</textarea><div class="markdown" id="full-preview">${markdown(note.content)}</div></div><div class="note-dialog-footer"><span id="full-note-status">已保存到本机 · ${note.content.length} 字</span><span>Markdown · 实时预览</span></div>`, 'note-dialog');
  prepareMarkdown($('#full-preview'));
  $('#note-title').addEventListener('input', event => { note.title = event.target.value.trim() || '未命名笔记'; note.updatedAt = Date.now(); saveSoon(); });
  $('#full-note').addEventListener('input', event => {
    note.content = event.target.value; note.updatedAt = Date.now();
    $('#full-preview').innerHTML = markdown(note.content); prepareMarkdown($('#full-preview'));
    $('#full-note-status').textContent = `正在保存 · ${note.content.length} 字`; saveSoon();
  });
  $('#full-note').addEventListener('keydown', editorTab);
}
function editorTab(event) {
  if (event.key !== 'Tab') return;
  event.preventDefault();
  const input = event.target;
  input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function downloadFile(name, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const tabs = { wallpaper: ['image', '壁纸与外观'], general: ['settings', '日常偏好'], data: ['folder', '数据与备份'], about: ['help', '关于栖页'] };
function settingsDialog(tab = 'wallpaper') {
  modal(`<aside class="settings-nav"><div class="settings-title">设置</div>${Object.entries(tabs).map(([id, [symbol, title]]) => `<button class="settings-nav-button ${tab === id ? 'active' : ''}" data-action="settings-tab" data-tab="${id}">${icon(symbol)}${title}</button>`).join('')}<div class="version-label">QIPAGE · V1.0.0<br><br>给日常一个栖息地。</div></aside><div class="settings-content">${modalHeader(tabs[tab][1], tabs[tab][0])}<div class="modal-body">${tab === 'wallpaper' ? wallpaperSettings() : tab === 'general' ? generalSettings() : tab === 'data' ? dataSettings() : aboutSettings()}</div></div>`, 'settings-modal', false);
  requestAnimationFrame(() => {
    $('.settings-nav-button.active', $('#modal-root'))?.focus();
  });
}
function selectSetting(key, title, values) {
  return `<label class="form-field"><span>${title}</span><select data-setting="${key}">${values.map(([value, label]) => `<option value="${value}" ${String(state.settings[key]) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
}
function rangeSetting(key, title, max = 100, unit = '%') {
  return `<label class="range-field"><span class="range-label"><span>${title}</span><output id="output-${key}">${state.settings[key]}${unit}</output></span><input type="range" min="${key === 'brightness' ? 15 : 0}" max="${max}" value="${state.settings[key]}" data-setting="${key}" data-unit="${unit}" aria-label="${title}"></label>`;
}
function toggleSetting(key, title, description) {
  return `<label class="toggle-row"><span>${title}${description ? `<small>${description}</small>` : ''}</span><input type="checkbox" data-setting="${key}" ${state.settings[key] ? 'checked' : ''} aria-label="${title}"></label>`;
}
function themeColorSetting() {
  const color = state.settings.themeColor;
  const presets = [['#d6e5bf', '苔绿'], ['#a8d8e8', '晴蓝'], ['#c7b8ea', '雾紫'], ['#e9b4c3', '蔷薇'], ['#edc48d', '暖杏'], ['#c5d0d8', '月灰']];
  return `<div class="theme-color-setting"><div class="theme-color-heading"><span class="section-label">主题色</span><button type="button" class="text-button" data-action="theme-color" data-color="${SETTINGS.themeColor}">恢复默认</button></div><div class="theme-color-presets" role="group" aria-label="预设主题色">${presets.map(([value, label]) => `<button type="button" class="theme-color-preset" data-action="theme-color" data-color="${value}" style="--swatch:${value}" aria-label="${label}" aria-pressed="${color === value}"><span class="theme-color-dot"></span><span>${label}</span></button>`).join('')}</div><label class="theme-color-custom" for="theme-color"><span>自定义颜色</span><input id="theme-color" type="color" data-setting="themeColor" value="${escape(color)}" aria-label="自定义主题色"><output id="theme-color-value" for="theme-color">${escape(color.toUpperCase())}</output></label><p class="field-hint">即时应用于按钮、选中状态与面板配色，自动保存到本机。</p></div>`;
}
function wallpaperSettings() {
  const s = state.settings;
  const imageMode = s.backgroundType === 'image';
  const frequencies = [...(imageMode ? [['period', '跟随时间自动切换']] : []), ['daily', imageMode ? '每天与时段变化时' : '每天一次'], ['newtab', '每次打开新标签页'], ['hourly', '每小时'], ['1800', '每 30 分钟'], ['900', '每 15 分钟'], ['300', '每 5 分钟'], ['manual', '手动切换']];
  const refreshLabel = imageMode ? '换一张图片' : '换一段航拍';
  return `<p class="modal-subtitle">让风景，随着一天的光线慢慢变化。</p>
    ${themeColorSetting()}<div class="settings-separator"></div>
    <div class="segmented"><button class="${imageMode ? 'active' : ''}" data-action="background-type" data-type="image">${icon('image')}图片壁纸</button><button class="${imageMode ? '' : 'active'}" data-action="background-type" data-type="video">${icon('video')}视频壁纸</button></div>
    ${imageMode ? `<div class="status-pill">${icon('image')}Unsplash · 自动获取图片</div>` : `<div class="status-pill">${icon('video')}Apple Aerial · 114 段风景影片</div><p class="field-hint">选择即可播放，影片由 Apple 直接提供。静音循环，后台自动暂停。</p>`}
    ${selectSetting('frequency', '自动切换频率', frequencies)}
    ${imageMode ? '<p class="field-hint">自动模式按所选规则更新背景。手动模式保留当前图片，点击换图可随机选取另一张。</p>' : `${selectSetting('aerialCategory', '风景分类', AERIAL_CATEGORIES)}${selectSetting('aerialQuality', '航拍画质', AERIAL_QUALITIES)}<p class="field-hint">自动模式优先播放设备支持的 4K，加载失败时切换到同一段的 1080p。4K 约需 12 Mbps，1080p 约需 10 Mbps。</p>`}
    <button class="secondary-button" data-action="refresh-wallpaper">${icon('shuffle')}${refreshLabel}</button>
    <div class="settings-separator"></div><div class="section-label">让画面刚刚好</div>${rangeSetting('brightness', '壁纸亮度')}${rangeSetting('opacity', '壁纸不透明度')}${rangeSetting('cardOpacity', '卡片不透明度')}${rangeSetting('blur', '卡片背景模糊', 30, ' px')}
    <div class="settings-save-info">${icon('check')}设置自动保存</div>`;
}
function generalSettings() {
  return `<p class="modal-subtitle">让这里，更像你自己的空间。</p><div class="section-label">时间与问候</div><label class="form-field"><span>希望怎样称呼你？</span><input data-setting="name" value="${escape(state.settings.name)}" placeholder="你的名字（选填）" maxlength="30"></label>${toggleSetting('clock24', '24 小时制')}${toggleSetting('showSeconds', '显示秒数')}${toggleSetting('showGreeting', '显示时段问候')}${toggleSetting('showQuote', '每日一句贴心话', '每天更新一句栖页原创暖心短句')}${toggleSetting('showNotes', '在主页显示笔记')}<div class="settings-separator"></div><div class="section-label">搜索与链接</div>${selectSetting('searchEngine', '默认搜索引擎', Object.entries(engines).map(([key, [label]]) => [key, label]))}${toggleSetting('newTab', '在新标签页打开快捷链接与搜索')}<div class="settings-save-info">${icon('check')}设置自动保存</div>`;
}
function dataSettings() {
  return `<p class="modal-subtitle">好好收纳，也安心留存。</p><div class="data-card"><h3>你的本机空间</h3><p>${state.groups.length} 个分组 · ${state.groups.reduce((sum, group) => sum + group.links.length, 0)} 个快捷链接 · ${state.notes.length} 篇笔记<br>内容保存于当前浏览器的扩展存储。</p></div><div class="data-card"><h3>导出备份</h3><p>保存全部快捷链接、Markdown 笔记、布局和外观设置，包括航拍分类与画质。</p><button class="secondary-button" data-action="export-data">${icon('download')}导出 JSON 备份</button></div><div class="data-card"><h3>从备份恢复</h3><p>导入栖页备份后，将使用备份内容替换当前链接、笔记、布局和外观设置。</p><button class="secondary-button" data-action="import-data">${icon('upload')}选择备份文件</button></div><p class="field-hint">Chrome、Edge 与不同浏览器用户之间可通过备份迁移。建议定期导出。</p>`;
}
function aboutSettings() {
  return `<div class="about-brand"><img src="assets/leaf.svg" alt="栖页"><div><h3>栖页 Qipage</h3><p>让每次出发，都从容一点。 · v1.0.0</p></div></div><div class="help-list"><p><strong>自由布局</strong><br>点击右上角「编辑布局」，拖动组件顶部的把手移动位置，拖动右下角调整大小。桌面端保存自由布局，窄屏自动排列。</p><p><strong>快捷链接</strong><br>拖动图标调整顺序，或移动到另一个分组。悬停后点击小铅笔编辑网址；点击分组右上角管理分组。</p><p><strong>Markdown 笔记</strong><br>支持标题、列表、任务清单、引用、链接、表格和代码块。点击展开按钮并排编辑与预览，支持导入、导出 .md。</p><p><strong>键盘快捷键</strong><br><kbd>/</kbd> 搜索　<kbd>Esc</kbd> 关闭面板 / 退出专注　<kbd>Ctrl</kbd> + <kbd>S</kbd> 保存当前内容</p><p><strong>让风景动起来</strong><br>进入「壁纸与外观」选择视频壁纸，即可播放 Apple 航拍。支持自然、城市、太空与水下风景，画质可选自动、4K 或 1080p。视频静音循环，页面在后台时自动暂停。</p><p><strong>图片与视频</strong><br>图片来自 <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a>，视频来自 <a href="https://www.apple.com/apple-tv-4k/" target="_blank" rel="noopener noreferrer">Apple Aerial</a>。点击左下角可访问作品与作者。</p><p><strong>数据归属</strong><br>链接、笔记和设置保存在当前浏览器。壁纸、网站图标与笔记中的远程图片由对应站点加载。浏览器扩展通过 Manifest V3 新标签页入口运行。</p></div>`;
}
function toggleLayout() {
  if (!editingLayout && mobile()) { toast('自由布局适用于宽屏窗口；当前窗口使用自动平铺布局。'); return; }
  if (editingLayout) endDrag();
  editingLayout = !editingLayout;
  document.body.classList.toggle('layout-edit', editingLayout);
  $('#layout-toolbar').hidden = !editingLayout;
  $('#layout-button').innerHTML = `${icon(editingLayout ? 'check' : 'layout')}<span>${editingLayout ? '完成布局' : '编辑布局'}</span>`;
  if (!editingLayout) { endDrag(); persist(); toast('布局已保存'); }
}

document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]');
  if (!target) {
    const swatch = event.target.closest('[data-color]');
    if (swatch) $('input[name=color]', $('#modal-root')).value = swatch.dataset.color;
    if (event.target.classList.contains('modal-backdrop')) closeModal();
    return;
  }
  const { action, id, group, tab, type, index } = target.dataset;
  if (action === 'close') { await persist(); closeModal(); }
  else if (action === 'home') { document.body.classList.remove('focus-mode'); scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (action === 'settings') settingsDialog();
  else if (action === 'wallpaper') settingsDialog('wallpaper');
  else if (action === 'help') settingsDialog('about');
  else if (action === 'settings-tab') settingsDialog(tab);
  else if (action === 'theme-color') updateThemeColor(target.dataset.color);
  else if (action === 'add') addDialog();
  else if (action === 'new-link') linkDialog(group);
  else if (action === 'edit-link') linkDialog(group, id);
  else if (action === 'new-group') groupDialog();
  else if (action === 'edit-group') groupDialog(id);
  else if (action === 'delete-link') {
    const owner = state.groups.find(g => g.id === group); owner.links = owner.links.filter(link => link.id !== id);
    await persist(); closeModal(); renderWorkspace(); toast('快捷链接已删除');
  }
  else if (action === 'delete-group') {
    const owner = state.groups.find(g => g.id === id);
    confirmDialog('删除这个分组？', `「${owner.name}」及其中的 ${owner.links.length} 个快捷链接将从主页移除。`, async () => {
      state.groups = state.groups.filter(g => g.id !== id); delete state.layout[`group-${id}`];
      await persist(); closeModal(); renderWorkspace(); toast('分组已删除');
    });
  }
  else if (action === 'notes') notesDialog();
  else if (action === 'new-note') await createNote();
  else if (action === 'expand-note') noteDialog(state.activeNote);
  else if (action === 'open-note') noteDialog(id);
  else if (action === 'select-note') { state.activeNote = id; state.settings.showNotes = true; await persist(); renderWorkspace(); closeModal(); }
  else if (action === 'note-preview' || action === 'note-edit') { noteMode = action === 'note-edit' ? 'edit' : 'preview'; refreshNotes(); if (noteMode === 'edit') $('#quick-note')?.focus(); }
  else if (action === 'delete-note') {
    const note = state.notes.find(n => n.id === id);
    confirmDialog('删除这篇笔记？', `「${note.title}」将从本机笔记中移除。`, async () => {
      state.notes = state.notes.filter(n => n.id !== id);
      if (state.activeNote === id) state.activeNote = state.notes[0]?.id || '';
      await persist(); refreshNotes(); notesDialog();
    });
  }
  else if (action === 'export-md') { const note = state.notes.find(n => n.id === id) || currentNote(); if (note) downloadFile(`${note.title.replace(/[<>:"/\\|?*]/g, '_')}.md`, note.content, 'text/markdown;charset=utf-8'); }
  else if (action === 'import-md') $('#import-md-file')?.click();
  else if (action === 'layout') toggleLayout();
  else if (action === 'reset-layout') { resetLayout(); await persist(); applyLayout(); toast('已恢复默认布局'); }
  else if (action === 'next-wallpaper' || action === 'refresh-wallpaper') {
    target.disabled = true; await nextWallpaper(); if (target.isConnected) target.disabled = false;
  }
  else if (action === 'background-type') {
    if (type === 'video' && state.settings.frequency === 'period') state.settings.frequency = 'daily';
    state.settings.backgroundType = type; await persist(); settingsDialog('wallpaper');
    await nextWallpaper();
  }
  else if (action === 'video-toggle') { const video = $('#wallpaper-video'); if (video.paused) { try { await video.play(); } catch { toast('视频暂时无法播放，请换一段或稍后重试。'); } } else video.pause(); updateVideoButton(); }
  else if (action === 'focus') {
    if (editingLayout) toggleLayout();
    const focused = document.body.classList.toggle('focus-mode');
    target.title = focused ? '退出专注模式（Esc）' : '专注模式';
    target.setAttribute('aria-label', focused ? '退出专注模式' : '进入专注模式');
  }
  else if (action === 'export-data') {
    const exported = clone(state);
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    downloadFile(`qipage-backup-${date}.json`, JSON.stringify(exported, null, 2), 'application/json'); toast('备份已导出');
  }
  else if (action === 'import-data') $('#import-file').click();
});

document.addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'quick-note') {
    const note = currentNote(); if (!note) return;
    note.content = input.value; note.updatedAt = Date.now();
    if ($('#note-save-state')) $('#note-save-state').textContent = '正在保存…'; saveSoon();
  }
  const key = input.dataset.setting;
  if (!key || !(key in SETTINGS)) return;
  if (key === 'themeColor') { updateThemeColor(input.value); return; }
  state.settings[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
  if (input.type === 'range') $(`#output-${key}`).textContent = `${input.value}${input.dataset.unit}`;
  applyAppearance();
  if (['showNotes', 'showQuote', 'newTab', 'searchEngine'].includes(key)) renderWorkspace();
  else if (['clock24', 'showSeconds', 'showGreeting', 'name'].includes(key)) updateClock();
  else if (['aerialCategory', 'aerialQuality'].includes(key) && state.settings.backgroundType === 'video') { wallpaperRetryAt = 0; void nextWallpaper(key === 'aerialQuality'); }
  else if (key === 'frequency' && isDue(state.settings, state.wallpaper)) { wallpaperRetryAt = 0; void nextWallpaper(); }
  saveSoon();
});
document.addEventListener('change', event => {
  if (event.target.id === 'note-selector') { state.activeNote = event.target.value; refreshNotes(); saveSoon(); }
  if (event.target.matches('.search-engine')) { state.settings.searchEngine = event.target.value; saveSoon(); }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'search-form') return;
  event.preventDefault();
  const query = $('#search-input').value.trim(); if (!query) return;
  const isAddress = /^(https?:\/\/|localhost(?::\d+)?(?:\/|$)|(?:[\w-]+\.)+[a-z]{2,}(?::\d+)?(?:\/|$))/i.test(query) && !/\s/.test(query);
  const url = isAddress && safeUrl(query) ? safeUrl(query) : engines[state.settings.searchEngine][1] + encodeURIComponent(query);
  if (state.settings.newTab) window.open(url, '_blank', 'noopener,noreferrer');
  else location.href = url;
});
document.addEventListener('keydown', event => {
  const editor = event.target.matches('input,textarea,select,[contenteditable]');
  if (event.key === 'Escape') {
    if ($('#modal-root').firstChild) { persist(); closeModal(); }
    else if (editingLayout) toggleLayout();
    else document.body.classList.remove('focus-mode');
  }
  if (event.key === '/' && !editor && !$('#modal-root').firstChild && !editingLayout) { event.preventDefault(); document.body.classList.remove('focus-mode'); $('#search-input')?.focus(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); persist().then(ok => { if (ok) toast('已保存到本机'); }); }
  if (event.target.id === 'quick-note') editorTab(event);
  if (event.key === 'Tab' && $('#modal-root').firstChild) {
    const focusable = $$('button:not(:disabled),a[href],input:not([type=hidden]),textarea,select,summary,[tabindex="0"]', $('#modal-root')).filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > 12 * 1024 * 1024) { toast('备份文件需小于 12 MB。'); return; }
  try {
    const imported = normalize(JSON.parse(await file.text()));
    modal(`${modalHeader('恢复这个备份？', 'upload')}<div class="modal-body"><p class="modal-subtitle">备份内容将替换当前的链接、笔记和布局。建议先导出当前数据。</p><div class="import-summary">${imported.groups.length} 个分组<br>${imported.groups.reduce((sum, g) => sum + g.links.length, 0)} 个快捷链接<br>${imported.notes.length} 篇笔记</div><div class="form-actions"><button class="secondary-button" data-action="export-data">先导出当前数据</button><button class="primary-button" id="restore-backup">恢复备份</button></div></div>`);
    $('#restore-backup').addEventListener('click', async () => {
      const previous = state; state = imported;
      if (await persist()) { pendingExternal = null; closeModal(); applyAppearance(); renderWorkspace(); displayWallpaper(state.wallpaper); if (isDue(state.settings, state.wallpaper)) void nextWallpaper(); toast('备份已恢复'); }
      else state = previous;
    }, { once: true });
  } catch (error) { toast(error instanceof SyntaxError ? '这个文件无法解析，请选择栖页导出的 JSON 备份。' : error.message); }
});

function resetLayout() {
  state.layout = clone(DEFAULT_LAYOUT);
  state.layoutSpace = 'content';
  const height = contentFrame().height;
  state.groups.forEach((group, index) => {
    if (!state.layout[`group-${group.id}`]) {
      const row = Math.floor(index / 2), column = index % 2;
      state.layout[`group-${group.id}`] = { x: 5 + column * 31, y: 48 + row * (245 / height * 100 + 7), w: 29, h: 245 };
    }
  });
  const bottom = Math.max(82, ...state.groups.map(g => { const p = state.layout[`group-${g.id}`]; return p.y + p.h / height * 100; }));
  state.layout.quote.y = Math.max(90, bottom + 10);
  migratePageLayout();
}

function layoutTargets(active, bounds) {
  const targets = { x: [0, bounds.width / 2, bounds.width], y: [0, bounds.height / 2, bounds.height] };
  $$('.widget', workspace).forEach(el => {
    if (el === active) return;
    const rect = el.getBoundingClientRect();
    const left = rect.left - bounds.left, top = rect.top - bounds.top;
    targets.x.push(left, left + rect.width / 2, left + rect.width);
    targets.y.push(top, top + rect.height / 2, top + rect.height);
  });
  return targets;
}
function closestAlignment(points, targets, minDelta, maxDelta) {
  let match = null;
  for (const point of points) {
    for (const target of targets) {
      const delta = target - point;
      if (Math.abs(delta) <= 6 && delta >= minDelta && delta <= maxDelta && (!match || Math.abs(delta) < Math.abs(match.delta))) match = { delta, target };
    }
  }
  return match;
}
function alignLayout(d, p) {
  const bounds = workspace.getBoundingClientRect(), rect = d.el.getBoundingClientRect();
  const left = rect.left - bounds.left, top = rect.top - bounds.top;
  const right = left + rect.width, bottom = top + rect.height;
  const x = closestAlignment(d.resize ? [right] : [left, left + rect.width / 2, right], d.targets.x, d.resize ? d.minWidth - rect.width : -left, d.width - right);
  const y = closestAlignment(d.resize ? [bottom] : [top, top + rect.height / 2, bottom], d.targets.y, d.resize ? d.minHeight - rect.height : -top, d.resize ? 900 - rect.height : d.height * 6 - top);
  if (d.resize) {
    if (x) p.w = (rect.width + x.delta) / d.width * 100;
    if (y) p.h = rect.height + y.delta;
  } else {
    if (x) p.x = (left + x.delta) / d.width * 100;
    if (y) p.y = (top + y.delta) / d.height * 100;
  }
  if (x || y) applyLayout();
  const vertical = $('.layout-guide-vertical', d.guides), horizontal = $('.layout-guide-horizontal', d.guides);
  vertical.hidden = !x; horizontal.hidden = !y;
  if (x) vertical.style.left = `${x.target}px`;
  if (y) horizontal.style.top = `${y.target}px`;
}

workspace.addEventListener('pointerdown', event => {
  if (!editingLayout || event.button !== 0) return;
  if (dragState) return;
  const handle = event.target.closest('.widget-handle,.widget-resize'); if (!handle) return;
  event.preventDefault();
  const el = handle.closest('.widget'), position = state.layout[el.dataset.widget];
  if (!position) return;
  const bounds = workspace.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const id = el.dataset.widget;
  const guides = document.createElement('div');
  guides.className = 'layout-guides'; guides.setAttribute('aria-hidden', 'true');
  guides.innerHTML = '<div class="layout-guide-vertical" hidden></div><div class="layout-guide-horizontal" hidden></div>';
  workspace.append(guides);
  const start = { ...position, x: (rect.left - bounds.left) / bounds.width * 100, w: rect.width / bounds.width * 100 };
  Object.assign(position, start);
  dragState = { el, handle, id, guides, targets: layoutTargets(el, bounds), start, x: event.clientX, y: event.clientY, scrollY, width: bounds.width, height: baseHeight(), minWidth: minimumWidgetWidth(id), minHeight: id === 'notes' || id.startsWith('group-') ? 170 : 60, resize: handle.classList.contains('widget-resize'), pointerId: event.pointerId };
  handle.setPointerCapture(event.pointerId);
  el.style.zIndex = '12'; document.body.classList.add('drag-in-progress');
});
workspace.addEventListener('pointermove', event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const d = dragState, dx = event.clientX - d.x, dy = event.clientY - d.y + scrollY - d.scrollY;
  const p = state.layout[d.id];
  if (d.resize) {
    p.w = clamp(d.start.w + dx / d.width * 100, d.minWidth / d.width * 100, 100 - p.x);
    p.h = clamp(d.start.h + dy, d.minHeight, 900);
  } else { p.x = clamp(d.start.x + dx / d.width * 100, 0, 100 - p.w); p.y = clamp(d.start.y + dy / d.height * 100, 0, 600); }
  applyLayout();
  alignLayout(d, p);
  if (event.clientY > innerHeight - 70) scrollBy(0, 10);
  if (event.clientY < 70) scrollBy(0, -10);
});
function endDrag() {
  if (!dragState) return;
  const d = dragState;
  d.el.style.zIndex = ''; d.guides.remove();
  dragState = null; document.body.classList.remove('drag-in-progress'); saveSoon();
  if (d.handle.hasPointerCapture(d.pointerId)) d.handle.releasePointerCapture(d.pointerId);
}
workspace.addEventListener('pointerup', endDrag);
workspace.addEventListener('pointercancel', endDrag);
workspace.addEventListener('lostpointercapture', endDrag);

let linkDrag = null;
workspace.addEventListener('dragstart', event => {
  const shortcut = event.target.closest('[data-link]');
  if (!shortcut || editingLayout) { event.preventDefault(); return; }
  linkDrag = { id: shortcut.dataset.link, group: shortcut.dataset.group };
  event.dataTransfer.setData('application/x-qipage-link', JSON.stringify(linkDrag));
  event.dataTransfer.effectAllowed = 'move'; shortcut.classList.add('dragging');
});
workspace.addEventListener('dragover', event => {
  if (!linkDrag) return;
  const group = event.target.closest('.group-links'); if (!group) return;
  event.preventDefault(); event.dataTransfer.dropEffect = 'move';
  $$('.drag-over,.drop-before', workspace).forEach(el => el.classList.remove('drag-over', 'drop-before'));
  group.classList.add('drag-over');
  event.target.closest('[data-link]')?.classList.add('drop-before');
});
workspace.addEventListener('drop', async event => {
  if (!linkDrag) return;
  const destination = event.target.closest('.group-links'); if (!destination) return;
  event.preventDefault();
  const from = state.groups.find(g => g.id === linkDrag.group), to = state.groups.find(g => g.id === destination.dataset.group);
  const before = event.target.closest('[data-link]')?.dataset.link;
  if (!from || !to || before === linkDrag.id) { clearLinkDrag(); return; }
  if (to.links.length >= 150 && from.id !== to.id) { toast('这个分组已满，请移至其他分组。'); clearLinkDrag(); return; }
  const link = from.links.find(l => l.id === linkDrag.id);
  if (!link) { clearLinkDrag(); return; }
  from.links = from.links.filter(l => l.id !== link.id);
  const position = to.links.findIndex(l => l.id === before);
  to.links.splice(position >= 0 ? position : to.links.length, 0, link);
  clearLinkDrag(); await persist(); renderWorkspace();
});
function clearLinkDrag() { linkDrag = null; $$('.dragging,.drag-over,.drop-before', workspace).forEach(el => el.classList.remove('dragging', 'drag-over', 'drop-before')); }
workspace.addEventListener('dragend', clearLinkDrag);

function applyExternal(value) {
  if (JSON.stringify(value) === JSON.stringify(state)) return;
  if (editingLayout || dragState || linkDrag || $('#modal-root').firstChild || document.activeElement?.matches('textarea,input,select')) { pendingExternal = value; return; }
  try { const before = state.wallpaper?.url; state = normalize(value); applyAppearance(); renderWorkspace(); if (before !== state.wallpaper?.url) displayWallpaper(state.wallpaper); }
  catch { /* Ignore incompatible data from another page. */ }
}
watchState(applyExternal);
window.addEventListener('resize', () => { endDrag(); if (mobile() && editingLayout) toggleLayout(); applyLayout(); });
// Recalculate edge positions when a vertical scrollbar changes the canvas width.
let canvasWidth = workspace.clientWidth;
const canvasObserver = new ResizeObserver(([entry]) => {
  if (Math.abs(entry.contentRect.width - canvasWidth) < .5) return;
  canvasWidth = entry.contentRect.width;
  endDrag(); applyLayout();
});
canvasObserver.observe(workspace);
window.addEventListener('pagehide', () => persist());
let resumeVideo = false;
document.addEventListener('visibilitychange', () => {
  const video = $('#wallpaper-video');
  if (document.hidden) { persist(); resumeVideo = !video.paused; video.pause(); }
  else {
    updateClock();
    if (resumeVideo && state.wallpaper?.type === 'video') video.play().catch(() => {});
    if (pendingExternal && !$('#modal-root').firstChild && !editingLayout) { const next = pendingExternal; pendingExternal = null; applyExternal(next); }
    if (Date.now() >= wallpaperRetryAt && isDue(state.settings, state.wallpaper)) void nextWallpaper();
  }
  updateVideoButton();
});

hydrateIcons(); applyAppearance(); renderWorkspace();
if (!state.wallpaper) await persist();
displayWallpaper(state.wallpaper);
if (isDue(state.settings, state.wallpaper, true)) void nextWallpaper();
setInterval(updateClock, 1000);
setInterval(() => {
  if (!document.hidden && Date.now() >= wallpaperRetryAt && isDue(state.settings, state.wallpaper)) void nextWallpaper();
}, 30000);
