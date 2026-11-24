(function () {
  'use strict';
  const UV_CDN = 'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.10/dist/';

  function computeBasePath() {
    try {
      const p = (self.location && self.location.pathname) || '/';
      if (p.includes('/uv/')) {
        const prefix = p.slice(0, p.indexOf('/uv/'));
        return prefix === '/' ? '' : prefix;
      }
      if (p.endsWith('/')) {
        const trimmed = p.slice(0, -1);
        return trimmed === '/' ? '' : trimmed;
      }
      // Strip filename like /index.html or /sw.js
      const lastSeg = p.split('/').pop() || '';
      if (lastSeg.includes('.')) {
        const dir = p.replace(/\/[^/]*$/, '');
        return dir === '/' ? '' : dir;
      }
      return p === '/' ? '' : p;
    } catch (e) {
      return '';
    }
  }

  const basePath = computeBasePath();

  self.__uv$config = {
    prefix: basePath + '/uv/service/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: UV_CDN + 'uv.handler.js',
    client: UV_CDN + 'uv.client.js',
    bundle: UV_CDN + 'uv.bundle.js',
    config: basePath + '/uv/uv.config.js',
    sw: UV_CDN + 'uv.sw.js'
  };
})();
