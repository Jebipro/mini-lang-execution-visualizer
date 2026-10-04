/**
 * Conformance with the real Mini-Lang implementation.
 *
 * The scenario data (tokens, AST, expected output) is written by hand so the visualizer stays a
 * standalone static app. This test imports the original lexer, parser and runner — read-only —
 * and checks that the hand-written data matches what Mini-Lang actually produces.
 *
 * It looks for the Mini-Lang repository in MINI_LANG_DIR; otherwise in the sibling folder `../mini-lang`
 * (the published repository name), then in the original development folder name. When none exists,
 * the suite is skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../model/session';
import type { AstNode } from '../model/types';

const SIBLINGS = ['mini-lang', '인터프리터 언어 구현'].map((name) => path.resolve(__dirname, '../../..', name));
const coreDir =
  process.env.MINI_LANG_DIR ?? SIBLINGS.find((dir) => fs.existsSync(path.join(dir, 'src', 'interpreter.ts'))) ?? SIBLINGS[0]!;
const hasCore = fs.existsSync(path.join(coreDir, 'src', 'interpreter.ts'));

async function load<T>(file: string): Promise<T> {
  return (await import(/* @vite-ignore */ pathToFileURL(path.join(coreDir, 'src', file)).href)) as T;
}

interface RealSpan {
  start: { offset: number; line: number; column: number };
  end: { offset: number };
}
interface RealToken {
  kind: string;
  lexeme: string;
  span: RealSpan;
  literal?: number | string;
}
type RealNode = Record<string, unknown> & { kind?: string; span: RealSpan };

interface Shape {
  kind: string;
  text: string;
  start: number;
  end: number;
  children: Shape[];
}

/** Reduce a real AST node to kind + payload + span + children (Names included as `Name`). */
function realShape(n: RealNode): Shape {
  const kind = n.kind ?? 'Name';
  const name = (k: string): RealNode => n[k] as RealNode;
  const many = (k: string): RealNode[] => n[k] as RealNode[];
  let text = '';
  let children: RealNode[] = [];
  switch (kind) {
    case 'Name':
      text = String(n.text);
      break;
    case 'Program':
    case 'Block':
      children = many('statements');
      break;
    case 'Function':
      text = String(name('name').text);
      children = [...many('params'), name('body')];
      break;
    case 'Let':
      text = String(name('name').text);
      children = [name('initializer')];
      break;
    case 'Return':
      children = n.value ? [name('value')] : [];
      break;
    case 'Expression':
      children = [name('expression')];
      break;
    case 'Binary':
    case 'Logical':
      text = String(n.operator);
      children = [name('left'), name('right')];
      break;
    case 'Call':
      children = [name('callee'), ...many('args')];
      break;
    case 'Identifier':
      text = String(n.name);
      break;
    case 'Literal':
      text = String(n.value);
      break;
    default:
      throw new Error(`conformance test does not cover AST kind ${kind}`);
  }
  return { kind, text, start: n.span.start.offset, end: n.span.end.offset, children: children.map(realShape) };
}

function modelShape(n: AstNode): Shape {
  return { kind: n.kind, text: n.text, start: n.span.start, end: n.span.end, children: n.children.map(modelShape) };
}

describe.skipIf(!hasCore)('conformance with the Mini-Lang repository', () => {
  for (const { scenario } of SCENARIOS) {
    describe(scenario.title, () => {
      it('tokens match lex()', async () => {
        const { SourceUnit } = await load<{ SourceUnit: new (text: string, name: string) => unknown }>('source-location.ts');
        const { lex } = await load<{ lex: (s: unknown) => RealToken[] }>('lexer.ts');
        const real = lex(new SourceUnit(scenario.source, scenario.id)).map((t) => ({
          kind: t.kind,
          lexeme: t.lexeme,
          start: t.span.start.offset,
          end: t.span.end.offset,
          line: t.span.start.line,
          column: t.span.start.column,
          literal: t.literal,
        }));
        const ours = scenario.tokens.map((t) => ({
          kind: t.kind,
          lexeme: t.lexeme,
          start: t.span.start,
          end: t.span.end,
          line: t.line,
          column: t.column,
          literal: t.literal,
        }));
        expect(ours).toEqual(real);
      });

      it('AST matches parse()', async () => {
        const { SourceUnit } = await load<{ SourceUnit: new (text: string, name: string) => unknown }>('source-location.ts');
        const { parse } = await load<{ parse: (s: unknown) => RealNode }>('parser.ts');
        expect(modelShape(scenario.ast)).toEqual(realShape(parse(new SourceUnit(scenario.source, scenario.id))));
      });

      it('output matches the real interpreter', async () => {
        const { runScript } = await load<{ runScript: (text: string, name: string, out: (t: string) => void) => void }>('runner.ts');
        let out = '';
        runScript(scenario.source, scenario.id, (t) => (out += t));
        expect(out).toBe(scenario.expectedOutput);
      });
    });
  }
});
