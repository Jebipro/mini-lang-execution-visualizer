import type { StepView } from '../../model/types';

export function ExplanationPanel({ view }: { view: StepView }) {
  const { explain } = view.def;
  return (
    <section className="panel explain-panel" aria-labelledby="explain-h">
      <header className="panel-head">
        <h2 id="explain-h">
          <span className="panel-letter" aria-hidden="true">
            D
          </span>
          설명
        </h2>
      </header>
      <p className="headline" aria-live="polite">
        {explain.headline}
      </p>
      <h3>무엇이 바뀌었나?</h3>
      <ul className="changed">
        {explain.changed.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <h3>왜 이렇게 동작하나?</h3>
      <p>{explain.why}</p>
      <h3>여기서 볼 것</h3>
      <p>{explain.lookAt}</p>
      <h3>실제 Mini-Lang 코드</h3>
      <ul className="real">
        {explain.real.map((r) => (
          <li key={`${r.file}-${r.symbol}`}>
            <code className="real-file">{r.file}</code> <code className="real-symbol">{r.symbol}</code>
            {r.note && <span className="muted"> — {r.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
