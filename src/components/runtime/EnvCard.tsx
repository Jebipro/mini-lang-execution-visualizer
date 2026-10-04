import { capturedBy, envStatus, type EnvStatus } from '../../model/runtime';
import type { Env, Runtime } from '../../model/types';
import { envName, ValueChip } from './ValueChip';

interface Props {
  rt: Runtime;
  env: Env;
  fresh: boolean;
  step: number;
}

const STATUS_TEXT: Record<EnvStatus, string> = {
  running: '▶ 실행 중',
  waiting: '⏸ 대기 중',
  captured: '◆ 호출 종료 · closure 때문에 유지',
  released: '✕ 해제됨 · 도달 불가',
  idle: '',
};

export function EnvCard({ rt, env, fresh, step }: Props) {
  const status = envStatus(rt, env);
  const keepers = capturedBy(rt, env.id);
  // a function value created on this very step closes over this call environment
  const capturing = env.kind === 'call' ? keepers.filter((f) => f.createdAt === step) : [];
  const visits = rt.lookups.flatMap((l) => l.path.map((id, i) => ({ l, id, i, hit: i === l.path.length - 1 }))).filter((v) => v.id === env.id);
  const parent = env.parent ? rt.envs.find((e) => e.id === env.parent) : null;
  const cls = ['env', `env-${env.kind}`, `st-${status}`, fresh ? 'is-new' : '', capturing.length ? 'is-capturing' : '', visits.some((v) => v.hit) ? 'lk-hit' : visits.length ? 'lk-miss' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cls} data-env={env.id} aria-label={`${envName(rt, env.id)} ${env.label}`}>
      <header className="env-head">
        <span className="env-id mono">{envName(rt, env.id)}</span>
        <span className="env-label">{env.label}</span>
        {STATUS_TEXT[status] && <span className={`env-status st-${status}`}>{STATUS_TEXT[status]}</span>}
      </header>
      <p className="env-parent mono">
        parent → {parent ? `${envName(rt, parent.id)} ${parent.label}` : '없음'}
        {status === 'captured' && keepers.length > 0 && (
          <span className="env-keeper"> · {keepers.map((f) => `fn ${f.name}`).join(', ')}의 closure</span>
        )}
      </p>

      {capturing.map((f) => (
        <p key={f.id} className="capture-badge">
          ◆ <span className="mono">fn {f.name}</span>이 capture함 — 그래서 이 호출이 끝나도 남을 수 있음
        </p>
      ))}

      {visits.map((v) => (
        <p key={`${v.l.name}-${v.i}`} className={`lookup-badge ${v.hit ? 'is-hit' : 'is-miss'}`} style={{ animationDelay: `${v.i * 0.35}s` }}>
          <span className="mono">
            {v.i + 1}. {v.l.name} 찾기
          </span>{' '}
          {v.hit ? '✓ 여기서 찾음' : '✗ 없음 → parent로'}
        </p>
      ))}

      {env.cells.length === 0 ? (
        <p className="env-empty mono">binding 없음</p>
      ) : (
        <table className="cells">
          <thead className="visually-hidden">
            <tr>
              <th scope="col">이름</th>
              <th scope="col">BindingCell</th>
              <th scope="col">값</th>
            </tr>
          </thead>
          <tbody>
            {env.cells.map((cell) => {
              const fx = rt.fx.filter((f) => f.env === env.id && f.name === cell.name).map((f) => `fx-${f.effect}`);
              const init = cell.state.kind === 'initialized';
              return (
                <tr key={cell.name} className={['cell-row', ...fx].join(' ')}>
                  <th scope="row" className="cell-name mono">
                    {cell.name}
                  </th>
                  <td className="cell-box">
                    <span className={`cell mono ${init ? 'is-init' : 'is-uninit'}`}>
                      <span className="cell-tag">cell</span>
                      {init ? 'initialized' : 'uninitialized'}
                      {!cell.mutable && <span className="cell-const">const</span>}
                    </span>
                  </td>
                  <td className="cell-value">
                    {cell.state.kind === 'initialized' ? <ValueChip rt={rt} value={cell.state.value} /> : <span className="val val-tdz mono">TDZ</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </article>
  );
}
