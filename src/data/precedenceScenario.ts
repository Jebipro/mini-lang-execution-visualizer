import { num } from '../model/runtime';
import { placeTokens, tokenSpan as ts } from '../model/scenario';
import type { Scenario, StepDef } from '../model/types';
import { node, REF } from './build';

export const PRECEDENCE_SOURCE = `let x = 1 + 2 * 3;
print(x);
`;

const T = placeTokens(PRECEDENCE_SOURCE, [
  ['let', 'let'], ['identifier', 'x'], ['=', '='], ['number', '1', 1], ['+', '+'], ['number', '2', 2], ['*', '*'], ['number', '3', 3], [';', ';'],
  ['identifier', 'print'], ['(', '('], ['identifier', 'x'], [')', ')'], [';', ';'],
  ['EOF', ''],
]);

const AST = node('program', 'Program', '', ts(T, 0, 14), [
  node('let-x', 'Let', 'x', ts(T, 0, 8), [
    node('binary-plus', 'Binary', '+', ts(T, 3, 7), [
      node('lit-1', 'Literal', '1', ts(T, 3), [], 'left'),
      node('binary-times', 'Binary', '*', ts(T, 5, 7), [
        node('lit-2', 'Literal', '2', ts(T, 5), [], 'left'),
        node('lit-3', 'Literal', '3', ts(T, 7), [], 'right'),
      ], 'right'),
    ], 'initializer'),
  ]),
  node('expr-print', 'Expression', '', ts(T, 9, 13), [
    node('call-print', 'Call', '', ts(T, 9, 12), [
      node('id-print', 'Identifier', 'print', ts(T, 9), [], 'callee'),
      node('id-x', 'Identifier', 'x', ts(T, 11), [], 'arg'),
    ], 'expression'),
  ]),
]);

