import type { Cell, CompletionView, Env, EnvKind, FunctionValue, Runtime, Value } from './types';

/**
 * A small model of Mini-Lang's runtime structures (src/environment.ts, src/runtime-values.ts).
 *
 * Scenario steps describe their effects through this draft API. The operations keep the same
 * rules as the real implementation — reserve before initialize, initialize exactly once, lookup
 * walks the parent chain, reading an uninitialized cell is a TDZ error — so a scenario that
 * contradicts Mini-Lang's semantics fails while the states are being built (and in the tests).
 */

export class ModelError extends Error {}

export function emptyRuntime(): Runtime {
  return { envs: [], functions: [], current: null, stack: [], output: [], complete: false, fx: [], lookups: [], completion: null, evalNote: null };
}

export function num(value: number): Value {
  return { tag: 'number', value };
}

export const NULL_VALUE: Value = { tag: 'null' };

export class RuntimeDraft {
  constructor(
    readonly rt: Runtime,
    readonly step: number,
  ) {}

  env(id: string): Env {
    const env = this.rt.envs.find((e) => e.id === id);
    if (!env) throw new ModelError(`no environment ${id}`);
    return env;
  }

  fn(id: string): FunctionValue {
    const fn = this.rt.functions.find((f) => f.id === id);
    if (!fn) throw new ModelError(`no function ${id}`);
    return fn;
  }

  /** `new Environment(parent)` */
  createEnv(id: string, kind: EnvKind, label: string, parent: string | null): void {
    if (this.rt.envs.some((e) => e.id === id)) throw new ModelError(`duplicate environment ${id}`);
    if (parent !== null) this.env(parent);
    this.rt.envs.push({ id, number: this.rt.envs.length, kind, label, parent, cells: [], released: false });
  }

  /** `Environment.reserve` — a new cell in the uninitialized (TDZ) state. */
  reserve(envId: string, name: string, mutable = true): void {
    const env = this.env(envId);
    if (env.cells.some((c) => c.name === name)) throw new ModelError(`E_REDECLARE: '${name}' already declared in ${envId}`);
    env.cells.push({ name, mutable, state: { kind: 'uninitialized' } });
    this.rt.fx.push({ env: envId, name, effect: 'reserve' });
  }

  /** `Environment.initialize` — only legal on an uninitialized cell of this exact environment. */
  initialize(envId: string, name: string, value: Value): void {
    const cell = this.env(envId).cells.find((c) => c.name === name);
    if (!cell || cell.state.kind !== 'uninitialized') throw new ModelError(`invalid binding initialization of '${name}' in ${envId}`);
    cell.state = { kind: 'initialized', value };
    this.rt.fx.push({ env: envId, name, effect: 'initialize' });
  }

  /** prepare()'s third pass: a UserFunction whose closure is the environment being prepared. */
  defineFunction(fnId: string, name: string, declaration: string, params: readonly string[], envId: string): Value {
    this.rt.functions.push({ id: fnId, name, declaration, params, closure: envId, createdAt: this.step });
    const value: Value = { tag: 'user-function', fnId };
    this.initialize(envId, name, value);
    return value;
  }

  /** `Environment.lookup` + `reference` + `get`: walk the parent chain, record the trail, enforce TDZ. */
  lookup(name: string, from: string): Value {
    const path: string[] = [];
    let id: string | null = from;
    while (id !== null) {
      const env = this.env(id);
      path.push(id);
      const cell: Cell | undefined = env.cells.find((c) => c.name === name);
      if (cell) {
        this.rt.lookups.push({ name, path });
        if (cell.state.kind === 'uninitialized') throw new ModelError(`E_TDZ: '${name}' accessed before initialization`);
        this.rt.fx.push({ env: id, name, effect: 'read' });
        return cell.state.value;
      }
      id = env.parent;
    }
    throw new ModelError(`E_UNDEFINED: undefined variable '${name}'`);
  }

  /** Enter a user-function call: push a frame and evaluate in its environment. */
  enterCall(label: string, envId: string): void {
    this.env(envId);
    this.rt.stack.push({ label, env: envId });
    this.rt.current = envId;
  }

  /**
   * Leave the innermost call. The frame's environment stays only while a function value
   * still references it as its closure; otherwise it is released.
   */
  exitCall(): void {
    const frame = this.rt.stack.pop();
    if (!frame) throw new ModelError('no call to exit');
    this.rt.current = this.rt.stack.at(-1)?.env ?? this.globalId();
    if (capturedBy(this.rt, frame.env).length === 0) this.env(frame.env).released = true;
  }

  setCurrent(envId: string | null): void {
    if (envId !== null) this.env(envId);
    this.rt.current = envId;
  }

  completion(kind: CompletionView['kind'], value: Value | null, stage: number): void {
    this.rt.completion = { kind, value, stage };
  }

  note(text: string): void {
    this.rt.evalNote = text;
  }

  /** The builtin `print`: formats like Mini-Lang's formatValue and appends a line. */
  print(...values: Value[]): Value {
    this.rt.output.push(values.map((v) => formatValue(this.rt, v)).join(' '));
    return NULL_VALUE;
  }

  finish(): void {
    if (this.rt.stack.length > 0) throw new ModelError('execution finished with calls in progress');
    this.rt.current = null;
    this.rt.complete = true;
  }

  private globalId(): string {
    const global = this.rt.envs.find((e) => e.kind === 'global');
    if (!global) throw new ModelError('no global environment');
    return global.id;
  }
}

/* ------------------------------------------------------------------ queries */

/** Function values whose closure is this environment. */
export function capturedBy(rt: Runtime, envId: string): FunctionValue[] {
  return rt.functions.filter((f) => f.closure === envId);
}

export type EnvStatus = 'running' | 'waiting' | 'captured' | 'released' | 'idle';

export function envStatus(rt: Runtime, env: Env): EnvStatus {
  if (env.released) return 'released';
  if (rt.current === env.id) return 'running';
  if (rt.stack.some((f) => f.env === env.id)) return 'waiting';
  if (env.kind === 'call') return 'captured';
  // Global is suspended (not running) while a call is in progress
  if (env.kind === 'global' && rt.stack.length > 0) return 'waiting';
  return 'idle';
}

export function cellOf(rt: Runtime, envId: string, name: string): Cell | undefined {
  return rt.envs.find((e) => e.id === envId)?.cells.find((c) => c.name === name);
}

export function formatValue(rt: Runtime, value: Value): string {
  switch (value.tag) {
    case 'number':
      return String(value.value);
    case 'null':
      return 'null';
    case 'builtin':
      return `<builtin ${value.name}>`;
    case 'user-function':
      return `<fn ${rt.functions.find((f) => f.id === value.fnId)?.name ?? '?'}>`;
  }
}

export function cloneRuntime(rt: Runtime): Runtime {
  return structuredClone(rt);
}
