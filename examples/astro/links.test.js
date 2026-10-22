import test from 'node:test';
import assert from 'node:assert/strict';
import { fixInternalLinks as fix } from './links.js';

test('own domain, plain link with automatic new tab (with or without nofollow): back to a plain link', () => {
  for (const rel of ['noopener', 'nofollow noopener']) {
    assert.equal(fix(`<a href="https://www.example.com/products/widget" target="_blank" rel="${rel}">x</a>`),
                 '<a href="https://www.example.com/products/widget">x</a>');
    assert.equal(fix(`<a href="/blog/other/" rel="${rel}" target="_blank">x</a>`), '<a href="/blog/other/">x</a>');
  }
  assert.equal(fix('<a href="https://cms.example.com/p/" target="_blank" rel="nofollow noopener">x</a>'),
               '<a href="https://cms.example.com/p/">x</a>');
});

test('own domain, editor-set new tab with noreferrer: tab kept, appended nofollow removed', () => {
  assert.equal(fix('<a href="https://www.example.com/pricing" rel="noreferrer noopener nofollow" target="_blank">x</a>'),
               '<a href="https://www.example.com/pricing" rel="noreferrer noopener" target="_blank">x</a>');
  const keep = '<a href="https://www.example.com/x" rel="noreferrer noopener" target="_blank">x</a>';
  assert.equal(fix(keep), keep);
});

test('own domain, other cases untouched', () => {
  for (const a of ['<a href="https://www.example.com/x">x</a>', '<a href="/x" rel="author">x</a>', '<a href="https://www.example.com/x" rel="nofollow">x</a>'])
    assert.equal(fix(a), a);
});

test('external links always end up nofollow', () => {
  assert.equal(fix('<a href="https://www.shop.example/x" target="_blank" rel="noopener">x</a>'),
               '<a href="https://www.shop.example/x" target="_blank" rel="noopener nofollow">x</a>');
  assert.equal(fix('<a href="https://x.org/a" target="_blank" rel="noreferrer noopener">x</a>'),
               '<a href="https://x.org/a" target="_blank" rel="noreferrer noopener nofollow">x</a>');
  assert.equal(fix('<a href="https://x.org/a">x</a>'), '<a href="https://x.org/a" rel="nofollow">x</a>');
  assert.equal(fix('<a class="c" href="https://x.org/a" />'), '<a class="c" href="https://x.org/a" rel="nofollow" />');
});

test('external links that already have nofollow are untouched', () => {
  for (const a of ['<a href="https://x.org/a" rel="nofollow noopener" target="_blank">x</a>', '<a href="https://x.org/a" target="_blank" rel="noreferrer noopener nofollow">x</a>'])
    assert.equal(fix(a), a);
});

test('look-alike hosts and other subdomains count as external', () => {
  assert.equal(fix('<a href="https://blog.example.com/x" target="_blank" rel="noopener">x</a>'), '<a href="https://blog.example.com/x" target="_blank" rel="noopener nofollow">x</a>');
  assert.equal(fix('<a href="https://notexample.com/x">x</a>'), '<a href="https://notexample.com/x" rel="nofollow">x</a>');
  assert.equal(fix('<a href="https://www.example.com.evil.example/x">x</a>'), '<a href="https://www.example.com.evil.example/x" rel="nofollow">x</a>');
});

test('mailto, tel, anchors and protocol-relative links are not touched', () => {
  for (const a of ['<a href="mailto:a@b.com">x</a>', '<a href="tel:+911234">x</a>', '<a href="#faq">x</a>', '<a href="//cdn.example.com/x">x</a>'])
    assert.equal(fix(a), a);
});

test('only anchors are rewritten; surrounding HTML is preserved', () => {
  assert.equal(fix('<p>See <a href="https://www.example.com/c" target="_blank" rel="noopener">this</a> and <a href="https://x.org/">that</a>.</p>'),
               '<p>See <a href="https://www.example.com/c">this</a> and <a href="https://x.org/" rel="nofollow">that</a>.</p>');
});
