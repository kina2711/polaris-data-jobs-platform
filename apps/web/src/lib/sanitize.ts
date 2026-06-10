import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'small',
    'mark',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'a',
    'span',
    'div',
    'blockquote',
    'code',
    'pre',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    // Cho phép button vào pipeline để exclusiveFilter có thể drop cả tag + children.
    // Nếu không allow, button bị strip ở mode "discard" và text "Show more/less"
    // (LinkedIn widget) lộ ra.
    'button',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {},
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Drop entire <button> + children (LinkedIn "Show more/less" widget). Cần
  // button trong allowedTags ở trên để filter này áp được.
  exclusiveFilter: (frame) => frame.tag === 'button',
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      },
    }),
  },
};

export function sanitizeJobDescription(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS)
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
