const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(id => id.endsWith('.css') ? { default: new Proxy({}, { get: (_, name) => name }) }
    : id === './LanguageProvider' ? { useTranslation: () => ({ t: text => text, locale: 'en-GB' }) } : require(id), module, module.exports);
  return module.exports;
}
const { formatDiscordText: format, insertDiscordLink } = load('lib/discord-formatting.ts');
const Preview = load('components/DiscordMessagePreview.tsx').default;

test('spoilers hide selected text or the whole draft and toggle back without losing words', () => {
  const selected = format('Keep the secret safe', 9, 15, 'spoiler');
  assert.equal(selected.text, 'Keep the ||secret|| safe');
  assert.equal(selected.text.slice(selected.start, selected.end), 'secret');
  assert.equal(format(selected.text, selected.start, selected.end, 'spoiler').text, 'Keep the secret safe');
  const whole = format('One line\nAnother line', 3, 3, 'spoiler');
  assert.equal(whole.text, '||One line\nAnother line||');
  assert.equal(format(whole.text, 0, 0, 'spoiler').text, 'One line\nAnother line');
});
test('formatting combines bold and italic while preserving the words selected', () => {
  const bold = format('hello world', 6, 11, 'bold');
  assert.equal(bold.text, 'hello **world**');
  const both = format(bold.text, bold.start, bold.end, 'italic');
  assert.equal(both.text, 'hello ***world***');
  assert.equal(both.text.slice(both.start, both.end), 'world');
  assert.equal(format(both.text, both.start, both.end, 'italic').text, bold.text);
});
test('paragraph tools start at line boundaries, number multiple lines and exclude a trailing unselected line', () => {
  assert.equal(format('before\nApples\nOranges\nafter', 9, 22, 'numbered').text, 'before\n1. Apples\n2. Oranges\nafter');
  const bullets = format('Apples\nOranges\n', 0, 15, 'bullet');
  assert.equal(bullets.text, '- Apples\n- Oranges\n');
  assert.equal(format(bullets.text, bullets.start, bullets.end, 'bullet').text, 'Apples\nOranges\n');
  assert.equal(format('Hello world', 6, 11, 'h2').text, '## Hello world');
  assert.equal(format('## Hello world', 3, 14, 'subtext').text, '-# Hello world');
  assert.equal(format('\nHello', 0, 0, 'quote').text, '> text\nHello');
});
test('code blocks preserve literal content and can be toggled off', () => {
  const code = format('first\na < b\nlast', 6, 11, 'codeblock');
  assert.equal(code.text, 'first\n```\na < b\n```\nlast');
  assert.equal(format(code.text, code.start, code.end, 'codeblock').text, 'first\na < b\nlast');
});
test('text links preserve adjacent text and refuse executable URLs', () => {
  assert.equal(insertDiscordLink('Go here now', 3, 7, 'our website', 'https://example.com/a(b)').text, 'Go [our website](https://example.com/a%28b%29) now');
  assert.throws(() => insertDiscordLink('text', 0, 4, 'click', 'javascript:alert(1)'), /valid/);
  assert.throws(() => insertDiscordLink('text', 0, 4, 'click', 'https://user:password@example.com'), /valid/);
});
test('preview escapes HTML, hides spoiler content, renders nested styles and keeps code literal', () => {
  const markup = renderToStaticMarkup(React.createElement(Preview, { text: '# Heading\n- First\n1. Second\n-# small\n__***styled***__\n||hidden||\n```\n||literal|| <script>\n```\n<img src=x onerror=alert(1)>' }));
  assert.match(markup, /heading1/);
  assert.match(markup, /listPreview/);
  assert.match(markup, /subtextPreview/);
  assert.match(markup, /<u><strong><em>styled<\/em><\/strong><\/u>/);
  assert.match(markup, /aria-label="Reveal spoiler" aria-expanded="false"><span aria-hidden="true">hidden/);
  assert.match(markup, /\|\|literal\|\| &lt;script&gt;/);
  assert.ok(!markup.includes('<img'));
});
