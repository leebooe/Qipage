const LIMITS = { wallpaper: 2 * 1024 * 1024, icon: 128 * 1024 };

export function localImage(value, kind = 'wallpaper') {
  return typeof value === 'string' && value.length <= LIMITS[kind]
    && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
}

export async function uploadedImage(file, kind = 'wallpaper') {
  if (!file || !file.size) throw new Error('请选择图片文件。');
  if (file.size > 20 * 1024 * 1024) throw new Error('请选择 20 MB 以内的图片。');
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|avif|gif|bmp|svg|ico)$/i.test(file.name)) throw new Error('请选择 PNG、JPG、WebP、SVG 或其他图片文件。');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器暂时无法处理这张图片。');
    if (kind === 'icon') {
      canvas.width = canvas.height = 128;
      const scale = Math.min(128 / image.naturalWidth, 128 / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      context.drawImage(image, (128 - width) / 2, (128 - height) / 2, width, height);
      const result = canvas.toDataURL('image/png');
      if (!localImage(result, kind)) throw new Error('图片处理失败，请换一张图片。');
      return result;
    }
    let scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#17281e';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', Math.max(.66, .88 - attempt * .04));
      if (localImage(result, kind)) return result;
      scale *= .8;
    }
    throw new Error('这张图片较大，请选择尺寸更小的图片。');
  } catch (error) {
    if (error.name === 'EncodingError' || error.name === 'SecurityError') throw new Error('这张图片暂时无法读取，请转换为 PNG、JPG 或 WebP 后上传。');
    throw error;
  } finally { URL.revokeObjectURL(source); }
}
