// Link attributes in post bodies are normalised here so the output matches what the public blog always produced,
// regardless of how Rank Math is configured on the CMS host (cms.example.com, where example.com looks external):
//   - links to our own domain: plain (no automatic nofollow, no automatic new tab)
//   - links to other sites:    always rel="nofollow" (the old site had this on 100% of external links)
//
// Known limit: an editor's hand-set "open in new tab" with only `noopener`, or `nofollow noopener`, on an internal link is
// byte-identical to the automatic one and is also normalised (about 30 of ~2,450 internal links on the old site).
const OWN_HOSTS = new Set(['www.example.com', 'example.com', 'cms.example.com']);

const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i')) || [])[1];

function classify(href) {
  if (href.startsWith('/') && !href.startsWith('//')) return 'own';
  if (!/^https?:\/\//i.test(href)) return null; // mailto:, tel:, #anchor, javascript: ...
  try { return OWN_HOSTS.has(new URL(href).hostname.toLowerCase()) ? 'own' : 'external'; } catch { return null; }
}

const setRel = (tag, tokens) =>
  /\srel="[^"]*"/i.test(tag) ? tag.replace(/\srel="[^"]*"/i, ` rel="${tokens.join(' ')}"`) : tag.replace(/\s*\/?>$/, (end) => ` rel="${tokens.join(' ')}"${end}`);

export function fixInternalLinks(html = '') {
  return html.replace(/<a\s[^>]*>/gi, (tag) => {
    const href = attr(tag, 'href');
    const kind = href ? classify(href) : null;
    if (!kind) return tag;

    const tokens = (attr(tag, 'rel') || '').split(/\s+/).filter(Boolean);
    const newTab = /\starget="_blank"/i.test(tag);

    if (kind === 'external') {
      return tokens.includes('nofollow') ? tag : setRel(tag, [...tokens, 'nofollow']);
    }

    // own domain
    if (!tokens.length) return tag;
    const stripTab = (t) => t.replace(/\srel="[^"]*"/i, '').replace(/\starget="_blank"/i, '');
    // automatic new tab on a plain link: rel="noopener" [+ nofollow], target="_blank"
    if (newTab && ((tokens.length === 1 && tokens[0] === 'noopener') ||
                   (tokens.length === 2 && tokens[0] === 'nofollow' && tokens[1] === 'noopener'))) return stripTab(tag);
    // editor-set new tab (noopener/noreferrer) that automatically got "nofollow" appended
    if (tokens.length > 1 && tokens[tokens.length - 1] === 'nofollow') return setRel(tag, tokens.slice(0, -1));
    return tag;
  });
}
