// U+2028 and U+2029 are valid in JSON but terminate lines in JavaScript.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g');
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g');

/**
 * Serialise structured data for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is not safe inside a script element: a value such as
 * `</script><script>…` would close the tag and run attacker-controlled markup.
 * Escaping `<`, `>`, `&` and the JavaScript line separators keeps the output
 * valid JSON while making it inert as HTML.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029');
}
