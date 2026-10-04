import type { Scenario, Span, StepView, Token } from '../../model/types';
import { tokenCategory } from './category';

interface Props {
  scenario: Scenario;
  view: StepView;
  onHover: (span: Span | null) => void;
}

function TokenChip({ token, active, fresh, onHover }: { token: Token; active: boolean; fresh: boolean; onHover: Props['onHover'] }) {
  const category = tokenCategory(token.kind);
  const kindIsText = token.kind === token.lexeme;
  return (
    <li
      className={`tok tk-${category}${active ? ' is-active' : ''}${fresh ? ' is-fresh' : ''}`}
      onMouseEnter={() => onHover(token.span)}
      onMouseLeave={() => onHover(null)}
      title={`${token.kind} · offsets ${token.span.start}–${token.span.end} · ${token.line}:${token.column}`}
    >
      {/* the real TokenKind: keywords and symbols use their own text as the kind */}
      <span className="tok-kind mono">{kindIsText ? `'${token.kind}'` : token.kind}</span>
      <span className="tok-lexeme mono">
        {token.kind === 'EOF' ? '∅' : token.lexeme}
        {token.literal !== undefined && token.kind === 'number' && <span className="tok-literal"> = {token.literal}</span>}
      </span>
      <span className="tok-pos mono">
        {token.line}:{token.column}
      </span>
    </li>
  );
}

export function TokenStream({ scenario, view, onHover }: Props) {
  const shown = scenario.tokens.slice(0, view.tokensShown);
  const [from, to] = view.def.activeTokens ?? [-1, -1];
  const freshFrom = view.def.phase === 'lex' ? (view.def.activeTokens?.[0] ?? 0) : Infinity;
  if (shown.length === 0) {
    return <p className="empty">아직 token이 없습니다. Next를 누르면 lexer가 실행됩니다.</p>;
  }
  const byLine = new Map<number, Token[]>();
  for (const t of shown) byLine.set(t.line, [...(byLine.get(t.line) ?? []), t]);
  return (
    <div className="tokens">
      <p className="tokens-count mono">
        {shown.length} / {scenario.tokens.length} tokens
      </p>
      {[...byLine].map(([line, tokens]) => (
        <div key={line} className="tok-line">
          <span className="tok-ln mono" aria-hidden="true">
            L{line}
          </span>
          <ol className="tok-list" aria-label={`${line}행의 token`}>
            {tokens.map((t) => (
              <TokenChip key={t.index} token={t} active={t.index >= from && t.index <= to} fresh={t.index >= freshFrom} onHover={onHover} />
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
