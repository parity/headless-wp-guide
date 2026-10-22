// Decides where a request under /blog/ goes. Pure function: no I/O, easy to test.
//   astro    -> the headless frontend (service binding)
//   origin   -> the existing WordPress path (LB -> nginx -> droplet), unchanged
//   redirect -> send editors to the Access-protected CMS host
//   block    -> refuse
const CMS_HOST = 'https://cms.example.com';

const ORIGIN_PATHS = [
  /^\/blog\/wp-content\//,                         // images, uploads, theme assets
  /^\/blog\/wp-includes\//,
  /^\/blog\/wp-cron\.php$/,                        // WP-Cron loopback must keep reaching WordPress
  /^\/blog\/[\w-]*sitemap[\w-]*\.(xml|xsl)$/,      // Rank Math sitemaps + stylesheets
  /\/feed(\/(atom|rss2?|rdf))?\/?$/,               // /blog/feed/, /blog/comments/feed/, per-category feeds
];
const ADMIN_PATHS = /^\/blog\/(wp-admin(\/|$)|wp-login\.php$)/;
const BLOCKED_PATHS = [/^\/blog\/xmlrpc\.php$/, /^\/blog\/wp-json(\/|$)/];

export function decide(request, env = {}) {
  const url = new URL(request.url);
  const { pathname, searchParams } = url;
  const method = request.method;

  if (env.MODE === 'origin') return { action: 'origin' }; // kill switch: everything back to WordPress

  if (pathname === '/blog') return { action: 'redirect', status: 301, location: '/blog/' + url.search };

  if (BLOCKED_PATHS.some((re) => re.test(pathname))) return { action: 'block', status: 403 };

  if (ADMIN_PATHS.test(pathname)) {
    return { action: 'redirect', status: 302, location: CMS_HOST + pathname.replace(/^\/blog/, '') + url.search };
  }

  if (ORIGIN_PATHS.some((re) => re.test(pathname))) return { action: 'origin' };

  // WordPress-only query URLs: site search and shortlinks.
  if (pathname === '/blog/' && ['s', 'p', 'page_id', 'attachment_id'].some((k) => searchParams.has(k))) {
    return { action: 'origin' };
  }

  // Only the cache-revalidate ping is a non-GET the frontend handles.
  if (method !== 'GET' && method !== 'HEAD') {
    return pathname === '/blog/revalidate/' ? { action: 'astro' } : { action: 'origin' };
  }

  return { action: 'astro', fallbackToOriginOn404: true };
}
