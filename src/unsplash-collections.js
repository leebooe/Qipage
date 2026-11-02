import { readCache, writeCache } from './store.js';
import { collectionPhotosUrl } from './wallpaper-collections.js';

const CACHE_TTL = 86400000;
const RETRY_DELAY = 300000;

function accessError(url) {
  const error = new Error('Unsplash 暂时限制了图片访问，请打开图片来源查看站点提示，再回来重试。');
  error.code = 'unsplash-access';
  error.accessUrl = url;
  return error;
}

function photoDetails(photo) {
  try {
    const url = new URL(photo.urls?.raw || photo.urls?.full);
    if (!photo.id || url.protocol !== 'https:' || url.hostname !== 'images.unsplash.com') return null;
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    url.searchParams.set('w', '2560');
    url.searchParams.set('q', '85');
    return {
      id: String(photo.id), url: url.href, title: photo.alt_description || '今日的自然之境',
      author: photo.user?.name || '',
      authorUrl: `https://unsplash.com/@${encodeURIComponent(photo.user?.username || '')}?utm_source=qipage&utm_medium=referral`,
      pageUrl: `https://unsplash.com/photos/${encodeURIComponent(photo.id)}?utm_source=qipage&utm_medium=referral`,
    };
  } catch { return null; }
}

async function readPage(collectionId, page) {
  const remoteUrl = collectionPhotosUrl(collectionId, page);
  // Extension host permissions allow direct requests. The local preview uses its own server.
  const inExtension = Boolean(globalThis.chrome?.runtime?.id);
  const url = inExtension ? remoteUrl.href : `/__qipage/unsplash/collections/${collectionId}/photos?${remoteUrl.searchParams}`;
  const response = await fetch(url, {
    cache: 'no-store', credentials: inExtension ? 'include' : 'same-origin',
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(18000),
  });
  if (response.status === 404 && page > 1) return [];
  if (response.status === 401 || response.status === 403) throw accessError(remoteUrl.href);
  if (response.status === 429) throw new Error('Unsplash 暂时限制了请求频率，请稍后再试。');
  if (!response.ok) throw new Error(`合集暂时无法读取（${response.status}），请稍后再试。`);
  if (!response.headers.get('content-type')?.includes('json')) {
    const body = await response.text();
    if (/anubis|checking your browser|verify you are human|captcha|challenge-platform|检查您的浏览器/i.test(body)) throw accessError(remoteUrl.href);
    throw new Error('Unsplash 返回了网页内容，图片列表暂时无法读取，请稍后重试。');
  }
  const photos = await response.json();
  if (!Array.isArray(photos)) throw new Error('合集图片列表暂时无法解析，请稍后再试。');
  return photos;
}

export async function collectionPhotos(collectionId) {
  const cacheKey = `qipage-unsplash-public-v1-${collectionId}`;
  const cache = await readCache(cacheKey);
  const cached = Array.isArray(cache?.photos) ? cache.photos.filter(photo => photo?.id && photo?.url) : [];
  if (cached.length && (Date.now() - cache.at < CACHE_TTL || Date.now() < cache.retryAt)) return cached;
  try {
    const photos = new Map();
    const seen = new Set();
    // Continue through the last page so every collection member enters the selection pool.
    for (let page = 1; ; page++) {
      const batch = await readPage(collectionId, page);
      if (!batch.length) break;
      const count = seen.size;
      for (const item of batch) {
        if (item?.id) seen.add(item.id);
        const photo = photoDetails(item);
        if (photo) photos.set(photo.id, photo);
      }
      if (seen.size === count) throw new Error('合集分页读取暂时中断，请稍后再试。');
    }
    const available = [...photos.values()];
    if (!available.length) throw new Error('当前合集暂时没有可用图片，请稍后再试。');
    // Store only a fully read collection; incomplete responses preserve the previous cache.
    await writeCache(cacheKey, { photos: available, at: Date.now() });
    return available;
  } catch (error) {
    if (!cached.length) throw error;
    await writeCache(cacheKey, { ...cache, retryAt: Date.now() + RETRY_DELAY });
    return cached;
  }
}
