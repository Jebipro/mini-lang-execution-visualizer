import { num } from '../model/runtime';
import { placeTokens, tokenSpan as ts } from '../model/scenario';
import type { RuntimeDraft } from '../model/runtime';
import type { Scenario, StepDef, Value } from '../model/types';
import { as, node, REF } from './build';

export const CLOSURE_SOURCE = `fn makeAdder(n) {
  fn add(v) {
    return n + v;
  }
  return add;
}

let add2 = makeAdder(2);
let result = add2(10);
print(result);
`;

// Kinds are Mini-Lang's real TokenKind values: keywords and symbols use their own text as the kind.
const T = placeTokens(CLOSURE_SOURCE, [
  ['fn', 'fn'], ['identifier', 'makeAdder'], ['(', '('], ['identifier', 'n'], [')', ')'], ['{', '{'],
  ['fn', 'fn'], ['identifier', 'add'], ['(', '('], ['identifier', 'v'], [')', ')'], ['{', '{'],
  ['return', 'return'], ['identifier', 'n'], ['+', '+'], ['identifier', 'v'], [';', ';'],
  ['}', '}'],
  ['return', 'return'], ['identifier', 'add'], [';', ';'],
  ['}', '}'],
  ['let', 'let'], ['identifier', 'add2'], ['=', '='], ['identifier', 'makeAdder'], ['(', '('], ['number', '2', 2], [')', ')'], [';', ';'],
  ['let', 'let'], ['identifier', 'result'], ['=', '='], ['identifier', 'add2'], ['(', '('], ['number', '10', 10], [')', ')'], [';', ';'],
  ['identifier', 'print'], ['(', '('], ['identifier', 'result'], [')', ')'], [';', ';'],
  ['EOF', ''],
]);

const AST = node('program', 'Program', '', ts(T, 0, 43), [
  node('fn-makeAdder', 'Function', 'makeAdder', ts(T, 0, 21), [
    node('param-n', 'Name', 'n', ts(T, 3), [], 'param'),
    node('block-makeAdder', 'Block', '', ts(T, 5, 21), [
      node('fn-add', 'Function', 'add', ts(T, 6, 17), [
        node('param-v', 'Name', 'v', ts(T, 9), [], 'param'),
        node('block-add', 'Block', '', ts(T, 11, 17), [
          node('return-sum', 'Return', '', ts(T, 12, 16), [
            node('binary-sum', 'Binary', '+', ts(T, 13, 15), [
              node('id-n', 'Identifier', 'n', ts(T, 13), [], 'left'),
              node('id-v', 'Identifier', 'v', ts(T, 15), [], 'right'),
            ], 'value'),
          ]),
        ], 'body'),
      ]),
      node('return-add', 'Return', '', ts(T, 18, 20), [as('value', node('id-add', 'Identifier', 'add', ts(T, 19)))]),
    ], 'body'),
  ]),
  node('let-add2', 'Let', 'add2', ts(T, 22, 29), [
    node('call-makeAdder', 'Call', '', ts(T, 25, 28), [
      node('id-makeAdder', 'Identifier', 'makeAdder', ts(T, 25), [], 'callee'),
      node('lit-2', 'Literal', '2', ts(T, 27), [], 'arg'),
    ], 'initializer'),
  ]),
  node('let-result', 'Let', 'result', ts(T, 30, 37), [
    node('call-add2', 'Call', '', ts(T, 33, 36), [
      node('id-add2', 'Identifier', 'add2', ts(T, 33), [], 'callee'),
      node('lit-10', 'Literal', '10', ts(T, 35), [], 'arg'),
    ], 'initializer'),
  ]),
  node('expr-print', 'Expression', '', ts(T, 38, 42), [
    node('call-print', 'Call', '', ts(T, 38, 41), [
      node('id-print', 'Identifier', 'print', ts(T, 38), [], 'callee'),
      node('id-result', 'Identifier', 'result', ts(T, 40), [], 'arg'),
    ], 'expression'),
  ]),
]);

