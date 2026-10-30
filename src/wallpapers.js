import { readCache, writeCache } from './store.js';
import { timePeriod } from './wallpaper-collections.js';
import { collectionPhotos } from './unsplash-collections.js';
export { TIME_PERIODS, timePeriod } from './wallpaper-collections.js';
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'API 密钥无效或权限不足，请在设置中更新。' : response.status === 429 ? '壁纸请求达到服务限额，请稍后再试。' : `壁纸服务暂时不可用（${response.status}）。`);
  return response.json();
}
export async function chooseWallpaper(settings, current) {
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
  const photos = await collectionPhotos(period.collectionId);
  const choices = photos.filter(photo => photo.url.split('?')[0] !== current?.url?.split('?')[0]);
  const candidates = choices.length ? choices : photos;
  const photo = candidates[Math.floor(Math.random() * candidates.length)];
  return { ...photo, type: 'image', source: 'unsplash-collection', period: period.id, collectionId: period.collectionId, title: `${period.label} · ${photo.title}`, selectedAt: Date.now() };
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
