import { pathTo, positionOf } from '../../model/scenario';
import type { AstNode, FunctionValue, Scenario, Span, StepView } from '../../model/types';

interface Props {
  scenario: Scenario;
  view: StepView;
  onHover: (span: Span | null) => void;
}

interface Ctx {
  source: string;
  focus: string | undefined;
  path: Set<string>;
  functions: readonly FunctionValue[];
  onHover: Props['onHover'];
}

function label(n: AstNode): string {
  if (n.kind === 'Name') return n.text;
  return n.text ? `${n.kind} ${n.text}` : n.kind;
}

function Item({ node, level, ctx, inFocus, children }: { node: AstNode; level: number; ctx: Ctx; inFocus: boolean; children: AstNode[] }) {
  const isFocus = node.id === ctx.focus;
  const onPath = !isFocus && ctx.path.has(node.id);
  const pos = positionOf(ctx.source, node.span.start);
  const values = ctx.functions.filter((f) => f.declaration === node.id);
  const cls = ['ast-row', `ak-${node.kind}`, isFocus ? 'is-focus' : '', onPath ? 'is-path' : '', inFocus && !isFocus ? 'in-focus' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <li role="treeitem" aria-level={level} aria-selected={isFocus} aria-expanded={children.length ? true : undefined}>
      <div className={cls} onMouseEnter={() => ctx.onHover(node.span)} onMouseLeave={() => ctx.onHover(null)}>
        {node.role && <span className="ast-role mono">{node.role}</span>}
        <span className="ast-kind">{node.kind === 'Name' ? 'param' : node.kind}</span>
        {node.kind === 'Name' ? <span className="ast-text mono">{label(node)}</span> : node.text && <span className="ast-text mono">{node.text}</span>}
        <span className="ast-pos mono">
          {pos.line}:{pos.column}
        </span>
        {values.map((f) => (
          <span key={f.id} className="ast-value mono" title={`함수 값 ${f.name}이 이 node를 code로 사용합니다`}>
            code of fn {f.name}
          </span>
        ))}
      </div>
      {children.length > 0 && (
        <ul role="group">
          {children.map((c) => (
            <Item key={c.id} node={c} level={level + 1} ctx={ctx} inFocus={inFocus || isFocus} children={[...c.children]} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function AstTree({ scenario, view, onHover }: Props) {
  if (view.statementsShown === 0) return <p className="empty">아직 AST가 없습니다. parser는 lexer가 모든 token을 만든 뒤에 실행됩니다.</p>;
  const focus = view.def.astFocus;
  const ctx: Ctx = {
    source: scenario.source,
    focus,
    path: new Set(focus ? pathTo(scenario.ast, focus) : []),
    functions: view.runtime.functions,
    onHover,
  };
  const shown = scenario.ast.children.slice(0, view.statementsShown);
  const pending = scenario.ast.children.length - shown.length;
  return (
    <div className="ast-wrap">
      <ul className="ast" role="tree" aria-label="AST (Abstract syntax tree)">
        <Item node={scenario.ast} level={1} ctx={ctx} inFocus={false} children={shown} />
      </ul>
      {pending > 0 && <p className="ast-pending mono">… 아직 파싱하지 않은 최상위 문장 {pending}개</p>}
    </div>
  );
}
