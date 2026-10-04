import { useEffect, useState } from 'react';
import type { Scenario, Span, StepView, SyntaxView } from '../../model/types';
import { TokenStream } from '../tokens/TokenStream';
import { AstTree } from './AstTree';

interface Props {
  scenario: Scenario;
  view: StepView;
  onHover: (span: Span | null) => void;
}

const TABS: ReadonlyArray<readonly [SyntaxView, string]> = [
  ['tokens', 'Tokens'],
  ['ast', 'AST'],
];

export function SyntaxPanel({ scenario, view, onHover }: Props) {
  // the step chooses the tab; a click overrides it until the step changes
  const [tab, setTab] = useState<SyntaxView>(view.def.view);
  useEffect(() => setTab(view.def.view), [view]);

  return (
    <section className="panel syntax-panel" aria-labelledby="syntax-h">
      <header className="panel-head">
        <h2 id="syntax-h">
          <span className="panel-letter" aria-hidden="true">
            B
          </span>
          {tab === 'tokens' ? 'Tokens' : 'AST (Abstract syntax tree)'}
        </h2>
        <div className="tabs" role="tablist" aria-label="구문 보기 방식">
          {TABS.map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls="syntax-body"
              className={`tab${tab === id ? ' is-selected' : ''}`}
              onClick={() => setTab(id)}
            >
              {text}
            </button>
          ))}
        </div>
      </header>
      <div id="syntax-body" role="tabpanel" aria-labelledby={`tab-${tab}`} className="syntax-body">
        {tab === 'tokens' ? <TokenStream scenario={scenario} view={view} onHover={onHover} /> : <AstTree scenario={scenario} view={view} onHover={onHover} />}
      </div>
    </section>
  );
}