const steps: StepDef[] = [
  {
    id: 'source',
    phase: 'source',
    title: '소스 텍스트',
    view: 'tokens',
    explain: {
      headline: '식 하나에 연산자가 두 개입니다. 어느 쪽이 먼저 계산되는지 살펴봅니다.',
      changed: ['프로그램 텍스트를 SourceUnit으로 감쌉니다. 아직 token화는 일어나지 않았습니다.'],
      why: '텍스트에는 구조가 없습니다. 2 * 3이 한 덩어리라는 것은 parser가 정해야 합니다.',
      lookAt: '1행: 1 + 2 * 3.',
      real: [REF.runScript, REF.sourceUnit],
    },
  },
  {
    id: 'lex',
    phase: 'lex',
    title: 'Lex',
    view: 'tokens',
    focus: ts(T, 0, 8),
    tokensShown: T.length,
    activeTokens: [3, 7],
    explain: {
      headline: `token ${T.length}개. 연산자는 기호 token일 뿐이고, 아직 우선순위는 없습니다.`,
      changed: ['+와 *는 기호 자체가 kind인 token이 됩니다.', '1, 2, 3은 값을 literal로 담은 number token입니다.', 'EOF가 token 목록을 끝냅니다.'],
      why: 'lexer는 텍스트를 나누기만 합니다. 우선순위는 문법 규칙이므로 parser의 몫입니다.',
      lookAt: '1행의 token 목록.',
      real: [REF.lex, REF.tokenKinds],
    },
  },
  {
    id: 'parse-term',
    phase: 'parse',
    title: 'Parse: term()과 factor()',
    view: 'ast',
    focus: ts(T, 5, 7),
    statementsShown: 1,
    astFocus: 'binary-times',
    explain: {
      headline: 'term()은 +를 처리하고, 피연산자마다 factor()를 호출합니다. factor()는 2 * 3을 통째로 가져갑니다.',
      changed: [
        'term()이 factor()를 호출해 1을 얻고, 이어서 +를 봅니다.',
        '오른쪽 피연산자를 위해 term()이 factor()를 다시 호출합니다. factor()는 2를 읽고, *를 보고, 3을 읽어 Binary(*)를 만듭니다.',
        '그다음 term()이 left 1, right Binary(*)로 Binary(+)를 만듭니다.',
      ],
      why: '우선순위 단계마다 함수가 하나씩 있고, 우선순위가 높을수록 더 깊이 호출됩니다. 깊은 호출이 자기 연산자를 먼저 끝내므로 *가 tree의 더 아래쪽에 놓입니다.',
      lookAt: 'Binary(*)가 Binary(+)의 오른쪽 자식입니다.',
      real: [REF.binaryChain],
    },
  },
  {
    id: 'parse-program',
    phase: 'parse',
    title: 'Parse: Program',
    view: 'ast',
    focus: ts(T, 3, 7),
    statementsShown: 2,
    astFocus: 'binary-plus',
    explain: {
      headline: 'tree 모양이 우선순위를 나타냅니다: +가 root이고 2 * 3이 그 오른쪽 자식입니다.',
      changed: ['Let x node가 Binary(+) tree를 initializer로 가집니다.', 'print(x)는 Expression → Call이 됩니다.'],
      why: '괄호는 저장되지 않습니다. tree를 아래에서 위로 평가하면 저절로 올바른 순서가 됩니다. (1 + 2) * 3이라고 쓰면 Group node가 추가됩니다.',
      lookAt: 'Binary + → left: Literal 1, right: Binary * (2, 3).',
      real: [REF.program, REF.astTypes],
    },
  },
  {
    id: 'prepare',
    phase: 'prepare',
    title: 'Session + prepare()',
    view: 'ast',
    astFocus: 'let-x',
    run: (d) => {
      d.createEnv('builtins', 'builtins', 'Builtins', null);
      for (const name of ['print', 'len']) {
        d.reserve('builtins', name, false);
        d.initialize('builtins', name, { tag: 'builtin', name });
      }
      d.createEnv('global', 'global', 'Global', 'builtins');
      d.setCurrent('global');
      d.reserve('global', 'x');
    },
    explain: {
      headline: 'Builtins와 Global이 만들어지고, x가 TDZ 상태로 예약됩니다.',
      changed: ['createSession()이 Builtins(print, len) ← Global을 만듭니다.', 'prepare()가 Global에 x를 예약합니다. cell은 uninitialized입니다.'],
      why: '이름은 문장이 실행되기 전에 예약되고, 값은 let 문장이 실행될 때 들어옵니다.',
      lookAt: 'Global: x → <uninitialized>.',
      real: [REF.createSession, REF.prepare],
    },
  },
  {
    id: 'eval-times',
    phase: 'evaluate',
    title: '2 * 3 평가',
    view: 'ast',
    focus: ts(T, 5, 7),
    astFocus: 'binary-times',
    run: (d) => d.note('1 + (2 * 3)  →  left 1 · right 2 * 3 → 6'),
    explain: {
      headline: 'Binary(+)는 왼쪽 피연산자를 평가한 다음, 오른쪽인 2 * 3 subtree 전체를 평가합니다.',
      changed: ['왼쪽: Literal 1 → 1.', '오른쪽: Binary(*)가 2와 3을 평가한 뒤 binary("*", 2, 3) → 6.'],
      why: 'evaluator는 tree를 재귀적으로 따라갈 뿐입니다. 우선순위는 parser가 이미 정해 두었습니다.',
      lookAt: 'Runtime 패널의 평가 줄.',
      real: [REF.binaryOp],
    },
  },
  {
    id: 'eval-plus',
    phase: 'evaluate',
    title: 'x = 7',
    view: 'ast',
    focus: ts(T, 3, 7),
    astFocus: 'binary-plus',
    run: (d) => {
      d.note('1 + 6  →  7');
      d.initialize('global', 'x', num(7));
    },
    explain: {
      headline: '1 + 6 = 7이 되고, let 문장이 x를 초기화합니다.',
      changed: ['binary("+", 1, 6) → 7.', 'Global.x의 cell이 uninitialized에서 7로 바뀝니다.'],
      why: '왼쪽에서 오른쪽으로, 깊은 곳부터: 모든 Binary node에 같은 규칙이 적용됩니다.',
      lookAt: 'Global: x → 7.',
      real: [REF.binaryOp, REF.statementExec],
    },
  },
  {
    id: 'print',
    phase: 'output',
    title: 'print(x)',
    view: 'ast',
    focus: ts(T, 9, 12),
    astFocus: 'call-print',
    run: (d) => {
      d.lookup('print', 'global');
      d.print(d.lookup('x', 'global'));
    },
    explain: {
      headline: 'print는 Builtins에서 찾고, 7을 출력합니다.',
      changed: ['print: Global에는 없고(miss) Builtins에서 찾습니다(hit).', 'x → 7, "7"로 출력됩니다.'],
      why: 'Builtins는 Global 한 단계 위의 environment입니다.',
      lookAt: 'Output 패널: 7.',
      real: [REF.builtins, REF.formatValue],
    },
  },
  {
    id: 'done',
    phase: 'output',
    title: '실행 완료',
    view: 'ast',
    astFocus: 'program',
    run: (d) => d.finish(),
    explain: {
      headline: '실행이 끝났습니다. 1 + 2 * 3은 9가 아니라 7을 출력했습니다.',
      changed: ['프로그램이 normal completion으로 끝났습니다.'],
      why: '답은 파싱 시점에 tree의 모양으로 이미 정해졌습니다.',
      lookAt: 'runtime의 전체 흐름은 Closure 예제에서 볼 수 있습니다.',
      real: [REF.execute],
    },
  },
];

export const precedenceScenario: Scenario = {
  id: 'precedence',
  title: 'Precedence',
  blurb: '1 + 2 * 3이 + 아래에 *가 놓인 tree가 됩니다',
  source: PRECEDENCE_SOURCE,
  tokens: T,
  ast: AST,
  phases: [
    { id: 'source', label: 'Source' },
    { id: 'lex', label: 'Lex' },
    { id: 'parse', label: 'Parse' },
    { id: 'prepare', label: 'Prepare' },
    { id: 'evaluate', label: 'Evaluate' },
    { id: 'output', label: 'Output' },
  ],
  steps,
  expectedOutput: '7\n',
};
