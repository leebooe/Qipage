import { readCache, writeCache } from './store.js';
import { PICSUM_SOURCE_URL, PICSUM_IMAGE_WIDTH, PICSUM_IMAGE_HEIGHT, picsumListUrl, picsumImageUrl, is4kPicsumImageUrl } from './picsum-source.js';

const CACHE_KEY = 'qipage-picsum-catalogue-4k-v1';
let loading = null;

function photoDetails(photo) {
  const id = String(photo?.id ?? '');
  if (!/^\d{1,20}$/.test(id)) return null;
  if (!(photo.width >= PICSUM_IMAGE_WIDTH && photo.height >= PICSUM_IMAGE_HEIGHT)) return null;
  let pageUrl = PICSUM_SOURCE_URL;
  try {
    const original = new URL(photo.url);
    if (original.protocol === 'https:' && original.hostname === 'unsplash.com' && original.pathname.startsWith('/photos/')) pageUrl = original.href;
  } catch { /* The provider link remains available when original attribution is missing. */ }
  return {
    id, source: 'picsum', url: picsumImageUrl(id), title: '今日风景', width: Number(photo.width), height: Number(photo.height),
    author: typeof photo.author === 'string' ? photo.author.slice(0, 100) : '',
    authorUrl: pageUrl, pageUrl,
  };
}

async function readPage(page) {
  const inExtension = Boolean(globalThis.chrome?.runtime?.id);
  const url = inExtension ? picsumListUrl(page).href : `/__qipage/picsum/photos?page=${page}`;
  const response = await fetch(url, {
    cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(18000),
  });
  if (response.status === 429) throw new Error('Picsum 暂时限制了请求频率，请稍后重试。');
  if (!response.ok) throw new Error(`Picsum 图片列表暂时无法读取（${response.status}）。`);
  if (!response.headers.get('content-type')?.includes('json')) throw new Error('Picsum 图片列表响应异常，请稍后重试。');
  const photos = await response.json();
  if (!Array.isArray(photos)) throw new Error('Picsum 图片列表暂时无法解析，请稍后重试。');
  return photos;
}

async function loadCatalogue() {
  const cache = await readCache(CACHE_KEY);
  const cached = Array.isArray(cache?.photos) ? cache.photos.filter(photo => photo?.source === 'picsum' && is4kPicsumImageUrl(photo.url) && photo.width >= PICSUM_IMAGE_WIDTH && photo.height >= PICSUM_IMAGE_HEIGHT) : [];
  if (cached.length && (Date.now() - cache.at < 86400000 || Date.now() < cache.retryAt)) return cached;
  try {
    const photos = new Map();
    const seen = new Set();
    for (let page = 1; ; page++) {
      const batch = await readPage(page);
      if (!batch.length) break;
      const count = seen.size;
      for (const item of batch) {
        if (item?.id !== undefined && item.id !== null) seen.add(String(item.id));
        const photo = photoDetails(item);
        if (photo) photos.set(photo.id, photo);
      }
      if (seen.size === count) throw new Error('Picsum 图库分页读取中断，请稍后重试。');
    }
    const available = [...photos.values()];
    if (!available.length) throw new Error('Picsum 图库暂时没有可用的 4K 图片，请稍后重试。');
    await writeCache(CACHE_KEY, { photos: available, at: Date.now() }).catch(() => {});
    return available;
  } catch (error) {
    if (!cached.length) throw error;
    await writeCache(CACHE_KEY, { ...cache, retryAt: Date.now() + 300000 }).catch(() => {});
    return cached;
  }
}

export async function picsumPhotos() {
  if (!loading) loading = loadCatalogue().finally(() => { loading = null; });
  return loading;
}
