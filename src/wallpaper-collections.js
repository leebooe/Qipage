const utm = '?utm_source=qipage&utm_medium=referral';

export const TIME_PERIODS = [
  { id: 'morning', label: '早晨', hours: '05:00–10:00', collectionId: 'GD4aOSg4yQE' },
  { id: 'day', label: '白天', hours: '10:00–17:00', collectionId: 'o8uX55RbBPs' },
  { id: 'evening', label: '傍晚', hours: '17:00–20:00', collectionId: '3M2rKTckZaQ' },
  { id: 'night', label: '夜间', hours: '20:00–05:00', collectionId: 'bHDh4Ae7O8o' },
].map(period => ({ ...period, url: `https://unsplash.com/collections/${period.collectionId}${utm}` }));

export function timePeriod(date = new Date()) {
  const hour = date.getHours();
  return TIME_PERIODS[hour >= 5 && hour < 10 ? 0 : hour >= 10 && hour < 17 ? 1 : hour >= 17 && hour < 20 ? 2 : 3];
}

export function collectionPhotosUrl(collectionId, page = 1) {
  if (!TIME_PERIODS.some(period => period.collectionId === collectionId) || !Number.isSafeInteger(page) || page < 1) throw new Error('请选择有效的背景合集。');
  const url = new URL(`https://unsplash.com/napi/collections/${collectionId}/photos`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', '30');
  return url;
}

