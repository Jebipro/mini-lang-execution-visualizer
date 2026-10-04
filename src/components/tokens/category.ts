const KEYWORDS = new Set(['let', 'fn', 'if', 'else', 'while', 'return', 'true', 'false', 'null']);
const OPERATORS = new Set(['+', '-', '*', '/', '%', '!', '=', '<', '>', '!=', '==', '<=', '>=', '&&', '||']);

/** Display category of a Mini-Lang TokenKind (for colouring only). */
export function tokenCategory(kind: string): string {
  if (KEYWORDS.has(kind)) return 'keyword';
  if (OPERATORS.has(kind)) return 'operator';
  if (kind === 'identifier' || kind === 'number' || kind === 'string' || kind === 'EOF') return kind.toLowerCase();
  return 'punct';
}
