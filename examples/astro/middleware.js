import { defineMiddleware } from 'astro:middleware';

/* global __BUILD_ID__ */
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
const TTL = 3600; // seconds a rendered page stays cached; edits bump `version` and skip this

// Edge HTML cache. Key = build id + version (KV) + path: a deploy or a revalidate ping invalidates everything at once.
export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, locals } = context;
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (!cache || request.method !== 'GET' || url.pathname.endsWith('/revalidate/')) {
    const res = await next();
    return url.hostname.endsWith('.workers.dev') ? withHeaders(res, 'SKIP', url.hostname) : res;
  }

  const kv = locals.runtime?.env?.BLOG_CACHE;
  const version = (kv && (await kv.get('version', { cacheTtl: 30 }).catch(() => null))) || '0';
  const key = new Request(`https://blog-cache.internal/${BUILD}/v${version}${url.pathname}`);

  const hit = await cache.match(key);
  if (hit) return withHeaders(hit, 'HIT', url.hostname);

  const res = await next();
  if (res.status !== 200) return withHeaders(res, 'BYPASS', url.hostname);

  const toStore = new Response(res.clone().body, res);
  toStore.headers.set('Cache-Control', `public, max-age=${TTL}`);
  locals.runtime?.ctx?.waitUntil(cache.put(key, toStore));
  return withHeaders(res, 'MISS', url.hostname);
});

// Browsers always revalidate; only our edge cache holds pages.
function withHeaders(res, state, hostname) {
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  out.headers.set('X-Blog-Cache', state);
  // Staging (workers.dev) must never be indexed; production reaches us through the router under www.example.com.
  if (hostname?.endsWith('.workers.dev')) out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
