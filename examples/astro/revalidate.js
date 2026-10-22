import { REVALIDATE_SECRET } from 'astro:env/server';

export const prerender = false;

// POST /blog/revalidate  (header x-revalidate-secret) -> invalidates the whole HTML cache.
export async function POST({ request, locals }) {
  const kv = locals.runtime?.env?.BLOG_CACHE;
  const given = request.headers.get('x-revalidate-secret') ?? '';
  if (!REVALIDATE_SECRET || !kv || !timingSafeEqual(given, REVALIDATE_SECRET)) {
    return new Response('Forbidden', { status: 403 });
  }
  const version = String(Date.now());
  await kv.put('version', version);
  return new Response(JSON.stringify({ ok: true, version }), { headers: { 'content-type': 'application/json' } });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
