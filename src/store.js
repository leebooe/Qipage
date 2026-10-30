export const uid = () => crypto.randomUUID();
export const clone = value => structuredClone(value);
export const SETTINGS = {
  themeColor: '#d6e5bf',
  backgroundType: 'image', frequency: 'period', brightness: 82, opacity: 100,
  cardOpacity: 30, blur: 16, query: 'forest nature', pixabayKey: '',
  clock24: true, showSeconds: false, showGreeting: true, name: '',
  searchEngine: 'bing', newTab: true, showQuote: true, showNotes: true,
};
export const DEFAULT_LAYOUT = {
  clock: { x: 30, y: 3, w: 40, h: 177 },
  search: { x: 26, y: 30, w: 48, h: 62 },
  'group-daily': { x: 5, y: 48, w: 29, h: 245 },
  'group-inspiration': { x: 36, y: 48, w: 29, h: 245 },
  notes: { x: 68, y: 48, w: 27, h: 273 },
  quote: { x: 24, y: 90, w: 52, h: 65 },
};
const link = (id, title, url, color) => ({ id, title, url, color });
export function defaults() {
  return {
    version: 1, settings: { ...SETTINGS }, layout: clone(DEFAULT_LAYOUT), layoutSpace: 'content',
    groups: [
      { id: 'daily', name: '日常常用', subtitle: 'EVERYDAY', links: [
        link('bing', '必应', 'https://www.bing.com', '#46a8b2'),
        link('github', 'GitHub', 'https://github.com', '#292d34'),
        link('notion', 'Notion', 'https://www.notion.so', '#eae9e5'),
        link('bilibili', '哔哩哔哩', 'https://www.bilibili.com', '#e788a4'),
        link('gmail', 'Gmail', 'https://mail.google.com', '#e9e8e1'),
        link('figma', 'Figma', 'https://www.figma.com', '#313430'),
      ] },
      { id: 'inspiration', name: '灵感与探索', subtitle: 'INSPIRATION', links: [
        link('unsplash', 'Unsplash', 'https://unsplash.com', '#e5e6df'),
        link('pinterest', 'Pinterest', 'https://www.pinterest.com', '#c84751'),
        link('dribbble', 'Dribbble', 'https://dribbble.com', '#d8789f'),
        link('are', 'Are.na', 'https://www.are.na', '#e5e4dd'),
      ] },
    ],
    notes: [{ id: 'welcome', title: '留住此刻的灵感', content: '## 今天，也慢慢来 🌿\n\n给自己留一小块安静的地方。\n\n- [ ] 做一件让自己开心的小事\n- [ ] 记下一个闪过的灵感\n- [ ] 喝杯水，看看窗外\n\n> 你走的每一步，都算数。\n\n支持 **Markdown** · 写下你的第一个想法吧。', updatedAt: Date.now() }],
    activeNote: 'welcome', wallpaper: null,
  };
}
export function safeUrl(value) {
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    return ['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const short = (value, max, fallback = '') => typeof value === 'string' ? value.slice(0, max) : fallback;
export function normalize(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || !Array.isArray(value.groups) || !Array.isArray(value.notes)) throw new Error('请选择栖页导出的有效备份文件。');
  const base = defaults();
  const s = value.settings || {};
  const settings = { ...SETTINGS };
  if (typeof s.themeColor === 'string' && /^#[a-f\d]{6}$/i.test(s.themeColor)) settings.themeColor = s.themeColor.toLowerCase();
  for (const key of ['clock24', 'showSeconds', 'showGreeting', 'newTab', 'showQuote', 'showNotes']) if (typeof s[key] === 'boolean') settings[key] = s[key];
  for (const [key, choices] of Object.entries({ backgroundType: ['image', 'video'], frequency: ['period', 'manual', 'newtab', 'hourly', 'daily', '300', '900', '1800'], searchEngine: ['bing', 'google', 'baidu', 'duckduckgo'] })) if (choices.includes(s[key])) settings[key] = s[key];
  if (settings.backgroundType === 'video' && settings.frequency === 'period') settings.frequency = 'daily';
  for (const key of ['brightness', 'opacity', 'cardOpacity']) settings[key] = bounded(s[key], key === 'brightness' ? 15 : 0, 100, SETTINGS[key]);
  settings.blur = bounded(s.blur, 0, 30, 16);
  settings.query = short(s.query, 100, SETTINGS.query).trim() || SETTINGS.query;
  settings.name = short(s.name, 30);
  settings.pixabayKey = short(s.pixabayKey, 300);
  const ids = new Set();
  const unique = value => { let id = short(value, 80); if (!/^[a-z\d-]+$/i.test(id) || ids.has(id)) id = uid(); ids.add(id); return id; };
  const groups = value.groups.slice(0, 30).filter(g => g && typeof g === 'object').map(g => ({
    id: unique(g.id), name: short(g.name, 40, '新分组'), subtitle: short(g.subtitle, 40),
    links: (Array.isArray(g.links) ? g.links : []).slice(0, 150).filter(l => l && typeof l.url === 'string' && safeUrl(l.url)).map(l => ({ id: unique(l.id), title: short(l.title, 40, '快捷链接'), url: safeUrl(l.url), color: /^#[a-f\d]{6}$/i.test(l.color) ? l.color : '#53794e' })),
  }));
  const notes = value.notes.slice(0, 100).filter(n => n && typeof n.content === 'string').map(n => ({ id: unique(n.id), title: short(n.title, 80, '未命名笔记'), content: n.content.slice(0, 100000), updatedAt: bounded(n.updatedAt, 0, Date.now(), Date.now()) }));
  const layout = {};
  const layoutSpace = value.layoutSpace === 'page' ? 'page' : 'content';
  for (const id of ['clock', 'search', 'notes', 'quote', ...groups.map(g => `group-${g.id}`)]) {
    const position = value.layout?.[id] || base.layout[id] || { x: 5, y: 48 + groups.findIndex(g => `group-${g.id}` === id) * 35, w: 29, h: 245 };
    const w = bounded(position.w, layoutSpace === 'page' ? 1 : 18, layoutSpace === 'page' ? 100 : 95, 29);
    layout[id] = { x: bounded(position.x, 0, 100 - w, 5), y: bounded(position.y, 0, 600, 48), w, h: bounded(position.h, 60, 900, 245) };
  }
  let wallpaper = null;
  const wp = value.wallpaper;
  if (wp && ['image', 'video'].includes(wp.type)) {
    try {
      const media = new URL(wp.url);
      const allowed = wp.type === 'image' ? media.hostname === 'images.unsplash.com' : media.hostname === 'cdn.pixabay.com';
      if (allowed && media.protocol === 'https:') wallpaper = { type: wp.type, url: media.href, title: short(wp.title, 160), author: short(wp.author, 100), authorUrl: safeUrl(wp.authorUrl || '') || 'https://unsplash.com', pageUrl: safeUrl(wp.pageUrl || '') || 'https://unsplash.com', downloadUrl: short(wp.downloadUrl, 500), selectedAt: bounded(wp.selectedAt, 0, Date.now(), 0) };
      if (wallpaper?.type === 'image') {
        wallpaper.period = ['morning', 'day', 'evening', 'night'].includes(wp.period) ? wp.period : '';
        wallpaper.collectionId = short(wp.collectionId, 30);
        if (wp.source === 'unsplash-collection') wallpaper.source = 'unsplash-collection';
        // Retire built-in selections while keeping photos read from collection pages or the legacy API.
        if (!wallpaper.source && !wallpaper.downloadUrl) wallpaper = null;
      }
    } catch { /* A damaged wallpaper is replaced by the next online selection. */ }
  }
  return { version: 1, settings, groups, notes, layout, layoutSpace, wallpaper, activeNote: notes.some(n => n.id === value.activeNote) ? value.activeNote : notes[0]?.id || '' };
}
const STORAGE_KEY = 'qipage-state-v1';
export async function readState() {
  try {
    const value = globalThis.chrome?.storage?.local ? (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] : JSON.parse(localStorage.getItem(STORAGE_KEY));
    return value ? normalize(value) : defaults();
  } catch { return defaults(); }
}
export async function writeState(state) {
  if (globalThis.chrome?.storage?.local) await chrome.storage.local.set({ [STORAGE_KEY]: state });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function watchState(callback) {
  if (globalThis.chrome?.storage?.onChanged) chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[STORAGE_KEY]?.newValue) callback(changes[STORAGE_KEY].newValue); });
  else window.addEventListener('storage', event => { if (event.key === STORAGE_KEY && event.newValue) { try { callback(JSON.parse(event.newValue)); } catch { /* Keep the current state. */ } } });
}
export async function readCache(key) {
  try {
    if (globalThis.chrome?.storage?.local) return (await chrome.storage.local.get(key))[key];
    return JSON.parse(localStorage.getItem(key));
  } catch { return null; }
}
export async function writeCache(key, value) {
  if (globalThis.chrome?.storage?.local) await chrome.storage.local.set({ [key]: value });
  else localStorage.setItem(key, JSON.stringify(value));
}
