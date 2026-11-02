export const PICSUM_SOURCE_URL = 'https://picsum.photos';
export const PICSUM_IMAGE_WIDTH = 3840;
export const PICSUM_IMAGE_HEIGHT = 2160;

export function picsumListUrl(page = 1) {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('图片列表页码无效。');
  return new URL(`/v2/list?page=${page}&limit=100`, PICSUM_SOURCE_URL);
}

export function picsumImageUrl(id) {
  if (!/^\d{1,20}$/.test(String(id))) throw new Error('图片编号无效。');
  return `${PICSUM_SOURCE_URL}/id/${id}/${PICSUM_IMAGE_WIDTH}/${PICSUM_IMAGE_HEIGHT}.webp`;
}

export function is4kPicsumImageUrl(value) {
  if (!isPicsumImageUrl(value)) return false;
  return /^\/id\/\d{1,20}\/3840\/2160(?:\.(?:jpg|webp))?$/.test(new URL(value).pathname);
}

export function isPicsumImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      && ['picsum.photos', 'fastly.picsum.photos'].includes(url.hostname)
      && /^\/id\/\d{1,20}\/\d+\/\d+(?:\.(?:jpg|webp))?$/.test(url.pathname);
  } catch { return false; }
}
