import type { AstNode, Span } from '../model/types';

/** Compact AST constructor for scenario data. */
export function node(id: string, kind: string, text: string, span: Span, children: AstNode[] = [], role?: string): AstNode {
  return role === undefined ? { id, kind, text, span, children } : { id, kind, text, span, children, role };
}

/** The same node with a parent-field role attached. */
export function as(role: string, n: AstNode): AstNode {
  return { ...n, role };
}

/** Real Mini-Lang source references used by the explanation panel. */
export const REF = {
  sourceUnit: { file: 'src/source-location.ts', symbol: 'SourceUnit' },
  runScript: { file: 'src/runner.ts', symbol: 'runScript / compile / execute' },
  lex: { file: 'src/lexer.ts', symbol: 'lex()' },
  tokenKinds: { file: 'src/token.ts', symbol: 'keywords / symbols / Token' },
  declaration: { file: 'src/parser.ts', symbol: 'Parser.declaration()' },
  block: { file: 'src/parser.ts', symbol: 'Parser.block()' },
  statement: { file: 'src/parser.ts', symbol: 'Parser.statement()' },
  binaryChain: { file: 'src/parser.ts', symbol: 'Parser.assignment() → or() → … → term() → factor()' },
  postfix: { file: 'src/parser.ts', symbol: 'Parser.postfix() / primary()' },
  program: { file: 'src/parser.ts', symbol: 'Parser.program() / registerName()' },
  astTypes: { file: 'src/ast.ts', symbol: 'Program / Stmt / Expr' },
  createSession: { file: 'src/runner.ts', symbol: 'createSession()' },
  builtins: { file: 'src/builtins.ts', symbol: 'createBuiltins()' },
  environment: { file: 'src/environment.ts', symbol: 'Environment / BindingCell' },
  reserve: { file: 'src/environment.ts', symbol: 'Environment.reserve() / initialize()' },
  lookup: { file: 'src/environment.ts', symbol: 'Environment.lookup() / reference() / get()' },
  prepare: { file: 'src/interpreter.ts', symbol: 'Interpreter.prepare()' },
  list: { file: 'src/interpreter.ts', symbol: 'Interpreter.list()' },
  statementExec: { file: 'src/interpreter.ts', symbol: 'Interpreter.statement()' },
  call: { file: 'src/interpreter.ts', symbol: "Interpreter.evaluate() — case 'Call'" },
  completion: { file: 'src/interpreter.ts', symbol: 'type Completion' },
  userFunction: { file: 'src/runtime-values.ts', symbol: 'UserFunction' },
  binaryOp: { file: 'src/runtime-values.ts', symbol: 'binary()' },
  formatValue: { file: 'src/value-format.ts', symbol: 'formatValue()' },
  execute: { file: 'src/interpreter.ts', symbol: 'Interpreter.execute()' },
} as const;
