# TuringScript Language Specification

Status: Draft 0.1  
Language ID: `turingScript`  
Target: Symphony assembly (`docs/spec`)

This document is the source of truth for the TuringScript language. Compiler behavior must not be implemented from a proposal or an open question. A feature becomes normative only after it is moved into a confirmed section.

## 1. Language goals

### Confirmed

- TuringScript uses JavaScript syntax and compiles ahead of time to Symphony assembly.
- Compilation produces assembly text, not machine-code bytes.
- The compiler is deterministic: the same source and compiler version must produce the same assembly.
- The compiler has two ordered phases: precompilers, then pipelines.
- Every compiler step accepts a string and returns a string.
- Steps within a phase execute in registration order.

### Proposed

- TuringScript is a deliberately small, statically compilable JavaScript subset rather than a complete ECMAScript implementation.
- Accepted TuringScript should look and behave like JavaScript wherever the target machine permits it.
- Features that require a JavaScript runtime, garbage collector, dynamic object model, prototype chain, or `eval` are outside the initial language.

## 2. Source text and lexical structure

### Proposed

- Source files are UTF-8 text.
- Line endings may be LF or CRLF and are normalized to LF internally.
- JavaScript whitespace is accepted between tokens.
- Single-line comments use `//` or '#''.
- Block comments use `/* ... */`.
- Identifiers use the JavaScript identifier form restricted initially to ASCII: `[A-Za-z_$][A-Za-z0-9_$]*`.
- Reserved JavaScript keywords cannot be used as identifiers.
- A semicolon removed during precompilation.
- Automatic semicolon insertion is not permitted

### Important precompiler constraint

Comments cannot be rewritten and must be preseerved alongside their placement inside source code.
For example "let x = 123 // initial value" should be preserved as "compiled code // initial value" even if compiled code produces multiline code like 
"""
compiled code // initial value
compiled code 
compiled code 
compiled code 
"""

Whitespace will be removed by precompiler for consistency. For example, spaces inside `"a  b c"` removed by precompiler to a single whitespace  `"a b c"`

## 3. Program structure

### Proposed grammar

The notation below is descriptive, not yet normative EBNF.

```text
Program          ::= Statement*
Statement        ::= VariableDeclaration
                   | ExpressionStatement
                   | BlockStatement
                   | IfStatement
                   | WhileStatement
                   | ForStatement
                   | FunctionDeclaration
                   | ReturnStatement
                   | BreakStatement
                   | ContinueStatement
                   | EmptyStatement
BlockStatement   ::= "{" Statement* "}"
```

Modules, imports, exports, classes, exceptions, generators, and async code are not allowed

## 4. Values and types

### Open

The target specification defines register names and instruction encodings but does not explicitly define the language-level numeric model. Before expressions can be specified, the following must be decided:




## 5. Literals

### Proposed

- Decimal integer literals: `0`, `1`, `42`.
- Hexadecimal integer literals: `0xff`.
- Binary integer literals: `0b1010`.
- Boolean literals: `true`, `false`.
- Negative values are parsed as unary negation applied to a positive integer literal.

String, array, object, template, regular-expression, bigint, and floating-point literals remain open or unsupported for the initial version.

## 6. Variables and scope

### SIGNES

computer uses 32 bit architecture for all of its components
and dont differentiate between datatypes

compiler should use memory tracking for variables and arrays and never dispose of memory because its practically infinite
variable laways size of 32 bit arrays dont support resizing and always should specify size on creation and tracked alongside normal  variables

example 
```js
let counter = 0; // occupies 0 slot in memory
const limit = 10; // occupies 1 slot in memory
let arr = Array(10) // occupies 10 next slots in memory 2-12
const snake = 102; // occupies 13 slot in memory
```

- unsigned integer is  main datatype for compiler to simplify operations all literals must be converted to unsigned integer at precompile time
- floating point values are not permitted 
- variable cant be created without an assigned value

