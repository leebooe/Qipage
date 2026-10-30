import { readCache, writeCache } from './store.js';
import { COLLECTION, timePeriod } from './wallpaper-collections.js';
export { COLLECTION, TIME_PERIODS, timePeriod } from './wallpaper-collections.js';
const utm = '?utm_source=qipage&utm_medium=referral';
function localDay(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
export function builtin(index) {
  const pool = index === undefined ? COLLECTION.filter(photo => photo.period === timePeriod().id) : COLLECTION;
  const selected = index === undefined ? localDay() : index;
  return { ...pool[((selected % pool.length) + pool.length) % pool.length], type: 'image', selectedAt: Date.now() };
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'API 密钥无效或权限不足，请在设置中更新。' : response.status === 429 ? '壁纸请求达到服务限额，请稍后再试。' : `壁纸服务暂时不可用（${response.status}）。`);
  return response.json();
}
export async function chooseWallpaper(settings, current, force = false) {
  if (settings.backgroundType === 'video') {
    if (!settings.pixabayKey) throw new Error('请在「壁纸与外观」中填写 Pixabay API Key，开启动态壁纸。');
    // Cache each query for 24 hours. The raw API key never enters cache keys.
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(settings.pixabayKey)))].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 16);
    const cacheKey = `qipage-pixabay-${digest}`;
    let cache = await readCache(cacheKey);
    const query = settings.query.trim();
    let hits = cache?.queries?.[query]?.hits;
    if (!hits || Date.now() - cache.queries[query].at > 86400000) {
      const params = new URLSearchParams({ key: settings.pixabayKey, q: query, per_page: '30', safesearch: 'true', video_type: 'film' });
      const data = await request(`https://pixabay.com/api/videos/?${params}`);
      hits = data.hits || [];
      const queries = Object.fromEntries(Object.entries(cache?.queries || {}).filter(([, v]) => Date.now() - v.at <= 86400000).slice(-19));
      queries[query] = { hits, at: Date.now() };
      await writeCache(cacheKey, { queries });
    }
    const available = hits.map(hit => ({ hit, video: hit.videos?.medium || hit.videos?.small })).filter(v => v.video?.url);
    if (!available.length) throw new Error('这个主题暂时没有视频，试试 forest、ocean 或 nature。');
    const choices = available.filter(v => v.video.url !== current?.url);
    const { hit, video } = (choices.length ? choices : available)[Math.floor(Math.random() * (choices.length || available.length))];
    return { type: 'video', url: video.url, author: hit.user, authorUrl: `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/`, pageUrl: hit.pageURL, title: hit.tags, selectedAt: Date.now() };
  }
  const period = timePeriod();
  if (settings.unsplashKey) {
    const params = new URLSearchParams({ collections: period.collectionId, orientation: 'landscape', content_filter: 'high' });
    const photo = await request(`https://api.unsplash.com/photos/random?${params}`, { headers: { Authorization: `Client-ID ${settings.unsplashKey}`, 'Accept-Version': 'v1' } });
    const imageUrl = new URL(photo.urls.full);
    imageUrl.searchParams.set('w', '2560');
    imageUrl.searchParams.set('q', '85');
    imageUrl.searchParams.set('fit', 'crop');
    imageUrl.searchParams.set('auto', 'format');
    return { type: 'image', period: period.id, collectionId: period.collectionId, url: imageUrl.href, author: photo.user.name, authorUrl: `${photo.user.links.html}${utm}`, pageUrl: `${photo.links.html}${utm}`, title: `${period.label} · ${photo.alt_description || '今日的自然之境'}`, downloadUrl: photo.links.download_location, selectedAt: Date.now() };
  }
  const pool = COLLECTION.filter(photo => photo.period === period.id);
  const previous = pool.findIndex(photo => photo.url === current?.url);
  const index = force || previous >= 0 ? (previous + 1) % pool.length : localDay() % pool.length;
  return builtin(COLLECTION.indexOf(pool[index]));
}
export async function trackSelection(wallpaper, key) {
  if (!key || !wallpaper?.downloadUrl) return;
  try {
    const url = new URL(wallpaper.downloadUrl);
    if (url.origin !== 'https://api.unsplash.com' || !/^\/photos\/[^/]+\/download$/.test(url.pathname)) return;
    await request(url.href, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' } });
  } catch { /* Attribution and display remain available when tracking is offline. */ }
}
export function isDue(settings, wallpaper, newTab = false) {
  if (!wallpaper || wallpaper.type !== settings.backgroundType) return true;
  if (settings.frequency === 'manual') return false;
  if (settings.backgroundType === 'image' && (wallpaper.period !== timePeriod().id || wallpaper.collectionId !== timePeriod().collectionId)) return true;
  if (settings.frequency === 'period') return new Date(wallpaper.selectedAt).toDateString() !== new Date().toDateString();
  if (settings.frequency === 'newtab') return newTab;
  if (settings.frequency === 'daily') return new Date(wallpaper.selectedAt).toDateString() !== new Date().toDateString();
  const interval = settings.frequency === 'hourly' ? 3600000 : Number(settings.frequency) * 1000;
  return Date.now() - wallpaper.selectedAt >= interval;
}
