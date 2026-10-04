import type { Runtime, Scenario } from '../../model/types';

export function OutputPanel({ scenario, runtime }: { scenario: Scenario; runtime: Runtime }) {
  return (
    <section className={`panel output-panel${runtime.complete ? ' is-complete' : ''}`} aria-labelledby="output-h">
      <header className="panel-head">
        <h2 id="output-h">Output</h2>
        {runtime.complete && <span className="done-badge">✓ 실행 완료</span>}
      </header>
      <pre className="terminal mono" aria-live="polite">
        <span className="term-prompt">$ mini-lang {scenario.id}.lang</span>
        {'\n'}
        {runtime.output.length === 0 ? (
          <span className="muted">(아직 출력 없음)</span>
        ) : (
          runtime.output.map((line, i) => (
            <span key={i} className="term-line">
              {line}
              {'\n'}
            </span>
          ))
        )}
      </pre>
    </section>
  );
}
