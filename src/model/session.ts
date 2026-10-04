import { closureScenario } from '../data/closureScenario';
import { precedenceScenario } from '../data/precedenceScenario';
import { buildStates } from './scenario';
import type { Scenario, StepView } from './types';

export interface LoadedScenario {
  readonly scenario: Scenario;
  readonly states: readonly StepView[];
}

export const SCENARIOS: readonly LoadedScenario[] = [closureScenario, precedenceScenario].map((scenario) => ({
  scenario,
  states: buildStates(scenario),
}));

/** UI session (pure reducer). Step views are precomputed, so moving between steps is deterministic. */
export interface Session {
  readonly scenarioId: string;
  readonly step: number;
  readonly playing: boolean;
}

export type Action =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; step: number }
  | { type: 'reset' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'tick' }
  | { type: 'setScenario'; id: string };

export function createSession(scenarioId = 'closure'): Session {
  loaded(scenarioId);
  return { scenarioId, step: 0, playing: false };
}

export function loaded(scenarioId: string): LoadedScenario {
  const hit = SCENARIOS.find((s) => s.scenario.id === scenarioId);
  if (!hit) throw new Error(`unknown scenario ${scenarioId}`);
  return hit;
}

export function lastStep(s: Session): number {
  return loaded(s.scenarioId).states.length - 1;
}

export function currentView(s: Session): StepView {
  const view = loaded(s.scenarioId).states[s.step];
  if (!view) throw new Error(`step ${s.step} out of range`);
  return view;
}

/** Parse a `#<scenario>/<step>` deep link (step is 1-based). Invalid parts fall back to the defaults. */
export function sessionFromHash(hash: string): Session {
  const [id, stepText] = hash.replace(/^#/, '').split('/');
  const known = SCENARIOS.some((s) => s.scenario.id === id);
  const session = createSession(known && id ? id : 'closure');
  const step = Number(stepText);
  return Number.isInteger(step) ? reduce(session, { type: 'goto', step: step - 1 }) : session;
}

export function hashOf(s: Session): string {
  return `#${s.scenarioId}/${s.step + 1}`;
}

function clamp(s: Session, step: number): number {
  return Math.min(Math.max(0, step), lastStep(s));
}

export function reduce(s: Session, a: Action): Session {
  switch (a.type) {
    case 'next':
      return { ...s, playing: false, step: clamp(s, s.step + 1) };
    case 'prev':
      return { ...s, playing: false, step: clamp(s, s.step - 1) };
    case 'goto':
      return { ...s, playing: false, step: clamp(s, a.step) };
    case 'reset':
      return createSession(s.scenarioId);
    case 'play':
      // playing from the last step restarts the walkthrough
      return { ...s, playing: true, step: s.step >= lastStep(s) ? 0 : s.step };
    case 'pause':
      return { ...s, playing: false };
    case 'tick': {
      if (!s.playing) return s;
      const step = clamp(s, s.step + 1);
      return { ...s, step, playing: step < lastStep(s) };
    }
    case 'setScenario':
      return s.scenarioId === a.id ? s : createSession(a.id);
  }
}