### datatypes

- integer  `0`, `1`, `42`. negative integers cannot be inserted directly to computer and must be negated separately so 44 can be mov r1,44 but -55 must be mov r1,55 and neg r1,r1 to achieve -55
- boolean true false is converted to 1 and 0 at precompile time
- array is a

### Proposed

```js
let counter = 0;
const limit = 10;
counter = counter + 1;
```

- `let` declares variable language doesnt support scopes at any kind.
- `const` converted to `let` at precompile but precompiler before checks if assignement happened and throws an error.
- `var`  converted to `let` at precompile.


- Reading a binding before its declaration is a compile error.
- Declaring the same name twice  is a compile error.
- Assignment to a `const` binding is a precompile error.



## 7. Expressions and operators

### Proposed initial operators

| Precedence | Operators | Meaning |
| --- | --- | --- |
| 1 | `()` | Grouping |
| 2 | `!`, `~`, unary `-`, unary `+` | Unary operations |
| 3 | `*`, `/`, `%` | Multiplication and division |
| 4 | `+`, `-` | Addition and subtraction |
| 5 | `<<`, `>>` | Shifts |
| 6 | `<`, `<=`, `>`, `>=` | Relational comparison |
| 7 | `===`, `!==` | Equality comparison |
| 8 | `&` | Bitwise AND |
| 9 | `^` | Bitwise XOR |
| 10 | `|` | Bitwise OR |
| 11 | `&&` | Logical AND with short-circuiting |
| 12 | `||` | Logical OR with short-circuiting |
| 13 | `=`, `+=`, `-=`, `*=`, `/=`, `%=` | Assignment |

### Open

- Whether loose equality (`==`, `!=`) is allowed beacuse everything is same datatype
- Whether unsigned right shift (`>>>`) is supported.
- Whether increment/decrement (`++`, `--`) is supported.
- Whether the conditional expression (`condition ? a : b`) is supported.
- Division-by-zero behavior.
- Signed versus unsigned semantics for comparisons and right shifts.

## 8. Control flow

### Proposed

```js
if (condition) {
  statement();
} else {
  statement();
}

while (condition) {
  statement();
}

for (let i = 0; i < limit; i += 1) {
  statement();
}
```

- `if`/`else`, `while`, and C-style `for` are supported.
- Braces are required for control-flow bodies.
- `break` and `continue`  not permitted.
- `do`/, `for`/`of`, `for`/`in`, `switch`  not permitted.
- `while` permitted

## 9. Functions and calling convention

### Proposed source syntax

```js
function add(left, right) {
  return left + right;
}
```

- Named function declarations are supported.
- Functions may accept positional parameters and return one value.
- A bare `return` returns the language's default/empty value, which remains to be defined.
- Function expressions, arrow functions, closures,  rest parameters, and default parameters not permited.

- recursion and nested function permitted.

### Target facts

- Symphony provides `call label`, `ret`, `push register`, and `pop register` pseudo-instructions.
- `sp` is the stack-pointer register.
- `flags` is reserved for comparisons and control flow.
- `zr` is the zero register.
- General registers are `r1` through `r13`.

### Open ABI decisions

- Which registers carry arguments and return values.
- Which registers are caller-saved and callee-saved.
- Stack growth direction and alignment.
- Local-variable and spilled-temporary layout.
- Recursion support.
- Entry-point name and program termination behavior.

## 10. Memory model

### Target facts

The target exposes 8-, 16-, and 32-bit loads/stores plus persistent-memory `pload`/`pstore` instructions. Immediate addresses are U16 values.

### Open

- Addressable memory size.
- Byte order.
- Alignment requirements.
- Whether TuringScript exposes raw pointers or typed memory helpers.
- Static/global allocation range.
- Stack memory range and maximum stack size.
- Persistent-memory source API.

## 11. Input, output, keyboard, screen, and timers

### Target facts

