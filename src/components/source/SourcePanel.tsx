import type { Scenario, Span, StepView } from '../../model/types';
import { tokenCategory } from '../tokens/category';

interface Props {
  scenario: Scenario;
  view: StepView;
  hover: Span | null;
}

interface Piece {
  text: string;
  start: number;
  end: number;
  category: string | null;
  /** True for whitespace that begins a line (indentation); never highlighted. */
  indent: boolean;
}

/** Split the source into token / gap pieces, then into lines. */
function linesOf(scenario: Scenario): Piece[][] {
  const { source, tokens } = scenario;
  const flat: Omit<Piece, 'indent'>[] = [];
  let at = 0;
  for (const t of tokens) {
    if (t.kind === 'EOF') break;
    if (t.span.start > at) flat.push({ text: source.slice(at, t.span.start), start: at, end: t.span.start, category: null });
    flat.push({ text: t.lexeme, start: t.span.start, end: t.span.end, category: tokenCategory(t.kind) });
    at = t.span.end;
  }
  if (at < source.length) flat.push({ text: source.slice(at), start: at, end: source.length, category: null });

  const lines: Piece[][] = [[]];
  for (const piece of flat) {
    const parts = piece.text.split('\n');
    let offset = piece.start;
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push([]);
        offset += 1;
      }
      const line = lines[lines.length - 1];
      if (part && line) line.push({ text: part, start: offset, end: offset + part.length, category: piece.category, indent: line.length === 0 && piece.category === null });
      offset += part.length;
    });
  }
  return lines;
}

const inside = (p: Piece, s: Span | null | undefined): boolean => !!s && s.start < s.end && p.start >= s.start && p.end <= s.end && !p.indent;

export function SourcePanel({ scenario, view, hover }: Props) {
  const lines = linesOf(scenario);
  const focus = view.def.focus;
  const caret = focus && focus.start === focus.end ? focus.start : null;
  let lineStart = 0;

  return (
    <section className="panel source-panel" aria-labelledby="source-h">
      <header className="panel-head">
        <h2 id="source-h">
          <span className="panel-letter" aria-hidden="true">
            A
          </span>
          Source
        </h2>
        <span className="muted mono">{scenario.id}.lang</span>
      </header>
      <pre className="code" aria-label="Mini-Lang 소스 코드">
        {lines.map((pieces, i) => {
          const start = lineStart;
          lineStart += (pieces.at(-1)?.end ?? start) - start + 1;
          const lineEnd = pieces.at(-1)?.end ?? start;
          const hasFocus = pieces.some((p) => inside(p, focus));
          return (
            <span key={i} className={`code-line${hasFocus ? ' has-focus' : ''}`}>
              <span className="ln" aria-hidden="true">
                {i + 1}
              </span>
              <span className="code-text">
                {pieces.map((p) => {
                  const cls = [p.category ? `tk-${p.category}` : '', inside(p, focus) ? 'is-focus' : '', inside(p, hover) ? 'is-hover' : '']
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <span key={p.start} className={cls || undefined}>
                      {p.text}
                    </span>
                  );
                })}
                {caret !== null && caret >= start && caret <= lineEnd && pieces.length === 0 && (
                  <span className="eof-caret mono" title={`EOF · offset ${caret}`}>
                    EOF
                  </span>
                )}
              </span>
              {'\n'}
            </span>
          );
        })}
      </pre>
    </section>
  );
}