const B = 'builtins';
const G = 'global';
const E2 = 'frame-makeAdder';
const E3 = 'frame-add';
const ADD: Value = { tag: 'user-function', fnId: 'fn-add' };

/** Runner setup: Builtins (read-only print, len) ← Global. */
function createSession(d: RuntimeDraft): void {
  d.createEnv(B, 'builtins', 'Builtins', null);
  for (const name of ['print', 'len']) {
    d.reserve(B, name, false);
    d.initialize(B, name, { tag: 'builtin', name });
  }
  d.createEnv(G, 'global', 'Global', B);
}

const steps: StepDef[] = [
  {
    id: 'source',
    phase: 'source',
    title: '소스 텍스트',
    view: 'tokens',
    explain: {
      headline: '모든 것은 SourceUnit 안의 평범한 텍스트에서 시작합니다.',
      changed: [
        'runScript()가 프로그램 텍스트를 표시 이름과 함께 SourceUnit으로 감쌉니다.',
        'SourceUnit은 각 줄의 시작 위치를 기록해 두므로, 나중에 어떤 offset이든 line:column으로 바꿀 수 있습니다.',
        '아직 token화, 파싱, 실행 중 어느 것도 일어나지 않았습니다.',
      ],
      why: '모든 token, AST node, 오류는 이 텍스트 안의 offset 범위(span)를 갖습니다. 그래서 강조 표시와 오류 메시지가 정확한 소스 위치를 가리킬 수 있습니다.',
      lookAt: 'Source 패널의 Mini-Lang 코드 10줄. 함수는 fn으로 선언하며, 익명 함수 표현식은 없습니다.',
      real: [REF.runScript, REF.sourceUnit],
    },
  },
  {
    id: 'lex-fn',
    phase: 'lex',
    title: 'Lex: fn makeAdder(n) {',
    view: 'tokens',
    focus: ts(T, 0, 5),
    tokensShown: 6,
    activeTokens: [0, 5],
    explain: {
      headline: 'lexer는 문자를 왼쪽부터 읽으며 token을 만듭니다.',
      changed: [
        'fn은 keyword 표에 있으므로 kind가 fn입니다.',
        'makeAdder와 n은 keyword가 아닌 문자·숫자 조합이라 identifier token이 됩니다.',
        '(, ), {는 기호 token이고, 그 사이의 공백은 건너뜁니다.',
      ],
      why: 'parser는 문자를 다시 보지 않습니다. kind, 정확한 lexeme, span을 가진 token 목록만 봅니다.',
      lookAt: 'token 칩마다 kind, lexeme, line:column이 표시됩니다. token에 마우스를 올리면 소스에서 해당 범위가 강조됩니다.',
      real: [REF.lex, REF.tokenKinds],
    },
  },
  {
    id: 'lex-let',
    phase: 'lex',
    title: 'Lex: let add2 = makeAdder(2);',
    view: 'tokens',
    focus: ts(T, 22, 29),
    tokensShown: 30,
    activeTokens: [22, 29],
    explain: {
      headline: 'number token은 값을 함께 담습니다. lexer에게 makeAdder는 그냥 이름일 뿐입니다.',
      changed: [
        'lexer는 makeAdder 선언(1–6행)을 지나 8행을 읽고 있습니다.',
        '2는 literal 값으로 숫자 2를 담은 number token이 됩니다.',
        'lexer는 makeAdder가 함수인지, 이것이 호출인지 모릅니다. 그런 의미는 다음 단계에서 정해집니다.',
      ],
      why: 'lexing은 주변 문맥 없이 국소적으로 판단합니다. == 나 && 같은 두 글자 기호를 한 글자 기호보다 먼저 확인하고, 알 수 없는 문자는 소스 위치가 담긴 E_CHARACTER 오류가 됩니다.',
      lookAt: '8행에 새로 생긴 token: let, identifier add2, =, identifier makeAdder, (, number 2, ), ;.',
      real: [REF.lex],
    },
  },
  {
    id: 'lex-eof',
    phase: 'lex',
    title: 'Lex: EOF',
    view: 'tokens',
    focus: { start: T[43]?.span.start ?? 0, end: T[43]?.span.end ?? 0 },
    tokensShown: T.length,
    activeTokens: [43, 43],
    explain: {
      headline: `token은 모두 ${T.length}개이고, 마지막은 EOF token입니다.`,
      changed: [
        `lex()가 텍스트의 끝인 offset ${CLOSURE_SOURCE.length}(11행 1열)에 EOF를 붙였습니다.`,
        'token 목록이 완성됐습니다. AST는 아직 없습니다.',
      ],
      why: 'EOF는 parser에게 멈출 지점을 알려 줍니다. Parser constructor는 EOF로 끝나지 않는 token 목록을 거부합니다.',
      lookAt: '마지막 칩: lexeme이 비어 있는 EOF.',
      real: [REF.lex],
    },
  },
  {
    id: 'parse-fn',
    phase: 'parse',
    title: 'Parse: fn makeAdder',
    view: 'ast',
    focus: ts(T, 0, 21),
    statementsShown: 1,
    astFocus: 'fn-makeAdder',
    explain: {
      headline: 'fn makeAdder(n) { … }는 안에 또 다른 Function을 품은 Function node가 됩니다.',
      changed: [
        'declaration()이 fn을 보고 이름과 parameter 목록을 읽은 뒤, block()으로 본문을 파싱합니다.',
        '본문 안의 fn add도 같은 방식으로 파싱되므로, AST에는 Function 안의 Block 안에 다시 Function이 들어갑니다.',
        '모든 node는 span을 가집니다. Function의 span은 fn부터 닫는 }까지입니다.',
      ],
      why: 'AST는 텍스트가 아니라 구조(무엇이 무엇 안에 있는지)를 담습니다. interpreter는 token을 다시 읽지 않고 이 tree를 따라 실행합니다.',
      lookAt: 'tree에서 Function add는 makeAdder → body → Block 아래에 있습니다. node에 마우스를 올리면 소스에서 해당 범위가 강조됩니다.',
      real: [REF.declaration, REF.block, REF.astTypes],
    },
  },
  {
    id: 'parse-binary',
    phase: 'parse',
    title: 'Parse: n + v',
    view: 'ast',
    focus: ts(T, 13, 15),
    statementsShown: 1,
    astFocus: 'binary-sum',
    explain: {
      headline: 'return n + v;는 Return → Binary(+)가 되고, 자식으로 Identifier 두 개를 가집니다.',
      changed: [
        'statement()가 return을 보고 함수 안인지 확인합니다. 최상위였다면 E_RETURN_CONTEXT 오류입니다.',
        '값 식은 assignment → or → and → equality → comparison → term 순서로 내려가고, term()이 Binary(+)를 만듭니다.',
        'n과 v는 Identifier node입니다. parser는 이 이름이 어디에 있는지 정하지 않고 이름만 기록합니다.',
      ],
      why: '이름 해석(name resolution)은 실행 중에 environment를 따라가며 일어납니다. 그래서 n이 다른 함수에 속해 있어도 parser는 여기서 n을 받아들입니다.',
      lookAt: 'Binary +의 left: Identifier n, right: Identifier v.',
      real: [REF.statement, REF.binaryChain],
    },
  },
  {
    id: 'parse-call',
    phase: 'parse',
    title: 'Parse: makeAdder(2)',
    view: 'ast',
    focus: ts(T, 25, 28),
    statementsShown: 3,
    astFocus: 'call-makeAdder',
    explain: {
      headline: 'makeAdder(2)는 postfix Call입니다. callee가 먼저 오고 그 뒤에 인자가 옵니다.',
      changed: [
        'primary()가 Identifier makeAdder를 읽고, postfix()가 (를 보고 이를 인자 [Literal 2]를 가진 Call로 감쌉니다.',
        'let add2 = …는 그 Call을 initializer로 가진 Let node가 됩니다.',
        'let result = add2(10);도 같은 방식으로 파싱됩니다.',
      ],
      why: 'postfix()는 반복하므로 outer(1)(2)(3)처럼 호출 결과를 다시 호출할 수 있습니다. callee는 이름뿐 아니라 어떤 식이든 될 수 있습니다.',
      lookAt: 'Let add2 → initializer: Call → callee: Identifier makeAdder, arg: Literal 2.',
      real: [REF.postfix, REF.declaration],
    },
  },
  {
    id: 'parse-program',
    phase: 'parse',
    title: 'Parse: Program',
    view: 'ast',
    focus: ts(T, 0, 43),
    statementsShown: 4,
    astFocus: 'program',
    explain: {
      headline: '파일 전체가 문장 4개를 가진 하나의 Program node가 됩니다.',
      changed: [
        'program()이 EOF까지 파싱했습니다: Function, Let, Let, Expression.',
        '파싱하는 동안 registerName()이 같은 scope의 중복 이름(E_DUPLICATE)과 중복 parameter를 검사했습니다.',
        '파싱에 성공했으므로 실행을 시작할 수 있습니다. 문법 오류가 있었다면 어떤 부수 효과도 일어나기 전에 멈췄을 것입니다.',
      ],
      why: '파싱과 실행은 서로 다른 단계입니다. 아직 아무것도 출력되지 않았고, environment도 없습니다.',
      lookAt: 'Program → Function makeAdder, Let add2, Let result, Expression print(result).',
      real: [REF.program, REF.astTypes],
    },
  },
  {
    id: 'session',
    phase: 'prepare',
    title: 'Session 생성',
    view: 'ast',
    astFocus: 'program',
    run: createSession,
    explain: {
      headline: '실행 전에 runner가 Builtins와 비어 있는 Global, 두 environment를 만듭니다.',
      changed: [
        'createSession()이 print와 len을 Builtins environment에 읽기 전용 binding으로 넣습니다.',
        'Global은 Builtins를 parent로 삼아 만들어집니다.',
        '각 이름은 BindingCell을 가리킵니다. cell은 상태(uninitialized, 또는 값이 들어간 initialized)를 담습니다.',
      ],
      why: 'builtin을 한 단계 위에 두면, 프로그램이 Global에서 print를 가려도(shadowing) builtin 자체는 바뀌지 않습니다.',
      lookAt: 'Runtime: Env #0 Builtins가 Env #1 Global의 parent입니다. 읽기 전용 cell에는 const가 표시됩니다.',
      real: [REF.createSession, REF.builtins, REF.environment],
    },
  },
  {
    id: 'prepare-reserve',
    phase: 'prepare',
    title: 'prepare(): 이름 예약',
    view: 'ast',
    focus: ts(T, 0, 43),
    astFocus: 'program',
    run: (d) => {
      d.setCurrent(G);
      for (const name of ['makeAdder', 'add2', 'result']) d.reserve(G, name);
    },
    explain: {
      headline: 'prepare()는 scope 안의 모든 let과 fn 이름을 uninitialized cell로 미리 예약합니다.',
      changed: [
        'execute()가 Global environment를 넘겨 program 문장들에 대해 prepare()를 호출합니다.',
        '첫 번째 단계: 이 이름들이 Global에 이미 있는지 확인합니다(E_REDECLARE).',
        '두 번째 단계: makeAdder, add2, result를 예약합니다. 세 cell 모두 <uninitialized>입니다.',
      ],
      why: '이름을 먼저 예약해 두기 때문에 scope가 lexical하게 정해집니다. result는 해당 줄이 실행되기 전부터 Global에 속하므로, 지금 읽으면 Builtins를 찾아보는 대신 E_TDZ 오류가 납니다.',
      lookAt: 'Global에 TDZ 상태의 cell 3개가 생겼습니다.',
      real: [REF.execute, REF.prepare, REF.reserve],
    },
  },
  {
    id: 'prepare-functions',
    phase: 'prepare',
    title: 'prepare(): 함수 초기화',
    view: 'ast',
    focus: ts(T, 0, 21),
    astFocus: 'fn-makeAdder',
    run: (d) => {
      d.defineFunction('fn-makeAdder', 'makeAdder', 'fn-makeAdder', ['n'], G);
    },
    explain: {
      headline: '함수 선언은 곧바로 초기화되고, let binding은 TDZ에 남습니다.',
      changed: [
        '세 번째 단계: prepare()가 fn 문장마다 UserFunction { name, declaration, closure, arity }를 만듭니다.',
        'makeAdder의 closure는 지금 준비 중인 environment인 Global입니다.',
        'add2와 result는 각자의 let 문장이 실행될 때까지 uninitialized 상태입니다.',
      ],
      why: '이것이 함수 hoisting입니다. makeAdder는 선언보다 위쪽 줄에서도 호출할 수 있습니다. closure는 함수가 어디에서 선언됐는지를 기록합니다.',
      lookAt: 'Function values: fn makeAdder, code → Function makeAdder, closure → Env #1 Global.',
      real: [REF.prepare, REF.userFunction],
    },
  },
  {
    id: 'call-callee',
    phase: 'call',
    title: 'makeAdder(2) 평가',
    view: 'ast',
    focus: ts(T, 25, 28),
    astFocus: 'call-makeAdder',
    run: (d) => {
      d.lookup('makeAdder', G);
      d.note('callee = <fn makeAdder> · arity 1 = 1 arg ✓ · arg 2 → 2');
    },
    explain: {
      headline: 'let add2 = makeAdder(2)를 실행하면 먼저 callee를 찾습니다.',
      changed: [
        'list()가 문장을 순서대로 실행합니다. fn makeAdder 문장은 prepare()에서 이미 처리했으므로 실행 시점에는 아무 일도 하지 않습니다.',
        'Let이 initializer를 평가합니다. Call은 callee부터 평가하고, makeAdder를 Global에서 찾습니다.',
        'arity 검사(parameter 1개, 인자 1개)는 인자를 평가하기 전에 합니다. 그다음 Literal 2 → 2입니다.',
      ],
      why: '순서는 정해져 있습니다: callee → 호출 가능 여부 → arity 검사 → 왼쪽부터 인자. 인자 개수가 틀리면 인자를 평가하기 전에 실패합니다.',
      lookAt: 'Global.makeAdder에 붙은 읽기 표시.',
      real: [REF.list, REF.call, REF.lookup],
    },
  },
  {
    id: 'call-frame',
    phase: 'call',
    title: '새 frame: makeAdder(2)',
    view: 'ast',
    focus: ts(T, 0, 21),
    astFocus: 'fn-makeAdder',
    run: (d) => {
      d.createEnv(E2, 'call', 'Call · makeAdder(2)', d.fn('fn-makeAdder').closure);
      d.enterCall('makeAdder(2)', E2);
      d.reserve(E2, 'n');
      d.initialize(E2, 'n', num(2));
    },
    explain: {
      headline: 'makeAdder를 호출하면, 함수의 closure를 parent로 하는 새 Environment가 만들어집니다.',
      changed: [
        'new Environment(callee.closure)가 Env #2를 만듭니다. parent는 makeAdder의 closure인 Global입니다.',
        'parameter n을 Env #2에 예약하고 2로 초기화합니다.',
        'call stack에 makeAdder(2)가 올라갔고, 이제 Env #2 안에서 평가가 이어집니다.',
      ],
      why: 'parent는 함수를 호출한 곳이 아니라 선언한 곳입니다. 여기서는 둘 다 Global이지만, 뒤의 closure 호출에서 차이가 드러납니다.',
      lookAt: 'Global 아래에 n → 2를 가진 Env #2가 나타납니다.',
      real: [REF.call, REF.reserve],
    },
  },
  {
    id: 'capture',
    phase: 'capture',
    title: 'fn add가 Env #2를 capture',
    view: 'ast',
    focus: ts(T, 6, 17),
    astFocus: 'fn-add',
    run: (d) => {
      d.reserve(E2, 'add');
      d.defineFunction('fn-add', 'add', 'fn-add', ['v'], E2);
    },
    explain: {
      headline: 'fn add는 makeAdder(2) 호출 안에서 만들어지고, 그 호출의 Environment를 closure로 참조합니다.',
      changed: [
        'prepare()가 Env #2 안에서 makeAdder 본문을 처리하며 add를 예약합니다.',
        '새 UserFunction add가 만들어지고, closure는 n = 2가 들어 있는 Env #2를 가리킵니다.',
        'capture는 environment 전체에 대한 참조입니다. n의 값을 복사하는 것이 아닙니다.',
      ],
      why: '나중에 add가 실행되면 새 frame의 parent가 Env #2가 됩니다. 그래서 makeAdder가 끝난 뒤에도 n에 접근할 수 있습니다.',
      lookAt: 'Function values의 fn add에서 Env #2로 이어지는 화살표.',
      real: [REF.prepare, REF.userFunction],
    },
  },
  {
    id: 'return-completion',
    phase: 'return',
    title: 'return add;',
    view: 'ast',
    focus: ts(T, 18, 20),
    astFocus: 'return-add',
    run: (d) => {
      const fn = d.lookup('add', E2);
      d.completion('return', fn, 0);
    },
    explain: {
      headline: 'return add;는 JS 예외를 던지지 않고, return Completion을 만듭니다.',
      changed: [
        'list()가 본문을 실행합니다. fn add 문장은 아무 일도 하지 않고(normal), 이어서 Return이 add를 평가합니다.',
        'add는 Env #2에서 바로 찾습니다.',
        "문장의 결과는 Completion { kind: 'return', value: <fn add> }입니다.",
      ],
      why: 'Completion은 statement → list → Call로 전달되는 평범한 값입니다. Block과 while은 이를 그대로 넘기고, Call만 이를 풀어 값을 꺼냅니다.',
      lookAt: 'Runtime 패널 아래쪽의 Completion 표시줄.',
      real: [REF.completion, REF.statementExec, REF.list],
    },
  },
  {
    id: 'return-boundary',
    phase: 'return',
    title: 'makeAdder 반환',
    view: 'ast',
    focus: ts(T, 25, 28),
    astFocus: 'call-makeAdder',
    run: (d) => {
      d.completion('return', ADD, 2);
      d.exitCall();
    },
    explain: {
      headline: 'makeAdder는 반환됐지만, 그 environment는 아직 살아 있습니다.',
      changed: [
        'list()가 return Completion에서 멈추고 이를 위로 넘겼습니다. Call이 이를 풀어 <fn add> 값을 얻습니다.',
        'call stack이 다시 비었고, 평가는 Global로 돌아왔습니다.',
        'Env #2는 더 이상 실행 중이 아니지만, fn add가 여전히 closure로 가리키고 있습니다.',
      ],
      why: 'Mini-Lang은 environment를 직접 해제하지 않습니다. Env #2는 fn add를 통해 계속 도달할 수 있는 평범한 heap 객체이고, 메모리 정리는 JavaScript GC에 맡깁니다.',
      lookAt: 'Env #2에 "호출 종료 · closure 때문에 유지" 표시와 "fn add의 closure"가 붙었습니다.',
      real: [REF.call, REF.list],
    },
  },
  {
    id: 'return-bind',
    phase: 'return',
    title: 'add2 = <fn add>',
    view: 'ast',
    focus: ts(T, 22, 29),
    astFocus: 'let-add2',
    run: (d) => {
      d.initialize(G, 'add2', ADD);
    },
    explain: {
      headline: '반환된 함수가 n = 2가 있는 environment를 계속 살려 둡니다.',
      changed: [
        'Let 문장이 Global.add2의 cell을 <fn add>로 초기화합니다.',
        '이제 연결은 Global.add2 → fn add → closure → Env #2 (n = 2)입니다.',
        'result는 아직 TDZ에 있습니다.',
      ],
      why: '코드(fn add의 AST)와 environment(Env #2)의 이 한 쌍이 바로 closure입니다.',
      lookAt: '화살표를 따라가면 add2 → fn add → Env #2로 이어집니다.',
      real: [REF.statementExec, REF.reserve],
    },
  },
  {
    id: 'closure-callee',
    phase: 'closure-call',
    title: 'add2(10) 평가',
    view: 'ast',
    focus: ts(T, 33, 36),
    astFocus: 'call-add2',
    run: (d) => {
      d.lookup('add2', G);
      d.note('callee = <fn add> · arity 1 = 1 arg ✓ · arg 10 → 10');
    },
    explain: {
      headline: 'add2(10)을 호출하면, add2라는 이름을 통해 함수 add에 도달합니다.',
      changed: [
        'callee인 Identifier add2를 Global에서 찾으면 <fn add>가 들어 있습니다.',
        'arity 검사를 통과하고, Literal 10 → 10입니다.',
      ],
      why: '변수 이름(add2)과 함수 자체의 이름(add)은 서로 다릅니다. lookup은 cell을 찾고, 그 cell이 값을 담고 있습니다.',
      lookAt: 'Global.add2에 붙은 읽기 표시.',
      real: [REF.call, REF.lookup],
    },
  },
  {
    id: 'closure-frame',
    phase: 'closure-call',
    title: '새 frame: add(10)',
    view: 'ast',
    focus: ts(T, 6, 17),
    astFocus: 'fn-add',
    run: (d) => {
      d.createEnv(E3, 'call', 'Call · add(10)', d.fn('fn-add').closure);
      d.enterCall('add(10)', E3);
      d.reserve(E3, 'v');
      d.initialize(E3, 'v', num(10));
    },
    explain: {
      headline: '새 frame의 parent는 Global이 아니라 capture된 environment인 Env #2입니다.',
      changed: [
        'callee.closure = Env #2이므로 new Environment(callee.closure)가 Env #3을 만듭니다.',
        'v를 예약하고 10으로 초기화합니다. 본문에는 다른 선언이 없습니다.',
        '호출한 쪽은 Global이지만, Global은 Env #3의 parent가 아닙니다.',
      ],
      why: '이것이 lexical scope입니다. parent chain은 add를 호출한 곳이 아니라 선언한 곳을 따라갑니다.',
      lookAt: 'Env #3 → parent Env #2 → parent Global → parent Builtins.',
      real: [REF.call],
    },
  },
  {
    id: 'lookup-n',
    phase: 'closure-call',
    title: 'n 찾기 (lookup)',
    view: 'ast',
    focus: ts(T, 13),
    astFocus: 'id-n',
    run: (d) => {
      d.lookup('n', E3);
    },
    explain: {
      headline: 'n은 현재 frame에 없어서 parent environment를 따라 올라가고, Env #2에서 찾습니다.',
      changed: [
        'Environment.lookup은 v만 가진 Env #3에서 시작합니다. 없음(miss).',
        '다음으로 parent인 Env #2를 봅니다: n = 2. 찾음(hit).',
        '찾은 cell은 makeAdder가 초기화한 바로 그 cell입니다. 아무것도 복사되지 않았습니다.',
      ],
      why: 'lookup은 parent chain을 따라 이름으로 찾고, 가장 먼저 찾은 cell을 씁니다. 안쪽 선언이 바깥 선언을 가리는(shadowing) 것도 이 규칙 때문입니다.',
      lookAt: 'lookup 표시: Env #3에는 ✗, Env #2에는 ✓.',
      real: [REF.lookup],
    },
  },
  {
    id: 'lookup-v',
    phase: 'closure-call',
    title: 'n + v = 12',
    view: 'ast',
    focus: ts(T, 13, 15),
    astFocus: 'binary-sum',
    run: (d) => {
      d.lookup('v', E3);
      d.note('n + v  →  2 + 10  →  12');
    },
    explain: {
      headline: 'v는 바로 찾고, n + v는 12가 됩니다.',
      changed: [
        'v는 Env #3 자신에게 있습니다: 10.',
        'binary("+", 2, 10): 두 피연산자가 모두 number이므로 결과는 12입니다.',
        '+는 문자열 두 개를 이어 붙일 때도 쓰지만, 그 밖의 조합은 E_OPERAND 타입 오류입니다. 암묵적 변환은 없습니다.',
      ],
      why: 'Binary는 왼쪽, 오른쪽 순서로 평가한 뒤 연산자를 적용합니다. 두 피연산자는 서로 다른 environment에서 왔습니다.',
      lookAt: 'environment 아래의 평가 줄.',
      real: [REF.binaryOp],
    },
  },
  {
    id: 'closure-return',
    phase: 'closure-call',
    title: 'add가 12 반환',
    view: 'ast',
    focus: ts(T, 30, 37),
    astFocus: 'let-result',
    run: (d) => {
      d.completion('return', num(12), 3);
      d.exitCall();
      d.initialize(G, 'result', num(12));
    },
    explain: {
      headline: 'return 12가 호출 경계를 넘어가고, 이제 Env #3을 참조하는 곳이 없습니다.',
      changed: [
        'Return → Completion { return, 12 } → list() → Call이 이를 풀어 12를 얻습니다.',
        'Global.result가 12로 초기화됩니다.',
        'Env #3은 아무도 capture하지 않았으므로 도달할 수 없게 됩니다. Env #2는 add2가 아직 fn add를 갖고 있어서 남아 있습니다.',
      ],
      why: '어떤 값에서 도달할 수 있는 environment만 살아남습니다. 호출할 때마다 새 frame이 생기므로, add2를 다시 호출하면 자신만의 v를 가진 새 Env가 만들어집니다.',
      lookAt: 'Env #3에는 "해제됨"이, Env #2에는 여전히 "closure 때문에 유지"가 표시됩니다.',
      real: [REF.call, REF.completion],
    },
  },
  {
    id: 'print',
    phase: 'output',
    title: 'print(result)',
    view: 'ast',
    focus: ts(T, 38, 41),
    astFocus: 'call-print',
    run: (d) => {
      const print = d.lookup('print', G);
      const value = d.lookup('result', G);
      if (print.tag !== 'builtin') throw new Error('print should be the builtin');
      d.print(value);
    },
    explain: {
      headline: 'print는 Global 한 단계 위인 Builtins에서 찾고, 12를 출력합니다.',
      changed: [
        'print: Global에는 없고(miss) Builtins에서 찾습니다(hit). 인자를 0개 이상 받는 builtin입니다.',
        '인자 result는 Global에서 찾습니다: 12.',
        'print는 formatValue로 인자를 문자열로 만든 뒤 "12\\n"을 쓰고 null을 반환합니다.',
      ],
      why: 'builtin은 한 단계 위 environment에 있는 평범한 binding입니다. builtin 호출은 사용자 call frame을 만들지 않고 callDepth에도 포함되지 않습니다.',
      lookAt: 'Output 패널: 12.',
      real: [REF.builtins, REF.formatValue, REF.statementExec],
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
      headline: '실행이 끝났습니다. 프로그램은 12를 출력했습니다.',
      changed: [
        'list()가 normal completion으로 프로그램 끝에 도달했습니다.',
        '최종 상태: Global에는 makeAdder, add2 → fn add, result = 12가 있습니다.',
        'add2를 아직 호출할 수 있으므로 Env #2 (n = 2)도 남아 있습니다.',
      ],
      why: 'closure는 자신을 만든 호출보다 오래 살아남았습니다. counter, factory, callback이 동작하는 원리가 모두 이 한 가지 사실로 설명됩니다.',
      lookAt: '최종 environment 그래프. Mini-Lang 저장소의 examples/09-closure-counter.lang과 비교해 볼 수 있습니다.',
      real: [REF.execute],
    },
  },
];

export const closureScenario: Scenario = {
  id: 'closure',
  title: 'Closure',
  blurb: 'makeAdder(2)가 n = 2가 있는 environment를 유지하는 함수를 반환합니다',
  source: CLOSURE_SOURCE,
  tokens: T,
  ast: AST,
  phases: [
    { id: 'source', label: 'Source' },
    { id: 'lex', label: 'Lex' },
    { id: 'parse', label: 'Parse' },
    { id: 'prepare', label: 'Prepare' },
    { id: 'call', label: 'Call' },
    { id: 'capture', label: 'Capture' },
    { id: 'return', label: 'Return' },
    { id: 'closure-call', label: 'Call closure' },
    { id: 'output', label: 'Output' },
  ],
  steps,
  expectedOutput: '12\n',
};
