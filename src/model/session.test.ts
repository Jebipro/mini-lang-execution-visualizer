import { describe, expect, it } from 'vitest';
import { findNode } from './scenario';
import { cellOf, envStatus, emptyRuntime, ModelError, num, RuntimeDraft } from './runtime';
import { createSession, currentView, hashOf, SCENARIOS, lastStep, loaded, reduce, sessionFromHash, type Session } from './session';
import type { Runtime, StepView } from './types';

const closure = loaded('closure');

function stepById(id: string): StepView {
  const view = closure.states.find((s) => s.def.id === id);
  if (!view) throw new Error(`no step ${id}`);
  return view;
}

function value(rt: Runtime, env: string, name: string): unknown {
  const cell = cellOf(rt, env, name);
  if (!cell) return 'missing';
  return cell.state.kind === 'uninitialized' ? 'uninitialized' : cell.state.value;
}

function walk(s: Session, n: number): Session {
  let out = s;
  for (let i = 0; i < n; i++) out = reduce(out, { type: 'next' });
  return out;
}

describe('closure scenario', () => {
  it('starts on the source step with no tokens, AST or runtime', () => {
    const view = currentView(createSession());
    expect(view.def.phase).toBe('source');
    expect(view.tokensShown).toBe(0);
    expect(view.statementsShown).toBe(0);
    expect(view.runtime.envs).toEqual([]);
    expect(view.runtime.output).toEqual([]);
  });

  it('runs the phases in pipeline order: lex before parse before runtime', () => {
    const order = closure.scenario.phases.map((p) => p.id);
    const phaseIndexes = closure.states.map((s) => order.indexOf(s.def.phase));
    expect(phaseIndexes.every((p) => p >= 0)).toBe(true);
    expect(phaseIndexes).toEqual([...phaseIndexes].sort((a, b) => a - b));
    const firstEnv = closure.states.findIndex((s) => s.runtime.envs.length > 0);
    const lastParse = closure.states.map((s) => s.def.phase).lastIndexOf('parse');
    expect(firstEnv).toBeGreaterThan(lastParse);
    // tokens appear before the AST, and every token exists once parsing starts
    const firstAst = closure.states.findIndex((s) => s.statementsShown > 0);
    expect(closure.states[firstAst]?.tokensShown).toBe(closure.scenario.tokens.length);
  });

  it('hoists the function but leaves let bindings in the TDZ after prepare()', () => {
    const rt = stepById('prepare-functions').runtime;
    expect(value(rt, 'global', 'makeAdder')).toEqual({ tag: 'user-function', fnId: 'fn-makeAdder' });
    expect(value(rt, 'global', 'add2')).toBe('uninitialized');
    expect(value(rt, 'global', 'result')).toBe('uninitialized');
    expect(rt.envs.find((e) => e.id === 'global')?.parent).toBe('builtins');
  });

  it('creates fn add with the makeAdder call environment as its closure', () => {
    const rt = stepById('capture').runtime;
    const add = rt.functions.find((f) => f.id === 'fn-add');
    expect(add?.closure).toBe('frame-makeAdder');
    expect(value(rt, 'frame-makeAdder', 'n')).toEqual(num(2));
    expect(rt.envs.find((e) => e.id === 'frame-makeAdder')?.parent).toBe('global');
    expect(rt.current).toBe('frame-makeAdder');
  });

  it('keeps the captured environment alive after makeAdder returns', () => {
    for (const id of ['return-boundary', 'return-bind', 'closure-return', 'done']) {
      const rt = stepById(id).runtime;
      const env = rt.envs.find((e) => e.id === 'frame-makeAdder');
      expect(env, id).toBeDefined();
      if (env) expect(envStatus(rt, env), id).toBe('captured');
    }
    const bound = stepById('return-bind').runtime;
    expect(bound.stack).toEqual([]);
    expect(value(bound, 'global', 'add2')).toEqual({ tag: 'user-function', fnId: 'fn-add' });
  });

  it('gives the closure call a frame whose parent is the captured environment, not Global', () => {
    const rt = stepById('closure-frame').runtime;
    expect(rt.envs.find((e) => e.id === 'frame-add')?.parent).toBe('frame-makeAdder');
    expect(value(rt, 'frame-add', 'v')).toEqual(num(10));
    expect(rt.stack.map((f) => f.env)).toEqual(['frame-add']);
  });

  it('finds n by walking from the current frame to its parent', () => {
    expect(stepById('lookup-n').runtime.lookups).toEqual([{ name: 'n', path: ['frame-add', 'frame-makeAdder'] }]);
    expect(stepById('lookup-v').runtime.lookups).toEqual([{ name: 'v', path: ['frame-add'] }]);
  });

  it('returns 12 through a return completion and releases the uncaptured frame', () => {
    const returned = stepById('closure-return').runtime;
    expect(returned.completion).toMatchObject({ kind: 'return', value: num(12) });
    expect(value(returned, 'global', 'result')).toEqual(num(12));
    expect(returned.envs.find((e) => e.id === 'frame-add')?.released).toBe(true);
    // released frames disappear on the next step; the captured one stays
    const next = stepById('print').runtime;
    expect(next.envs.map((e) => e.id)).toEqual(['builtins', 'global', 'frame-makeAdder']);
  });

  it('prints 12 found through Builtins and finishes with no calls in progress', () => {
    const print = stepById('print').runtime;
    expect(print.lookups[0]).toEqual({ name: 'print', path: ['global', 'builtins'] });
    const done = closure.states.at(-1)?.runtime;
    expect(done?.output).toEqual(['12']);
    expect(done?.complete).toBe(true);
    expect(done?.stack).toEqual([]);
    expect(closure.scenario.expectedOutput).toBe(`${done?.output.join('\n')}\n`);
  });
});

