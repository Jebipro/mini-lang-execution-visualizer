import { useLayoutEffect, useRef, useState } from 'react';
import { findNode, positionOf } from '../../model/scenario';
import { COMPLETION_STAGES, type Runtime, type Scenario, type StepView } from '../../model/types';
import { EnvCard } from './EnvCard';
import { envName, ValueChip } from './ValueChip';

interface Props {
  scenario: Scenario;
  view: StepView;
  previous: Runtime | null;
}

/** Korean labels for COMPLETION_STAGES (the model keeps the English identifiers). */
const COMPLETION_STAGE_TEXT = ['Return 문', '문장 목록 (list)', '호출 경계 (Call)', '호출한 쪽의 값'] as const;

interface Arrow {
  id: string;
  d: string;
  fresh: boolean;
  primary: boolean;
}

/**
 * Measure the function cards and environment cards and draw one arrow per function value:
 * from its `closure` row to the environment it captured.
 */
function useCaptureArrows(area: React.RefObject<HTMLDivElement | null>, rt: Runtime, step: number): { arrows: Arrow[]; width: number; height: number } {
  const [layout, setLayout] = useState<{ arrows: Arrow[]; width: number; height: number }>({ arrows: [], width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = (): void => {
      const box = el.getBoundingClientRect();
      const arrows: Arrow[] = [];
      const fns = rt.functions.filter((f) => rt.envs.some((e) => e.id === f.closure));
      fns.forEach((fn, lane) => {
        const from = el.querySelector<HTMLElement>(`[data-closure-of="${fn.id}"]`);
        const to = el.querySelector<HTMLElement>(`[data-env="${fn.closure}"] .env-head`);
        if (!from || !to) return;
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const sx = a.right - box.left + 4;
        const sy = a.top + a.height / 2 - box.top;
        const ex = b.right - box.left + 4;
        const ey = b.top + b.height / 2 - box.top;
        const lx = box.width - 10 - lane * 14;
        const r = 8;
        const up = ey < sy;
        const v = up ? -r : r;
        arrows.push({
          id: fn.id,
          d: `M ${sx} ${sy} H ${lx - r} Q ${lx} ${sy} ${lx} ${sy + v} V ${ey - v} Q ${lx} ${ey} ${lx - r} ${ey} H ${ex + 6}`,
          fresh: fn.createdAt === step,
          primary: rt.envs.find((e) => e.id === fn.closure)?.kind === 'call',
        });
      });
      setLayout({ arrows, width: box.width, height: box.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [area, rt, step]);
  return layout;
}

export function RuntimePanel({ scenario, view, previous }: Props) {
  const rt = view.runtime;
  const area = useRef<HTMLDivElement>(null);
  const { arrows, width, height } = useCaptureArrows(area, rt, view.index);
  const prevEnvs = new Set(previous?.envs.map((e) => e.id) ?? []);
  const where = rt.current ? `${envName(rt, rt.current)} ${rt.envs.find((e) => e.id === rt.current)?.label ?? ''}` : null;
  const completion = rt.completion;
  // environments whose parent link a lookup walked through on this step
  const walked = new Set(rt.lookups.flatMap((l) => l.path.slice(0, -1)));

  return (
    <section className="panel runtime-panel" aria-labelledby="runtime-h">
      <header className="panel-head">
        <h2 id="runtime-h">
          <span className="panel-letter" aria-hidden="true">
            C
          </span>
          Runtime
        </h2>
        <span className="legend mono" aria-hidden="true">
          name → cell → value
        </span>
      </header>

      {rt.envs.length === 0 ? (
        <p className="empty">아직 environment가 없습니다. 실행은 프로그램 전체의 파싱이 끝난 뒤에 시작됩니다.</p>
      ) : (
        <>
          <dl className="run-status">
            <div>
              <dt>평가 위치</dt>
              <dd className="mono">{rt.complete ? '완료' : (where ?? '—')}</dd>
            </div>
            <div>
              <dt>Call stack</dt>
              <dd className="mono">
                {rt.stack.length === 0 ? (
                  <span className="muted">비어 있음 (최상위)</span>
                ) : (
                  rt.stack.map((f, i) => (
                    <span key={f.env} className="stack-frame">
                      {i > 0 && ' › '}
                      {f.label}
                    </span>
                  ))
                )}
              </dd>
            </div>
          </dl>

          <div className="env-area" ref={area}>
            <div className="env-chain">
              {rt.envs.map((env, i) => (
                <div key={env.id} className="env-slot">
                  {i > 0 && (
                    <div className={`parent-link mono${walked.has(env.id) ? ' is-walked' : ''}`} aria-hidden="true">
                      {env.parent === rt.envs[i - 1]?.id ? '↑ parent' : `↑ parent: ${env.parent ? envName(rt, env.parent) : 'none'}`}
                    </div>
                  )}
                  <EnvCard rt={rt} env={env} fresh={!prevEnvs.has(env.id)} step={view.index} />
                </div>
              ))}
            </div>

            {rt.functions.length > 0 && (
              <div className="fn-area">
                <h3 className="fn-area-h">Function values (함수 값)</h3>
                {rt.functions.map((fn) => {
                  const decl = findNode(scenario.ast, fn.declaration);
                  const pos = decl ? positionOf(scenario.source, decl.span.start) : null;
                  const closureEnv = rt.envs.find((e) => e.id === fn.closure);
                  return (
                    <article key={fn.id} className={`fn-card${fn.createdAt === view.index ? ' is-new' : ''}${closureEnv?.kind === 'call' ? ' is-capture' : ''}`}>
                      <header className="fn-head">
                        <span className="fn-tag mono">UserFunction</span> <span className="mono">{fn.name}</span>
                        <span className="muted mono">
                          ({fn.params.join(', ')}) · arity {fn.params.length}
                        </span>
                      </header>
                      <p className="fn-row mono">
                        <span className="fn-key">code</span> → Function {fn.name}
                        {pos && <span className="muted"> (line {pos.line})</span>}
                      </p>
                      <p className="fn-row mono" data-closure-of={fn.id}>
                        <span className="fn-key">closure</span> →{' '}
                        <strong>
                          {envName(rt, fn.closure)} {closureEnv?.label}
                        </strong>
                      </p>
                    </article>
                  );
                })}
              </div>
            )}

            <svg className="arrows" width={width} height={height} aria-hidden="true">
              <defs>
                <marker id="arrow-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L8 4 L0 8 z" className="arrow-head" />
                </marker>
              </defs>
              {arrows.map((a) => (
                <path
                  key={a.id}
                  d={a.d}
                  className={`arrow${a.fresh ? ' is-fresh' : ''}${a.primary ? ' is-primary' : ''}`}
                  pathLength={1}
                  markerEnd="url(#arrow-head)"
                />
              ))}
            </svg>
          </div>
        </>
      )}

      {rt.evalNote && (
        <p className="eval-note mono" aria-label="평가">
          {rt.evalNote}
        </p>
      )}

      {completion && (
        <div className="completion" aria-label="Completion 전달 경로">
          <p className="completion-value mono">
            Completion {'{'} kind: &apos;{completion.kind}&apos;
            {completion.value && (
              <>
                , value: <ValueChip rt={rt} value={completion.value} />
              </>
            )}{' '}
            {'}'}
          </p>
          <ol className="completion-path">
            {COMPLETION_STAGES.map((stage, i) => (
              <li key={stage} className={i < completion.stage ? 'is-done' : i === completion.stage ? 'is-current' : ''}>
                {COMPLETION_STAGE_TEXT[i] ?? stage}
                {i === completion.stage && <span className="visually-hidden"> (현재)</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
