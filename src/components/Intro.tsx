import { SCENARIOS } from '../model/session';

interface Props {
  scenarioId: string;
  onScenario: (id: string) => void;
}

export function Intro({ scenarioId, onScenario }: Props) {
  return (
    <header className="intro">
      <div>
        <p className="eyebrow mono">Mini-Lang · lexer → parser → interpreter</p>
        <h1>Mini-Lang Execution Visualizer</h1>
        <p className="lead">
          Mini-Lang 코드가 <code>Source → Tokens → AST → Environment → Closure → Output</code>으로 처리되는 과정을 단계별로
          살펴봅니다. 함수가 자신을 만든 호출의 <strong>Environment</strong>를 <strong>closure</strong>로 붙잡는 순간도 볼 수
          있습니다.
        </p>
        <p className="notice">
          <span className="notice-tag mono">model</span>
          실제 Mini-Lang interpreter의 semantics를 바탕으로 만든 교육용 시각화입니다. 브라우저에서 원본 interpreter를 직접
          실행하는 것은 아닙니다.
        </p>
      </div>
      <fieldset className="presets">
        <legend>예제</legend>
        {SCENARIOS.map(({ scenario }) => (
          <label key={scenario.id} className={`preset${scenario.id === scenarioId ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="scenario"
              value={scenario.id}
              checked={scenario.id === scenarioId}
              onChange={() => onScenario(scenario.id)}
            />
            <span className="preset-title">{scenario.title}</span>
            <span className="preset-blurb">{scenario.blurb}</span>
          </label>
        ))}
      </fieldset>
    </header>
  );
}