describe('precedence scenario', () => {
  it('evaluates 1 + 2 * 3 to 7', () => {
    const { states, scenario } = loaded('precedence');
    const done = states.at(-1)?.runtime;
    expect(done?.output).toEqual(['7']);
    expect(scenario.ast.children[0]?.children[0]?.children.map((c) => c.kind)).toEqual(['Literal', 'Binary']);
  });
});

describe('every scenario', () => {
  it('highlights the same source span as the focused AST node', () => {
    for (const { scenario } of SCENARIOS) {
      for (const step of scenario.steps) {
        if (!step.focus || !step.astFocus) continue;
        const node = findNode(scenario.ast, step.astFocus);
        expect(node, `${scenario.id}/${step.id}`).toBeDefined();
        expect(step.focus, `${scenario.id}/${step.id}`).toEqual(node?.span);
      }
    }
  });
});

describe('session reducer', () => {
  it('moves forward and back within bounds', () => {
    let s = createSession();
    s = reduce(s, { type: 'prev' });
    expect(s.step).toBe(0);
    s = walk(s, 3);
    expect(currentView(s).def.phase).toBe('lex');
    s = reduce(s, { type: 'prev' });
    expect(s.step).toBe(2);
    s = reduce(s, { type: 'goto', step: 999 });
    expect(s.step).toBe(lastStep(s));
    s = reduce(s, { type: 'next' });
    expect(s.step).toBe(lastStep(s));
  });

  it('reset returns to the initial state of the same scenario', () => {
    let s = reduce(createSession('precedence'), { type: 'goto', step: 5 });
    s = reduce(reduce(s, { type: 'play' }), { type: 'reset' });
    expect(s).toEqual(createSession('precedence'));
  });

  it('plays tick by tick and stops on the last step', () => {
    let s = reduce(createSession('precedence'), { type: 'play' });
    expect(s.playing).toBe(true);
    for (let i = 0; i < 50; i++) s = reduce(s, { type: 'tick' });
    expect(s.step).toBe(lastStep(s));
    expect(s.playing).toBe(false);
    // play at the end restarts from the beginning
    expect(reduce(s, { type: 'play' }).step).toBe(0);
    // tick is ignored while paused
    expect(reduce(createSession(), { type: 'tick' }).step).toBe(0);
  });

  it('switching scenario starts it from the beginning', () => {
    const s = reduce(walk(createSession(), 5), { type: 'setScenario', id: 'precedence' });
    expect(s).toEqual({ scenarioId: 'precedence', step: 0, playing: false });
  });

  it('round-trips deep links and ignores invalid ones', () => {
    const s = reduce(createSession('precedence'), { type: 'goto', step: 4 });
    expect(hashOf(s)).toBe('#precedence/5');
    expect(sessionFromHash(hashOf(s))).toEqual(s);
    expect(sessionFromHash('#nope/x')).toEqual(createSession());
    expect(sessionFromHash('#closure/999').step).toBe(lastStep(createSession()));
    expect(sessionFromHash('')).toEqual(createSession());
  });

  it('is deterministic: the same step always yields the same runtime', () => {
    const a = currentView(walk(createSession(), 19));
    const b = currentView(reduce(walk(createSession(), 23), { type: 'goto', step: 19 }));
    expect(a).toBe(b);
  });
});

describe('runtime model rules', () => {
  function draft(): RuntimeDraft {
    const d = new RuntimeDraft(emptyRuntime(), 0);
    d.createEnv('g', 'global', 'Global', null);
    return d;
  }

  it('rejects reading a reserved but uninitialized binding (TDZ)', () => {
    const d = draft();
    d.reserve('g', 'x');
    expect(() => d.lookup('x', 'g')).toThrow(/E_TDZ/);
  });

  it('rejects redeclaration and double initialization', () => {
    const d = draft();
    d.reserve('g', 'x');
    expect(() => d.reserve('g', 'x')).toThrow(ModelError);
    d.initialize('g', 'x', num(1));
    expect(() => d.initialize('g', 'x', num(2))).toThrow(ModelError);
  });

  it('reports undefined names after walking the whole chain', () => {
    const d = draft();
    d.createEnv('c', 'call', 'Call', 'g');
    expect(() => d.lookup('missing', 'c')).toThrow(/E_UNDEFINED/);
  });

  it('shadowing: the innermost cell wins', () => {
    const d = draft();
    d.reserve('g', 'x');
    d.initialize('g', 'x', num(1));
    d.createEnv('c', 'call', 'Call', 'g');
    d.reserve('c', 'x');
    d.initialize('c', 'x', num(2));
    expect(d.lookup('x', 'c')).toEqual(num(2));
    expect(d.lookup('x', 'g')).toEqual(num(1));
  });
});
