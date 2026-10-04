import { cloneRuntime, emptyRuntime, RuntimeDraft } from './runtime';
import type { AstNode, Scenario, Span, StepView, Token } from './types';

/* ------------------------------------------------------------------ source helpers */

/** 1-based line and column of an offset, computed like SourceUnit.position (LF/CRLF line starts). */
export function positionOf(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (text[i] === '\r') {
      if (text[i + 1] === '\n') i++;
      line++;
      lineStart = i + 1;
    } else if (text[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * Lay a written-out token list over the source text: each lexeme is located after the previous
 * one, skipping whitespace only. Throws if the list does not cover the text exactly, so a typo in
 * the scenario data cannot silently produce wrong spans. The final `EOF` token sits at text.length.
 */
export function placeTokens(text: string, list: ReadonlyArray<readonly [kind: string, lexeme: string, literal?: number]>): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  const skip = (): void => {
    while (at < text.length && ' \t\r\n'.includes(text[at] ?? '')) at++;
  };
  for (const [kind, lexeme, literal] of list) {
    skip();
    if (kind === 'EOF') {
      if (at !== text.length) throw new Error(`EOF placed at ${at}, text has ${text.length} characters`);
    } else if (text.slice(at, at + lexeme.length) !== lexeme) {
      throw new Error(`expected '${lexeme}' at offset ${at}, found '${text.slice(at, at + lexeme.length)}'`);
    }
    const span = { start: at, end: at + lexeme.length };
    tokens.push({ index: tokens.length, kind, lexeme, span, ...positionOf(text, at), ...(literal === undefined ? {} : { literal }) });
    at = span.end;
  }
  return tokens;
}

/** Span from the start of token `from` to the end of token `to`. */
export function tokenSpan(tokens: readonly Token[], from: number, to = from): Span {
  const a = tokens[from];
  const b = tokens[to];
  if (!a || !b) throw new Error(`token range ${from}..${to} out of bounds`);
  return { start: a.span.start, end: b.span.end };
}

export function findNode(root: AstNode, id: string): AstNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Ids from the root down to `id` (inclusive), or [] if absent. */
export function pathTo(root: AstNode, id: string): string[] {
  if (root.id === id) return [root.id];
  for (const child of root.children) {
    const sub = pathTo(child, id);
    if (sub.length) return [root.id, ...sub];
  }
  return [];
}

/* ------------------------------------------------------------------ states */

/**
 * Fold every step's runtime effects into one immutable snapshot per step.
 * Environments released by the previous step are dropped before the next step runs.
 */
export function buildStates(scenario: Scenario): StepView[] {
  const views: StepView[] = [];
  let runtime = emptyRuntime();
  const lexEnd = lastIndexOfPhase(scenario, 'lex');
  const parseEnd = lastIndexOfPhase(scenario, 'parse');
  scenario.steps.forEach((def, index) => {
    const next = cloneRuntime(runtime);
    next.envs = next.envs.filter((e) => !e.released);
    next.fx = [];
    next.lookups = [];
    next.completion = null;
    next.evalNote = null;
    def.run?.(new RuntimeDraft(next, index));
    runtime = next;
    views.push({
      def,
      index,
      tokensShown: def.tokensShown ?? (index > lexEnd ? scenario.tokens.length : 0),
      statementsShown: def.statementsShown ?? (index > parseEnd ? scenario.ast.children.length : 0),
      runtime,
    });
  });
  return views;
}

function lastIndexOfPhase(scenario: Scenario, phase: string): number {
  let last = -1;
  scenario.steps.forEach((s, i) => {
    if (s.phase === phase) last = i;
  });
  return last;
}

/** Index of the first step of each phase, in timeline order. */
export function phaseStarts(scenario: Scenario): Map<string, number> {
  const starts = new Map<string, number>();
  scenario.steps.forEach((s, i) => {
    if (!starts.has(s.phase)) starts.set(s.phase, i);
  });
  return starts;
}
