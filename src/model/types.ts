/**
 * Data shapes shared by the scenario model and the UI.
 *
 * Offsets follow Mini-Lang's SourceUnit: UTF-16 code-unit offsets, `end` exclusive,
 * lines and columns 1-based.
 */

export interface Span {
  readonly start: number;
  readonly end: number;
}

/** Same fields as Mini-Lang's `Token` (src/token.ts), with the span flattened to offsets + start line:column. */
export interface Token {
  readonly index: number;
  readonly kind: string;
  readonly lexeme: string;
  readonly span: Span;
  readonly line: number;
  readonly column: number;
  readonly literal?: number | string;
}

/**
 * A readable AST node. `kind` is the real Mini-Lang node kind (src/ast.ts);
 * `Name` is used for the `{ text, span }` records that hold declared names and parameters.
 */
export interface AstNode {
  readonly id: string;
  readonly kind: string;
  /** The node's distinguishing payload: a name, an operator or a literal (empty when none). */
  readonly text: string;
  readonly span: Span;
  /** Field of the parent that holds this node, e.g. `callee`, `left`, `initializer`. */
  readonly role?: string;
  readonly children: readonly AstNode[];
}

/* ------------------------------------------------------------------ runtime */

export type Value =
  | { readonly tag: 'number'; readonly value: number }
  | { readonly tag: 'null' }
  | { readonly tag: 'user-function'; readonly fnId: string }
  | { readonly tag: 'builtin'; readonly name: string };

export type CellState = { readonly kind: 'uninitialized' } | { readonly kind: 'initialized'; readonly value: Value };

/** Mirrors Mini-Lang's BindingCell: a name owns a cell, the cell owns the state. */
export interface Cell {
  readonly name: string;
  readonly mutable: boolean;
  state: CellState;
}

export type EnvKind = 'builtins' | 'global' | 'call';

export interface Env {
  readonly id: string;
  /** Visualizer label only — Mini-Lang environments have no ids. */
  readonly number: number;
  readonly kind: EnvKind;
  readonly label: string;
  readonly parent: string | null;
  readonly cells: Cell[];
  /** A finished call frame that nothing references any more; dropped from view on the next step. */
  released: boolean;
}

/** Mirrors Mini-Lang's UserFunction: code (declaration AST) + closure environment. */
export interface FunctionValue {
  readonly id: string;
  readonly name: string;
  /** AST node id of the `fn` declaration — the function's code. */
  readonly declaration: string;
  readonly params: readonly string[];
  readonly closure: string;
  /** Step index at which the function value was created (for the capture animation). */
  readonly createdAt: number;
}

export interface Frame {
  readonly label: string;
  readonly env: string;
}

export type CellEffect = 'reserve' | 'initialize' | 'read';

export interface CellFx {
  readonly env: string;
  readonly name: string;
  readonly effect: CellEffect;
}

export interface LookupTrail {
  readonly name: string;
  /** Environments visited, innermost first; the last one holds the cell. */
  readonly path: readonly string[];
}

export const COMPLETION_STAGES = ['Return statement', 'Statement list', 'Call boundary', 'Value at the caller'] as const;

export interface CompletionView {
  readonly kind: 'normal' | 'return';
  readonly value: Value | null;
  /** Index into COMPLETION_STAGES. */
  readonly stage: number;
}

export interface Runtime {
  envs: Env[];
  functions: FunctionValue[];
  /** Environment the interpreter is evaluating in, or null before/after execution. */
  current: string | null;
  /** User-function calls in progress (Mini-Lang's callDepth), outermost first. */
  stack: Frame[];
  output: string[];
  complete: boolean;
  // per-step annotations (cleared before every step)
  fx: CellFx[];
  lookups: LookupTrail[];
  completion: CompletionView | null;
  evalNote: string | null;
}

/* ------------------------------------------------------------------ scenario */

export interface Phase {
  readonly id: string;
  readonly label: string;
}

export interface RealRef {
  readonly file: string;
  readonly symbol: string;
  readonly note?: string;
}

export interface Explanation {
  readonly headline: string;
  readonly changed: readonly string[];
  readonly why: string;
  readonly lookAt: string;
  readonly real: readonly RealRef[];
}

export type SyntaxView = 'tokens' | 'ast';

export interface StepDef {
  readonly id: string;
  readonly phase: string;
  readonly title: string;
  readonly view: SyntaxView;
  /** Source span to highlight. */
  readonly focus?: Span;
  /** Number of tokens produced so far (defaults to all tokens once lexing is over). */
  readonly tokensShown?: number;
  /** Inclusive token index range the step is about. */
  readonly activeTokens?: readonly [number, number];
  /** Number of top-level statements the AST shows (defaults to all once parsing is over). */
  readonly statementsShown?: number;
  /** AST node the step is about. */
  readonly astFocus?: string;
  readonly explain: Explanation;
  /** Runtime effects of the step, applied to a copy of the previous runtime. */
  readonly run?: (rt: import('./runtime').RuntimeDraft) => void;
}

export interface StepView {
  readonly def: StepDef;
  readonly index: number;
  readonly tokensShown: number;
  readonly statementsShown: number;
  readonly runtime: Runtime;
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly blurb: string;
  readonly source: string;
  readonly tokens: readonly Token[];
  readonly ast: AstNode;
  readonly phases: readonly Phase[];
  readonly steps: readonly StepDef[];
  /** Expected program output (checked against the real interpreter by the conformance test). */
  readonly expectedOutput: string;
}
