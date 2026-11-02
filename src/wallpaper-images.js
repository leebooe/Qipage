import { localImage } from './local-images.js';
import { is4kPicsumImageUrl } from './picsum-source.js';

const CACHE_NAME = 'qipage-wallpaper-images-v1';
const MAX_IMAGES = 6;
const downloads = new Map();
let cachePromise;

function imageUrl(value) {
  const url = new URL(value);
  if (!is4kPicsumImageUrl(value)) throw new Error('4K 图片来源无效。');
  return url.href;
}

function imageCache() {
  if (!cachePromise) cachePromise = (async () => {
    const cache = await globalThis.caches?.open(CACHE_NAME);
    if (!cache) return null;
    for (const key of await cache.keys()) if (!is4kPicsumImageUrl(key.url)) await cache.delete(key);
    return cache;
  })().catch(() => null);
  return cachePromise;
}

async function storeImage(cache, url, blob) {
  if (!cache) return;
  try {
    // Reinsert the entry so eviction follows its latest use.
    await cache.delete(url);
    await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type } }));
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(key);
  } catch { /* The downloaded image remains usable when local storage is full. */ }
}

export async function hasWallpaperImage(value) {
  try { return Boolean(await (await imageCache())?.match(imageUrl(value))); }
  catch { return false; }
}

export async function cacheWallpaperImage(value, priority = 'auto') {
  const url = imageUrl(value);
  if (downloads.has(url)) return downloads.get(url);
  const pending = (async () => {
    const cache = await imageCache();
    let cached;
    try { cached = await cache?.match(url); } catch { /* Fetch a fresh copy. */ }
    if (cached) {
      const blob = await cached.blob();
      if (blob.size && blob.type.startsWith('image/')) {
        await storeImage(cache, url, blob);
        return blob;
      }
      try { await cache.delete(url); } catch { /* Replace the damaged entry below. */ }
    }
    const response = await fetch(url, {
      cache: 'force-cache', credentials: 'omit', referrerPolicy: 'no-referrer',
      priority, signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`图片暂时无法加载（${response.status}）。`);
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith('image/')) throw new Error('图片内容暂时无法读取。');
    await storeImage(cache, url, blob);
    return blob;
  })();
  downloads.set(url, pending);
  try { return await pending; }
  finally { downloads.delete(url); }
}

export async function wallpaperImage(value) {
  const uploaded = localImage(value);
  if (uploaded) return { url: uploaded, release() {} };
  try {
    const blob = await cacheWallpaperImage(value, 'high');
    const url = URL.createObjectURL(blob);
    return { url, release: () => URL.revokeObjectURL(url) };
  } catch {
    // The normal image loader can still use the remote URL if file caching is unavailable.
    return { url: imageUrl(value), release() {} };
  }
}

export async function forgetWallpaperImage(value) {
  try { await (await imageCache())?.delete(imageUrl(value)); }
  catch { /* A failed cache cleanup does not prevent loading the remote image. */ }
}
