import { timePeriod } from './wallpaper-collections.js';
import { collectionPhotos } from './unsplash-collections.js';
import { chooseAerial } from './aerials.js';
import { readCache, writeCache } from './store.js';
import { cacheWallpaperImage, hasWallpaperImage } from './wallpaper-images.js';
export { TIME_PERIODS, timePeriod } from './wallpaper-collections.js';

const preloads = new Map();
const preparedKey = period => `qipage-prepared-wallpaper-v1-${period.collectionId}`;
const sameImage = (first, second) => first?.url?.split('?')[0] === second?.url?.split('?')[0];

async function randomImage(period, current) {
  const photos = await collectionPhotos(period.collectionId);
  const choices = photos.filter(photo => !sameImage(photo, current));
  const candidates = choices.length ? choices : photos;
  const photo = candidates[Math.floor(Math.random() * candidates.length)];
  return { ...photo, type: 'image', source: 'unsplash-collection', period: period.id, collectionId: period.collectionId, title: `${period.label} · ${photo.title}`, selectedAt: Date.now() };
}

async function preparedImage(period, current) {
  const prepared = await readCache(preparedKey(period));
  if (prepared?.type === 'image' && prepared.source === 'unsplash-collection'
    && prepared.collectionId === period.collectionId && prepared.period === period.id
    && Date.now() - prepared.preparedAt < 86400000 && !sameImage(prepared, current)
    && await hasWallpaperImage(prepared.url)) return prepared;
  return null;
}

export async function chooseWallpaper(settings, current) {
  if (settings.backgroundType === 'video') return chooseAerial(settings, current);
  const period = timePeriod();
  const prepared = await preparedImage(period, current);
  if (prepared) {
    await writeCache(preparedKey(period), null);
    const { preparedAt, ...photo } = prepared;
    return { ...photo, selectedAt: Date.now() };
  }
  return randomImage(period, current);
}

export async function preloadNextWallpaper(current) {
  if (current?.type !== 'image' || current.source === 'local-upload') return;
  const period = timePeriod();
  if (preloads.has(period.id)) return preloads.get(period.id);
  const pending = (async () => {
    if (await preparedImage(period, current)) return;
    const photo = await randomImage(period, current);
    await cacheWallpaperImage(photo.url, 'low');
    if (await hasWallpaperImage(photo.url)) await writeCache(preparedKey(period), { ...photo, preparedAt: Date.now() });
  })();
  preloads.set(period.id, pending);
  try { await pending; }
  finally { preloads.delete(period.id); }
}
export function isDue(settings, wallpaper, newTab = false) {
  if (!wallpaper || wallpaper.type !== settings.backgroundType) return true;
  if (settings.backgroundType === 'video' && (wallpaper.source !== 'apple-aerial'
    || wallpaper.qualityPreference !== settings.aerialQuality
    || (settings.aerialCategory !== 'all' && wallpaper.category !== settings.aerialCategory))) return true;
  if (settings.frequency === 'manual') return false;
  if (settings.backgroundType === 'image' && (wallpaper.period !== timePeriod().id || wallpaper.collectionId !== timePeriod().collectionId)) return true;
  if (settings.frequency === 'period') return new Date(wallpaper.selectedAt).toDateString() !== new Date().toDateString();
  if (settings.frequency === 'newtab') return newTab;
  if (settings.frequency === 'daily') return new Date(wallpaper.selectedAt).toDateString() !== new Date().toDateString();
  const interval = settings.frequency === 'hourly' ? 3600000 : Number(settings.frequency) * 1000;
  return Date.now() - wallpaper.selectedAt >= interval;
}
