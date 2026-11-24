(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        reject(new Error('Please select a valid image file (PNG, JPG, WebP, or GIF).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode selected image.'));
      img.src = src;
    });
  }

  /**
   * Resizes & center-crops an image into a square avatar/icon data URL
   * to keep localStorage fast and well within browser storage limits.
   */
  async function compressSquare(file, size) {
    const targetSize = size || 256;
    const rawUrl = await readFileAsDataUrl(file);
    const img = await loadImage(rawUrl);

    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');

    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);

    const webp = canvas.toDataURL('image/webp', 0.86);
    if (webp.startsWith('data:image/webp')) return webp;
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  /**
   * Resizes & center-crops an image into a wide 16:6 banner data URL.
   */
  async function compressBanner(file, maxWidth, maxHeight) {
    const w = maxWidth || 840;
    const h = maxHeight || 300;
    const rawUrl = await readFileAsDataUrl(file);
    const img = await loadImage(rawUrl);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const targetRatio = w / h;
    const srcRatio = img.width / img.height;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (srcRatio > targetRatio) {
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / targetRatio;
      sy = (img.height - sh) / 2;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

    const webp = canvas.toDataURL('image/webp', 0.84);
    if (webp.startsWith('data:image/webp')) return webp;
    return canvas.toDataURL('image/jpeg', 0.84);
  }

  window.Vesper.Media = {
    compressAvatar: (file) => compressSquare(file, 256),
    compressBanner: (file) => compressBanner(file, 840, 300)
  };
})();
