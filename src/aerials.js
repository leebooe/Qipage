// Catalogue and place names from aerial-tv; see vendor/aerial-tv-LICENSE.txt.
export const AERIAL_SOURCE_URL = 'https://www.apple.com/apple-tv-4k/';
export const AERIAL_CATEGORIES = [
  ['all', '全部风景'], ['landscapes', '自然风光'], ['cities', '城市航拍'],
  ['space', '太空俯瞰'], ['underwater', '水下世界'],
];
export const AERIAL_QUALITIES = [['auto', '自动 · 优先 4K'], ['4k', '4K SDR · HEVC'], ['1080p', '1080p · H.264']];

export function isAerialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'sylvan.apple.com' && !url.port && !url.username && !url.password
      && !url.search && !url.hash && /^\/(?:Aerials\/2x\/)?Videos\/[a-z\d_.-]+\.mov$/i.test(url.pathname);
  } catch { return false; }
}

let cataloguePromise, uhdSupport;
let hdOnly = false;

async function catalogue() {
  if (!cataloguePromise) {
    cataloguePromise = (async () => {
      const response = await fetch(new URL('../assets/aerials.json', import.meta.url), { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('航拍目录暂时无法读取，请稍后重试。');
      const data = await response.json();
      const films = data.videos?.filter(film => film.id && isAerialUrl(film.url) && isAerialUrl(film.uhd)
        && AERIAL_CATEGORIES.some(([key]) => key !== 'all' && key === film.category));
      if (!films?.length) throw new Error('航拍目录暂时无法解析，请重新加载扩展。');
      return films;
    })().catch(error => { cataloguePromise = null; throw error; });
  }
  return cataloguePromise;
}

async function supportsUhd() {
  if (!uhdSupport) uhdSupport = (async () => {
    const contentType = 'video/mp4; codecs="hvc1.1.6.L150.B0"';
    const canPlay = Boolean(document.createElement('video').canPlayType(contentType));
    if (!canPlay) return false;
    if (!navigator.mediaCapabilities?.decodingInfo) return canPlay;
    try {
      const info = await Promise.race([
        navigator.mediaCapabilities.decodingInfo({
          type: 'file', video: { contentType, width: 3840, height: 2160, bitrate: 12000000, framerate: 30 },
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 2000)),
      ]);
      return info ? info.supported && info.smooth : canPlay;
    } catch { return canPlay; }
  })();
  return uhdSupport;
}

async function qualityFor(settings) {
  if (hdOnly || settings.aerialQuality === '1080p') return '1080p';
  return await supportsUhd() ? '4k' : '1080p';
}

function wallpaperFor(film, quality, settings, selectedAt = Date.now()) {
  const url = quality === '4k' ? film.uhd : film.url;
  return {
    type: 'video', source: 'apple-aerial', id: film.id, category: film.category,
    url, quality, qualityPreference: settings.aerialQuality, selectedAt,
    title: (film.captions?.[0]?.[1] || film.label || '航拍风景').replaceAll('\u00a0', ' '),
    author: '', authorUrl: AERIAL_SOURCE_URL, pageUrl: url,
  };
}

export async function chooseAerial(settings, current) {
  const films = (await catalogue()).filter(film => settings.aerialCategory === 'all' || film.category === settings.aerialCategory);
  if (!films.length) throw new Error('当前分类暂时没有航拍视频，请选择其他风景。');
  const choices = films.filter(film => film.id !== current?.id);
  const available = choices.length ? choices : films;
  const film = available[Math.floor(Math.random() * available.length)];
  return wallpaperFor(film, await qualityFor(settings), settings);
}

export async function prepareAerial(wallpaper, settings) {
  const film = (await catalogue()).find(film => film.id === wallpaper.id);
  if (!film) throw new Error('这段航拍已更新，请换一段风景。');
  return wallpaperFor(film, await qualityFor(settings), settings, wallpaper.selectedAt);
}

export async function lowerAerial(wallpaper) {
  if (wallpaper.quality !== '4k') return null;
  hdOnly = true;
  const film = (await catalogue()).find(film => film.id === wallpaper.id);
  return film ? wallpaperFor(film, '1080p', { aerialQuality: wallpaper.qualityPreference }, wallpaper.selectedAt) : null;
}
