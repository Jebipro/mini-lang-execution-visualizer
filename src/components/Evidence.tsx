const FACTS: ReadonlyArray<readonly [string, string]> = [
  ['직접 작성한 lexer', 'src/lexer.ts'],
  ['Recursive-descent parser: 우선순위 단계마다 함수 하나', 'src/parser.ts'],
  ['Tree-walk interpreter: return은 Completion record로 전달', 'src/interpreter.ts'],
  ['Environment → BindingCell chain 위의 lexical closure', 'src/environment.ts'],
  ['span과 line:column으로 소스 위치를 알려 주는 오류', 'src/errors.ts · src/source-location.ts'],
  ['예제 프로그램 15개를 기대 출력과 비교', 'examples/'],
  ['재현 가능한 fuzz campaign, adversarial review와 cross-model review', 'tests/fuzz · ADVERSARIAL_REVIEW.md'],
];

export function Evidence() {
  return (
    <footer className="evidence">
      <h2>실제 Mini-Lang interpreter를 바탕으로 만들었습니다</h2>
      <ul>
        {FACTS.map(([fact, where]) => (
          <li key={fact}>
            {fact} <span className="mono muted">{where}</span>
          </li>
        ))}
      </ul>
      <p className="muted">
        이 화면의 token, AST, 출력은 이 프로젝트의 conformance test가 실제 Mini-Lang lexer, parser, interpreter와 대조해
        확인합니다. runtime 단계는 같은 semantics를 직접 옮겨 적은 모델입니다.
      </p>
    </footer>
  );
}
