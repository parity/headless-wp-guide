import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from './routes.js';

const req = (path, method = 'GET') => new Request('https://www.example.com' + path, { method });
const act = (path, method, env) => decide(req(path, method), env);

test('pages go to astro, with WP fallback on 404', () => {
  for (const p of ['/blog/', '/blog/page/2/', '/blog/some-post/', '/blog/category/news/updates/page/2/', '/blog/tag/x/', '/blog/author/jane-doe/']) {
    assert.deepEqual(act(p), { action: 'astro', fallbackToOriginOn404: true }, p);
  }
});

test('WordPress-owned assets and feeds go to origin', () => {
  for (const p of [
    '/blog/wp-content/uploads/2026/08/unnamed.jpg', '/blog/wp-includes/js/x.js', '/blog/wp-cron.php',
    '/blog/sitemap_index.xml', '/blog/post-sitemap.xml', '/blog/category-sitemap.xml', '/blog/main-sitemap.xsl',
    '/blog/feed/', '/blog/comments/feed/', '/blog/category/news/feed/', '/blog/some-post/feed/', '/blog/feed/atom/',
  ]) assert.equal(act(p).action, 'origin', p);
});

test('a post whose slug merely contains "feed" or "sitemap" still goes to astro', () => {
  assert.equal(act('/blog/what-is-a-feed-in-seo/').action, 'astro');
  assert.equal(act('/blog/how-to-build-a-sitemap-guide/').action, 'astro');
});

test('admin and login redirect to the Access-protected CMS host, keeping path and query', () => {
  assert.deepEqual(act('/blog/wp-admin/'), { action: 'redirect', status: 302, location: 'https://cms.example.com/wp-admin/' });
  assert.equal(act('/blog/wp-admin/post.php?post=1&action=edit').location, 'https://cms.example.com/wp-admin/post.php?post=1&action=edit');
  assert.equal(act('/blog/wp-login.php?redirect_to=x').location, 'https://cms.example.com/wp-login.php?redirect_to=x');
});

test('xmlrpc and public wp-json are blocked', () => {
  assert.equal(act('/blog/xmlrpc.php').action, 'block');
  assert.equal(act('/blog/wp-json/').action, 'block');
  assert.equal(act('/blog/wp-json/wp/v2/users').action, 'block');
});

test('/blog gets a trailing slash, keeping the query string', () => {
  assert.deepEqual(act('/blog'), { action: 'redirect', status: 301, location: '/blog/' });
  assert.equal(decide(new Request('https://www.example.com/blog?utm_source=x')).location, '/blog/?utm_source=x');
});

test('site search and shortlinks stay on WordPress', () => {
  assert.equal(act('/blog/?s=hello').action, 'origin');
  assert.equal(act('/blog/?p=4192').action, 'origin');
  assert.equal(act('/blog/?utm_source=x').action, 'astro');
});

test('non-GET: only the revalidate ping is ours', () => {
  assert.equal(act('/blog/revalidate/', 'POST').action, 'astro');
  assert.equal(act('/blog/wp-comments-post.php', 'POST').action, 'origin');
  assert.equal(act('/blog/some-post/', 'POST').action, 'origin');
});

test('MODE=origin sends everything to WordPress (kill switch)', () => {
  for (const p of ['/blog/', '/blog/some-post/', '/blog/tag/x/']) assert.equal(act(p, 'GET', { MODE: 'origin' }).action, 'origin');
});
