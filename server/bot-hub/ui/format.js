(function (root) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function inline(text, names = {}, depth = 0) {
    if (depth > 8) return escape(text);
    // Only generated tags become HTML. User text and Discord names are always escaped.
    const pattern = /```([\s\S]*?)```|`([^`\n]+)`|<@([!&]?)(\d+)>|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\|\|([\s\S]+?)\|\||\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let result = '', offset = 0, match;
    while ((match = pattern.exec(text))) {
      result += escape(text.slice(offset, match.index));
      const nested = value => inline(value, names, depth + 1);
      if (match[1] !== undefined) result += '<pre><code>' + escape(match[1].replace(/^\w*\n/, '')) + '</code></pre>';
      else if (match[2] !== undefined) result += '<code>' + escape(match[2]) + '</code>';
      else if (match[4]) result += '<span class="mention">@' + escape(names[match[4]] || (match[3] === '&' ? 'role' : 'member')) + '</span>';
      else if (match[5]) result += '<strong>' + nested(match[5]) + '</strong>';
      else if (match[6]) result += '<u>' + nested(match[6]) + '</u>';
      else if (match[7]) result += '<s>' + nested(match[7]) + '</s>';
      else if (match[8]) result += '<span class="spoiler" title="Spoiler — hover to reveal">' + nested(match[8]) + '</span>';
      else if (match[9] || match[10]) result += '<em>' + nested(match[9] || match[10]) + '</em>';
      else if (match[11]) result += '<span class="md-link">' + escape(match[11]) + '</span>';
      offset = pattern.lastIndex;
    }
    return result + escape(text.slice(offset));
  }
  function preview(text, names = {}) {
    // Preserve fenced blocks across line breaks before applying line formatting.
    const blocks = String(text).split(/(```[\s\S]*?```)/g);
    return blocks.map((block, index) => index % 2 ? inline(block, names) : block.split('\n').map(line => {
      if (line.startsWith('> ')) return '<blockquote>' + inline(line.slice(2), names) + '</blockquote>';
      if (/^#{1,3} /.test(line)) return '<span class="md-heading">' + inline(line.replace(/^#{1,3} /, ''), names) + '</span>';
      if (/^[-*] /.test(line)) return '• ' + inline(line.slice(2), names);
      return inline(line, names);
    }).join('\n')).join('');
  }
  const markers = { bold: ['**', '**'], italic: ['*', '*'], underline: ['__', '__'], strike: ['~~', '~~'], code: ['`', '`'], codeblock: ['```\n', '\n```'], spoiler: ['||', '||'], heading: ['## ', ''], list: ['- ', ''], quote: ['> ', ''] };
  function formatSelection(text, start, end, kind) {
    const pair = markers[kind];
    if (!pair) throw new Error('Unknown text format.');
    let selection = text.slice(start, end) || 'text';
    let before = pair[0], after = pair[1];
    if (['quote', 'list', 'heading', 'codeblock'].includes(kind) && start > 0 && text[start - 1] !== '\n') before = '\n' + before;
    if (['quote', 'list'].includes(kind)) selection = selection.replace(/\n/g, '\n' + pair[0]);
    const result = text.slice(0, start) + before + selection + after + text.slice(end);
    return { text: result, start: start + before.length, end: start + before.length + selection.length };
  }
  const api = { escape, preview, formatSelection };
  if (typeof module !== 'undefined') module.exports = api;
  else root.HubFormat = api;
})(typeof window !== 'undefined' ? window : globalThis);
