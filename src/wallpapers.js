import { timePeriod } from './wallpaper-collections.js';
import { collectionPhotos } from './unsplash-collections.js';
import { chooseAerial } from './aerials.js';
export { TIME_PERIODS, timePeriod } from './wallpaper-collections.js';
export async function chooseWallpaper(settings, current) {
  if (settings.backgroundType === 'video') return chooseAerial(settings, current);
  const period = timePeriod();
  const photos = await collectionPhotos(period.collectionId);
  const choices = photos.filter(photo => photo.url.split('?')[0] !== current?.url?.split('?')[0]);
  const candidates = choices.length ? choices : photos;
  const photo = candidates[Math.floor(Math.random() * candidates.length)];
  return { ...photo, type: 'image', source: 'unsplash-collection', period: period.id, collectionId: period.collectionId, title: `${period.label} · ${photo.title}`, selectedAt: Date.now() };
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
