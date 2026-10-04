import { formatValue } from '../../model/runtime';
import type { Runtime, Value } from '../../model/types';

export function envName(rt: Runtime, id: string): string {
  const env = rt.envs.find((e) => e.id === id);
  return env ? `Env #${env.number}` : id;
}

/** A RuntimeValue. Function values also name the environment they closed over. */
export function ValueChip({ rt, value }: { rt: Runtime; value: Value }) {
  if (value.tag === 'user-function') {
    const fn = rt.functions.find((f) => f.id === value.fnId);
    return (
      <span className="val val-fn mono" data-fn-ref={value.fnId}>
        {formatValue(rt, value)}
        {fn && <span className="val-closure"> closure → {envName(rt, fn.closure)}</span>}
      </span>
    );
  }
  return <span className={`val val-${value.tag} mono`}>{formatValue(rt, value)}</span>;
}