Symphony assembly provides instructions for general input/output, keyboard input, screen configuration, time values, and an instruction counter.

### Open source API

The JavaScript-facing API must be defined before these instructions are emitted. Possible shapes include globals, namespaced built-ins, or imported declarations. No old-build built-in names are carried into TuringScript automatically.

Example options, not yet language rules:

```js
const value = hardware.input();
hardware.output(value);
const key = hardware.keyboard();
```

## 12. Mapping to Symphony assembly

### Confirmed target capabilities

- Register and immediate moves.
- Arithmetic: addition, subtraction, multiplication, and negation.
- Bitwise logic: NAND, AND, OR, NOR, XOR, and NOT.
- Logical and arithmetic shifts.
- Register/immediate comparison through `flags`.
- Conditional and unconditional jumps.
- Main and persistent memory access.
- Stack operations and function calls.

### Required compiler responsibilities

- Parse source into a syntax tree.
- Validate supported syntax and binding rules.
- Resolve names and scopes.
- Lower high-level control flow into labels, comparisons, and jumps.
- Select instructions.
- Allocate registers and spill values when necessary.
- Apply the agreed calling convention.
- Emit deterministic assembly text.
- Preserve source locations for diagnostics.

### Open lowering decisions

- Assembly label naming and escaping.
- Temporary-register strategy.
- Constant folding and other optimizations.
- Whether assembly comments include source lines.
- Exact lowering for booleans and short-circuit operators.
- Exact representation of globals, locals, and constants.

## 13. Diagnostics

### Proposed

- Invalid syntax and unsupported JavaScript features are compile errors.
- Diagnostics include a stable error code, message, line, and column.
- The compiler must not silently reinterpret unsupported JavaScript.
- Compilation either returns valid assembly or reports errors; partial assembly output is not executable.

The current string-to-string compiler API cannot carry structured diagnostics. The API will eventually need either a result object or a separate diagnostics channel; the ordered internal steps can remain string transformations where appropriate.

## 14. Compilation pipeline

### Current scaffold

```text
source string
  -> registered precompilers, in order
  -> registered pipelines, in order
  -> assembly string
```

### Proposed semantic stages

```text
source text
  -> normalization
  -> tokenization
  -> parsing
  -> syntax tree
  -> semantic validation and symbol resolution
  -> intermediate representation
  -> control-flow lowering
  -> instruction selection
  -> register allocation
  -> assembly formatting
```

Whether each semantic stage remains a string-to-string pipeline is open. Syntax trees and intermediate representations are safer as typed internal data even if the public `compile(source: string): string` API remains unchanged.

## 15. Compatibility and versioning

### Proposed

- The language starts at specification version `0.1`.
- Backward-incompatible language changes increment the minor version while the language is pre-1.0.
- Compiler output may change between versions while preserving specified program behavior.
- The Monaco language ID remains `turingScript` and is independent of the spec version.

## 16. Decisions required before implementation

1. Is TuringScript a small JavaScript-compatible subset, or is full ECMAScript compatibility a long-term goal?
2. What is the exact integer width, signedness, and overflow behavior?
3. Which value types are required in version 0.1?
4. Are semicolons required?
5. Which declarations are supported: `let`, `const`, and/or `var`?
6. Which expression operators are required initially?
7. Which control-flow statements are required initially?
8. Are functions required in version 0.1, and can they recurse?
9. What calling convention should functions use?
10. What source-level API maps to hardware I/O and persistent memory?
11. How are globals, locals, arrays, and strings represented in memory?
12. Should compiler diagnostics change the public string-to-string API?
13. Should the two current example precompilers remain, become token-aware, or be removed?

## 17. Conformance examples

Normative conformance examples will be added only after the open semantic decisions above are confirmed. Each example should contain:

- TuringScript source.
- Expected result or diagnostic.
- Expected Symphony assembly when exact output is normative.
- Notes describing observable behavior when multiple assembly outputs are valid.

