# TuringScript Language Specification

Status: Draft 0.4
Language ID: `turingScript`  
Target: Symphony assembly (`docs/spec`)

This document is the source of truth for TuringScript. Sections marked **Confirmed** are normative. Sections marked **Paused** or **Open** must not be implemented until their decisions are confirmed.

## 1. Language goals

### Confirmed

- TuringScript is a small, statically compilable, JavaScript-like language.
- It compiles ahead of time to Symphony assembly text, not machine-code bytes.
- It is not a complete ECMAScript implementation.
- Unsupported JavaScript syntax must produce a compiler error rather than being silently reinterpreted.
- Compilation is deterministic: the same source and compiler version produce the same assembly.
- The final assembly compiler must remain lean. Source conveniences and newly registered source features should be lowered by precompilers whenever possible.
- Features requiring a JavaScript runtime, garbage collector, dynamic object model, prototype chain, or `eval` are prohibited.
- Modules, imports, exports, exceptions, generators, async code, string values, floating-point values, regular expressions, template literals, object literals, and dynamic objects are prohibited.

## 2. Compiler contract and execution order

### Confirmed

The public compiler and every registered precompiler, compiler, and postcompile step use this pipeline contract:

```ts
class CompilerError extends Error {
  reason: string
  errorOccured: boolean
}

interface PipelineErrorState {
  isError: boolean
  reasons: string[]
}

interface PipelineDebugResult {
  phase: 'precompiler' | 'pipeline' | 'postcompile'
  stepName: string
  resultingCode: string
}

interface PipelineDebugState {
  isEnabled: boolean
  results: PipelineDebugResult[]
}

type PrecompilerPipeline = [
  code: string,
  error: PipelineErrorState,
  debug: PipelineDebugState,
]

type CompilerResult = PrecompilerPipeline
type CompilerStep = (pipeline: PrecompilerPipeline) => CompilerResult
```

- Every step receives and returns the complete pipeline tuple.
- Tuple item `0` is the current source or assembly string.
- Tuple item `1` accumulates error reasons. A failed step returns `isError: true` and one or more `reasons`.
- Tuple item `2` carries debug configuration and ordered step snapshots.
- A thrown `CompilerError` or unexpected exception is converted into the tuple's error state.
- Compilation stops immediately after the first step returning an error state.
- The application displays all collected error reasons in the output pane.
- Partial assembly produced before an error is not executable output.
- When `DEBUG_COLLECT` is `true`, the compiler records the resulting code after every named step and prints all snapshots to the console in registration order using styled console groups.

The three compiler phases always run in this order:

```text
initial PrecompilerPipeline
  -> registered precompilers, in registration order
  -> registered compiler pipelines, in registration order
  -> registered postcompile pipelines, in registration order
  -> final CompilerResult tuple
```

Precompiler and compiler-pipeline input is TuringScript source. The compiler pipeline produces assembly text. Postcompile pipelines consume and emit assembly text and are the only phase allowed to finalize generated assembly-only resources such as the Pixel 8 framebuffer.

## 3. Precompiler boundary

### Confirmed

- A precompiler consumes TuringScript source text and emits TuringScript source text that later precompilers or the core compiler can understand.
- Precompiler output has the same textual form that could be written in the source editor.
- A precompiler may add support for a source-level function or construct by expanding it into existing core-language statements.
- New source conveniences should not require changes to the core compiler when they can be expressed using already-supported core syntax.
- Precompiler order matters, and every precompiler receives the previous precompiler's output.
- Generated names and output must be deterministic.

Examples of precompiler responsibilities:

- Normalize whitespace and line endings.
- Reject semicolons used as ordinary statement terminators. The C-style `for` precompiler consumes the two semicolons that are permitted only inside its header.
- Validate `const` assignments, then lower `const` to `let`.
- Lower `var` to `let`.
- Lower booleans to `0` and `1`.
- Lower static struct classes and instances into generated ordinary scalar-backing and array-field arrays.
- Lower array literals into an allocation followed by element assignments.
- Resolve array sizes and replace `array.length` with the known constant size.
- Lower `else if` to nested `if` statements and C-style `for` loops to `while` loops.
- Lower postfix `++` and `--` statements to ordinary assignments.
- Lower arithmetic compound assignments to ordinary assignments while evaluating their target exactly once.
- Lower constants larger than U16 into operations on U16 pieces.
- Constant-fold supported precompiler expressions, including constant `**`, and lower the compiler-recognized `Math` namespace.
- Expand registered source-level helper functions into core TuringScript code.

The core compiler is therefore only required to understand the canonical subset documented throughout this specification. In particular, it understands `let`; it does not directly implement `const` or `var`.

## 4. Source text, whitespace, and comments

### Confirmed

- Source files are UTF-8 text.
- LF and CRLF line endings are accepted and normalized to LF.
- Unneeded whitespace is collapsed by a precompiler for stable compiler input.
- String literals are prohibited, so whitespace never needs to be preserved as string data.
- Semicolons are prohibited as ordinary statement terminators.
- A newline separates simple statements.
- Multiline expressions are prohibited.
- Precompiler output places each canonical simple statement on its own line.
- Single-line comments may start with `//` or `#`. A `#` begins a comment wherever it is encountered outside another comment; preceding whitespace is not required.
- Block comments use `/* ... */`.
- Comments are preserved through precompilation.
- If one commented source line expands into multiple lines, its comment is attached to the first generated line only.

Example:

```js
let value = helper() // initial value
```

If `helper()` expands to four lines, the result is conceptually:

```text
generated line 1 // initial value
generated line 2
generated line 3
generated line 4
```

Whitespace normalization must distinguish code from comments. It must not modify the text inside a preserved comment.

## 5. Identifiers and program structure

### Confirmed

- Identifiers are initially restricted to `[A-Za-z_$][A-Za-z0-9_$]*`.
- Identifiers are case-sensitive.
- Identifiers beginning with `__ts_` are reserved for deterministic compiler-generated names and are prohibited in user source.
- Reserved TuringScript keywords cannot be used as identifiers.
- Braces are required for control-flow and function bodies.
- TuringScript has one program-wide variable scope.
- The developer is responsible for avoiding unintended interactions between program-wide variables used by different functions.

The working lexical, source, static-struct, constant-expression, and lean canonical grammars are maintained in `docs/turing-script-grammar.md`. Function productions remain explicitly paused there.

## 6. Numeric model and literals

### Confirmed

- Registers, variables, array elements, struct fields, and intermediate values are 32-bit words.
- The machine does not store datatype or signedness metadata.
- The default interpretation of every value is an unsigned 32-bit integer.
- Signed interpretation is requested by explicit signed operators only.
- The compiler does not track signed or unsigned variable types.
- `/` and `%` interpret their operands as unsigned values. Addition, subtraction, multiplication, and bitwise operations need no separate signed form because their 32-bit result bits are the same.
- The compiler does not diagnose, prevent, or compensate for arithmetic overflow. The hardware result is accepted.
- Precompiler constant evaluation does not add overflow correction or automatic intermediate truncation. The programmer is responsible for keeping compile-time calculations within the intended U32 range; behavior outside that range is not guaranteed and no overflow diagnostic is promised.
- Floating-point, bigint, `NaN`, and infinity values are prohibited.
- Decimal, hexadecimal, and binary integer literals are accepted.
- Every literal must fit within an unsigned 32-bit word after preprocessing.
- `true` is lowered to `1`, and `false` is lowered to `0`.
- `null` and `undefined` are allowed source literals and are lowered to `0` by a precompiler.
- A negative source value is lowered to a positive value followed by negation because it cannot be moved directly as a negative immediate.
- Octal literals, numeric separators, and exponential notation are prohibited.
- Runtime exponentiation is prohibited. A constant exponent expression such as `2 ** 31` is allowed only when a precompiler can fully evaluate and replace it with a U32 value.

Examples:

```js
let decimal = 42
let hexadecimal = 0xff
let binary = 0b1010
let negative = -55
let enabled = true
```

### Large constants

Symphony immediate operands are U16 values in the range `0` through `65535`. A precompiler detects larger U32 literals and lowers each one into a multistage construction using its high and low 16-bit pieces.

The conceptual assembly operation is:

```text
mov result, high16
lsl result, result, 16
or result, result, low16
```

The precompiler emits equivalent core TuringScript statements rather than making large literals a special case in the final compiler. Generated temporary names must be deterministic and collision-safe.

## 7. Variables and memory allocation

### Confirmed

- A canonical variable declaration uses `let` and requires an initializer.
- Reading a variable before its declaration is a compile error.
- “Before declaration” is determined by canonical source order; the compiler does not perform definite-initialization analysis across branches.
- Declaring the same name more than once is a compile error because there is only one scope.
- `const` is accepted source syntax. A precompiler rejects reassignment and then lowers it to `let`.
- `var` is accepted source syntax and is lowered to `let`.
- Every scalar variable occupies one 32-bit word in compiler-managed RAM.
- Declarations are allowed at top level and inside control-flow or function bodies. Their storage is reserved statically, while their initializer executes whenever control reaches the declaration. Coordinating the resulting program-wide variables is the programmer's responsibility.
- If control never reaches a declaration, its reserved RAM remains at its hardware-initialized zero value. Reading that storage through another valid path is the programmer's responsibility.
- `var` receives no JavaScript hoisting behavior; after precompilation it behaves exactly like the corresponding `let` declaration at the same source position.
- Variables and array elements receive sequential memory addresses and are never automatically reclaimed.
- RAM is byte-addressed. One byte contains 8 bits, so every 32-bit scalar occupies four consecutive byte addresses.
- Consecutive scalar variables begin at addresses `0`, `4`, `8`, and so on.
- Direct source use of `load_8`, `load_16`, `load_32`, `store_8`, `store_16`, and `store_32` is prohibited.
- Compiler-managed variables and arrays use `pload` and `pstore` as 32-bit main RAM operations, despite their persistent-memory names in the target instruction set.
- Internal expansion of `call`, `ret`, `push`, and `pop` may use `load_32` and `store_32`; this does not make those instructions available directly in TuringScript source.
- The Screen8 postcompile pipeline may generate `store_8` only for writes into its reserved framebuffer region; this does not expose program-memory access to source code.
- Immediate addresses are limited to U16, but register-addressed `pload` and `pstore` can use addresses constructed in registers.
- The compiler does not check whether total allocation exceeds physical RAM. Available RAM is treated as practically unlimited, and exceeding it is the programmer's responsibility.

Example allocation:

```js
let counter = 0        // bytes 0 through 3
const limit = 10       // bytes 4 through 7
let values = Array(10) // elements at bytes 8 through 47
const snake = 102      // bytes 48 through 51
```

## 8. Static arrays

### Confirmed

- Arrays are allowed.
- An array has a fixed size and cannot be resized.
- An array identifier is a compile-time symbol containing the fixed byte address of its first element and its fixed length.
- The array identifier does not occupy a runtime pointer slot.
- Only the array elements consume RAM, alongside scalar variables in sequential addresses.
- An array element occupies one 32-bit word.
- `Array(size)` allocates an array with the specified size.
- Array elements may be read or assigned using any valid one-line scalar expression as the index.
- A dynamic element address is calculated at runtime as `compileTimeBaseAddress + runtimeIndex * 4`.
- Array length is compile-time metadata; it does not consume a second runtime slot.

```js
let values = Array(10)
values[2] = 99
let index = 3
let selected = values[index]
```

- Array literals are source-level convenience syntax lowered by a precompiler.
- A sparse array literal is allowed. Every omitted element is lowered to `0`.
- Array literal elements may be any otherwise-valid one-line runtime expression.
- Array literal elements are evaluated from left to right when execution reaches the declaration, not during precompilation unless an element is independently constant-foldable.

```js
let values = [3, 4, 5]
```

lowers to:

```js
let values = Array(3)
values[0] = 3
values[1] = 4
values[2] = 5
```

For example, `[1, , 3]` lowers in the same way but assigns `0` to element `1`.

Runtime expressions are preserved as generated element assignments:

```js
let values = [speed + 1, hp * 2, currentScore]
```

lowers to:

```js
let values = Array(3)
values[0] = speed + 1
values[1] = hp * 2
values[2] = currentScore
```

### Confirmed array behavior

- `Array(size)` requires a size that the precompiler can resolve to a constant unsigned integer before runtime.
- The size may be an integer literal, a constant expression, or a previously declared `const` whose value is resolvable during precompilation.
- Runtime-dependent sizes are prohibited and produce a precompiler error.
- `Array(0)` is prohibited and produces a precompiler error.
- Every cell created by `Array(size)` starts at `0` because RAM initializes to zero.
- An empty array literal `[]` is prohibited because zero-length arrays are prohibited.
- A single trailing comma after the final array element is ignored, so `[1, 2,]` has length `2`.
- A constant index known to be outside the array is a precompiler error.
- A variable index has no generated runtime bounds check. Staying within bounds is the programmer's responsibility.
- An array declaration cannot be reassigned, whether it was written with `let` or `const`.
- Array elements remain mutable, including elements of a `const` array.
- Array reassignment and `const` checks happen entirely during precompilation.
- An array identifier may appear only as the base of an indexing expression or in `.length`.
- Arrays cannot be assigned as values, compared, returned, or passed as arguments.
- Aliasing such as `let second = first` is prohibited when `first` is an array.
- Nested arrays are prohibited.
- `array.length` is replaced with the known constant size by a precompiler.
- Total RAM allocation is not checked against a fixed maximum.
- Array storage is reserved statically even when its declaration appears inside a control-flow body or function. Reaching the declaration controls execution of its generated element initializers, not allocation of its addresses.
- Reaching the same `Array(size)` declaration more than once has implementation-defined clearing behavior. Programs must not depend on whether its existing elements are preserved or reset.
- Arithmetic compound assignment and postfix increment/decrement may target an array element, for example `values[i] += 2` and `values[i]++`.

```js
Array(10) // valid
Array(5 * 2) // valid after constant evaluation

const size = 10
Array(size) // valid after resolving size

Array(0) // precompiler error: zero-sized array
Array(keyboard()) // precompiler error: runtime-dependent size
```

## 9. Static structs declared with `class`

### Confirmed

Classes are compile-time schemas for statically allocated struct instances. They are not runtime class values. Class declarations, construction expressions, instance identifiers, and field access must be completely removed by precompilation; the core compiler has no struct support or struct metadata.

```js
class Player {
  health = 100
  inventory = Array(8)
  position = [0, 0]
  score = 0
}

let player = Player(75, 500)

player.inventory[2] = 50
player.position[0]++
player.score = player.health + 10
```

Class declarations obey these rules:

- A class declaration is allowed only at top level and must appear before its first construction.
- A class body contains one field per line. Methods, constructors, getters, setters, static members, inheritance, and nested class declarations are prohibited.
- Every field has an initializer and field names must be unique within their class.
- A field initializer is either a scalar source expression, `Array(constantSize)`, or a nonempty array literal.
- An empty class is prohibited.
- A class name cannot be reused by another class, variable, array, instance, or reserved word.
- Field defaults do not execute when the class schema is declared. They execute when control reaches an instance declaration.
- `this`, `super`, field references inside defaults, and other runtime class behavior remain prohibited.

An instance is created only as a variable declaration initializer:

```js
let first = Player(75, 500)
const second = Player()
```

- `let`, `const`, and `var` are accepted for an instance declaration, subject to their existing precompiler behavior.
- Constructor arguments correspond only to scalar fields, in scalar-field declaration order. Array fields do not occupy constructor argument positions.
- Each supplied scalar argument overrides the corresponding scalar default. Missing scalar arguments use their defaults. Supplying more arguments than scalar fields is an error.
- Fields initialize in class declaration order. Each selected default or override expression is evaluated exactly once when execution reaches the instance declaration.
- An instance declaration inside control flow owns permanent static storage, while its generated initializers execute whenever the declaration is reached, consistent with ordinary variables and arrays.
- An instance identifier occupies no runtime pointer slot and cannot be reassigned, including when declared with `let` or `var`.
- A `const` instance still permits scalar-field and array-element mutation, matching `const` array behavior.

### Storage and lowering

Each instance receives one generated backing array for all scalar fields and a separate generated backing array for every array field. Scalar offsets follow scalar-field declaration order. Every array field has the size defined by its class schema, and every instance receives independent storage for that field.

Conceptually, the example above first lowers to ordinary source constructs like these:

```js
let __ts_struct_player_scalars_0 = Array(2)
__ts_struct_player_scalars_0[0] = 75

let __ts_struct_player_inventory_1 = Array(8)
let __ts_struct_player_position_2 = [0, 0]

__ts_struct_player_scalars_0[1] = 500

__ts_struct_player_inventory_1[2] = 50
__ts_struct_player_position_2[0]++
__ts_struct_player_scalars_0[1] = __ts_struct_player_scalars_0[0] + 10
```

The exact generated names may differ, but they must begin with reserved `__ts_`, be deterministic, be collision-safe, and remain stable for identical input. Later existing precompilers lower the generated array literals, `.length`, `for...in`, postfix updates, compound assignments, constants, and other source conveniences.

Separate backing arrays for array fields are normative. They allow the ordinary array validation and lowering stages to process each field without adding struct behavior to the core compiler. A struct array field is source-level grouping, not an array nested inside another array.

### Field behavior

- A scalar field may be read anywhere a scalar expression is accepted and may be targeted by ordinary assignment, arithmetic compound assignment, postfix increment, or postfix decrement.
- An array field may be used only with indexing, `.length`, or either supported array `for...in` form.
- Array-field indexes may be runtime expressions. Constant out-of-bounds indexes are precompiler errors; variable indexes receive no runtime bounds checks.
- Array-field elements remain mutable for every instance declaration kind.
- Array fields cannot be resized, reassigned, aliased, compared, returned, passed, or used as standalone values.
- Instance identifiers cannot be assigned, copied, compared, returned, passed, or used as standalone values.
- Unknown fields and dynamic field access such as `player[field]` are errors.
- Arrays of structs, structs inside structs, and nested array fields are initially prohibited.
- Repeatedly reaching an instance declaration follows the existing implementation-defined clearing behavior for each generated array. Programs must not depend on preserved or cleared contents.

```js
for (let index in player.inventory) {
  output(player.inventory[index])
}

player.inventory = otherInventory // prohibited
let alias = player                 // prohibited
if (player == second) {            // prohibited
}
```

The `ClassName(...)` construction syntax is a TuringScript precompiler construct. It does not enable ordinary function calls and does not require `new`.

## 10. Expressions and operators

### Confirmed operators

Listed from highest to lowest precedence:

| Operators | Meaning |
| --- | --- |
| `()` | Grouping |
| `!`, `~`, unary `-` | Unary operations |
| `*`, `/`, `%` | Multiplication, division, modulo |
| `+`, `-` | Addition and subtraction |
| `<<`, `>>`, `s>>` | Left shift, unsigned right shift, signed right shift |
| `<`, `<=`, `>`, `>=`, `s<`, `s<=`, `s>`, `s>=` | Unsigned and signed relational comparisons |
| `==`, `!=`, `===`, `!==` | Equality and inequality |
| `&` | Bitwise AND |
| `^` | Bitwise XOR |
| `|` | Bitwise OR |
| `&&` | Logical AND with short-circuiting |
| `||` | Logical OR with short-circuiting |
| `=`, `+=`, `-=`, `*=`, `/=`, `%=` | Assignment |

The signed operators must be written as contiguous tokens.

- Operands are evaluated from left to right.
- Every operand and assignment target expression is evaluated exactly once. Precompiler lowering must not duplicate side effects; for example, the index in `values[keyboard()]++` is read once.
- Binary operators of the same precedence associate from left to right.
- Parentheses may be used to group mathematical and other expressions and override the normal precedence.
- Chained assignment such as `a = b = 1` is prohibited.
- Assignment is a statement operation and does not produce a value. Assignments nested inside declarations, conditions, or other expressions are prohibited.
- Unary `+` is prohibited because TuringScript has no datatype conversion.
- Bitwise and shift compound assignments `&=`, `|=`, `^=`, `<<=`, `>>=`, and `s>>=` are unsupported.
- Postfix `value++` and `value--` are supported as statements and are lowered by a precompiler to `value = value + 1` and `value = value - 1`.
- Logical NOT `!value` produces `1` when `value` is zero and `0` otherwise.
- The special `Math` namespace described below provides compiler-recognized precompiler helpers. It is not an object or runtime module.

| TuringScript | Target behavior |
| --- | --- |
| `a >> b` | `lsr`: unsigned/logical right shift |
| `a s>> b` | `asr`: signed/arithmetic right shift |
| `a < b` | `cmp` followed by unsigned `jb` behavior |
| `a <= b` | `cmp` followed by unsigned `jbe` behavior |
| `a > b` | `cmp` followed by unsigned `ja` behavior |
| `a >= b` | `cmp` followed by unsigned `jae` behavior |
| `a s< b` | `cmp` followed by signed `jl` behavior |
| `a s<= b` | `cmp` followed by signed `jle` behavior |
| `a s> b` | `cmp` followed by signed `jg` behavior |
| `a s>= b` | `cmp` followed by signed `jge` behavior |

Loose and strict equality are both supported and have identical behavior because TuringScript has one machine-word datatype. Equality does not need signed variants because signedness does not change whether two bit patterns are equal.

Division by zero produces `0`. Modulo `A` by zero produces `A`. These are target-machine behaviors and do not produce compiler errors.

### Comparison results

`cmp left, right` writes three independent Boolean results into `flags`:

- Bit 0: `left === right`.
- Bit 1: `left < right` using unsigned interpretation.
- Bit 2: `left s< right` using signed interpretation.

Comparison expressions may be assigned to variables and always produce exactly `0` or `1`. The compiler extracts and combines the flag bits directly:

| Expression | Boolean value derived from `flags` |
| --- | --- |
| `a == b` or `a === b` | bit 0 |
| `a != b` or `a !== b` | bit 0 XOR `1` |
| `a < b` | bit 1 |
| `a <= b` | bit 0 OR bit 1 |
| `a > b` | (bit 0 OR bit 1) XOR `1` |
| `a >= b` | bit 1 XOR `1` |
| `a s< b` | bit 2 |
| `a s<= b` | bit 0 OR bit 2 |
| `a s> b` | (bit 0 OR bit 2) XOR `1` |
| `a s>= b` | bit 2 XOR `1` |

When a comparison is used directly as a condition, the compiler may use the matching conditional jump without first storing its Boolean value.

### Conditional Boolean operators

- `&&` and `||` are defined for Boolean condition operations.
- They are supported inside `if`, `while`, and `for` conditions.
- Comparison expressions, `true`, `false`, and values intended by the programmer to contain `0` or `1` may be their operands.
- The compiler does not track Boolean types and does not validate whether an operand is Boolean.
- Using `&&` or `||` with non-Boolean values is undefined behavior and is the programmer's responsibility.
- Using `&&` or `||` outside a control-flow condition is undefined behavior.
- Within conditions they use short-circuit control flow: `a && b` evaluates `b` only when `a` is true; `a || b` evaluates `b` only when `a` is false.

For example, this is valid:

```js
if ((5 > speed && hp > 0) || isGolden == true) {
  action()
}
```

`&&` binds more tightly than `||`, matching the operator table, so the outer parentheses above are optional.

### Shift behavior

- Shift counts use only their lowest five bits and therefore wrap modulo 32.
- `value >> 32` is equivalent to `value >> 0`.
- `value >> 55` is equivalent to `value >> 23`.
- `<<` and `>>` fill newly introduced bits with `0`.
- `s>>` is the signed arithmetic-right-shift operation and fills newly introduced high bits with the original sign bit.
- Shifted-out bits are discarded.
- The compiler does not emit range checks or special handling for shift counts.

### Open operator decisions

None currently.

Prefix `++value`, prefix `--value`, and the conditional expression `condition ? a : b` are prohibited. The JavaScript unsigned-right-shift token `>>>` is not needed because TuringScript defines `>>` as unsigned, so it is unsupported.

### Confirmed precompiler `Math` namespace

`Math` is reserved syntax recognized and completely removed by a precompiler. It does not create an object, permit general property access, or exist at runtime.

The supported members are:

```js
let smaller = Math.min(a, b)       // unsigned comparison
let larger = Math.max(a, b)        // unsigned comparison
let signedSmaller = Math.smin(a, b) // signed comparison
let signedLarger = Math.smax(a, b)  // signed comparison
let magnitude = Math.abs(value)     // signed interpretation

let maximumU16 = Math.U16_MAX // 0xffff
let maximumS16 = Math.S16_MAX // 0x7fff
let maximumU32 = Math.U32_MAX // 0xffffffff
let minimumS32 = Math.S32_MIN // 0x80000000
let maximumS32 = Math.S32_MAX // 0x7fffffff
```

- `min`, `max`, `smin`, and `smax` require exactly two arguments.
- `abs` requires exactly one argument.
- Unsigned minimum constants are omitted because their value is always the literal `0`.
- Arguments may be runtime expressions. Each argument is evaluated exactly once, from left to right.
- `Math.abs(Math.S32_MIN)` produces the unchanged bit pattern `0x80000000`; no overflow error or special correction is generated.
- Any other `Math` property or call is prohibited unless registered by a later precompiler extension.
- The precompiler lowers every member into existing core statements and expressions.

## 11. Control flow

### Confirmed

- `if`/`else`, `while`, and C-style `for` are supported.
- `else if` is supported and is lowered by a precompiler to a nested `if` in the `else` body.
- C-style `for` is lowered by a precompiler to a `while` loop.
- A `continue` originating inside a lowered C-style `for` executes the update clause before testing the condition again.
- Braces are required for their bodies.
- A condition is false when its value is `0` and true when it is nonzero.
- `break` and `continue` are supported and apply to the nearest enclosing loop.
- Empty C-style `for` clauses, including `for (;;)`, are prohibited.
- The two separators in a C-style `for` header are semicolons. This is the only source context in which semicolons are allowed.
- Specialized `for (let identifier in array)` and `for (identifier in array)` loops are allowed for ordinary arrays and struct array fields. Both assign successive indexes from `0` through `array.length - 1`.
- The `let` form declares a program-wide index variable. The bare form reuses a previously declared scalar and resets it to `0` when reached.
- Both array-loop forms are lowered by a precompiler to `while` loops.
- `do`/`while`, `for`/`of`, `switch`, and labeled statements are prohibited.

```js
if (condition) {
  action()
} else {
  fallback()
}

while (condition) {
  action()
}

```

```js
for (let i = 0; i < limit; i++) {
  action()
}

for (let index in values) {
  output(values[index])
}

for (index in values) {
  output(values[index])
}
```

Ordinary semicolon statement terminators and the comma operator remain prohibited.

The C-style `for` initializer must be either one `let` declaration or one ordinary assignment. Its condition may be any valid condition expression. Its update must be one ordinary assignment, arithmetic compound assignment, or postfix increment/decrement. All three clauses are required.

Standalone block statements are prohibited because blocks do not create scope. Blocks appear only where required as bodies of control-flow constructs or, once resumed, functions.

## 12. Unsupported and precompiler-only JavaScript syntax

### Confirmed

- `null` and `undefined` are the only null-like source values; both lower to `0`.
- Object literals, `new`, destructuring declarations or assignments, spread syntax, optional chaining, and nullish coalescing are prohibited.
- The comma operator is prohibited. This does not settle the separate question of delimiters inside a C-style `for` header.
- `typeof`, `delete`, `void`, and `instanceof` are prohibited.
- The binary `in` operator is prohibited. The dedicated `for (let identifier in array)` and `for (identifier in array)` syntaxes are separate loop constructs.
- `this`, `super`, and the implicit `arguments` object are prohibited.
- `with`, `debugger`, `yield`, and `await` are prohibited.
- Property access is prohibited except for `array.length`, confirmed static-struct field access, and the existing `Math` precompiler namespace.
- Numeric separators, octal literals, and exponential notation are prohibited.
- Multiple declarations such as `let a = 1, b = 2` are prohibited.
- Logical assignments `&&=`, `||=`, and `??=`, exponent assignment `**=`, and unsigned-shift assignment `>>>=` are unsupported.
- Ordinary user-defined function calls within expressions are prohibited while function semantics are paused.
- Constant `**` and the special `Math` namespace are precompiler facilities, not runtime operator or module support.

## 13. Functions and calling convention

### Confirmed

- Named function declarations are intended to be supported.
- A function may call another function.
- All source variables remain in one program-wide scope; the developer is responsible for coordinating variables used by different functions.
- Function expressions, arrow functions, closures, rest parameters, and default parameters are prohibited.

### Informative assembly example

`docs/examples/functions.txt` demonstrates one existing Symphony convention:

- `r1` and `r2` carry arguments.
- `r1` carries the result.
- A function restores every used register other than its argument/result registers.
- `push` and `pop` preserve registers.
- `call` and `ret` maintain return addresses on the stack, allowing one function to call another.

This example is informative, not yet the normative TuringScript ABI.

### Paused

- The normative argument and result registers.
- Maximum argument count and handling of additional arguments.
- Caller-saved and callee-saved registers.
- Local-variable and temporary storage during calls.
- Recursion support.
- Nested function declarations.
- Stack-frame layout and alignment.
- Entry-point name.
- Bare `return` behavior.
- Evaluation order for function arguments.

No function compiler work should begin until these decisions resume.

## 14. Hardware operations

### Confirmed target operations

TuringScript targets the hardware operations defined by `docs/spec`:

- General input: `in`.
- General output: `out`.
- Keyboard input: `keyboard`.
- Screen configuration/output: `screen`.
- Low and high timer words: `time_0` and `time_1`.
- Instruction counter: `counter`.

The operand and result behavior is defined by the corresponding Symphony instruction signatures. These operations are compiler-recognized hardware access, not ordinary user-defined runtime functions.

### Confirmed source syntax

```text
input()                  -> value
output(value)            -> statement with no value
keyboard()               -> value
screen(setting, value)   -> statement with no value
time_0()                 -> value
time_1()                 -> value
counter()                -> value
```

The source uses `input()` and `output()` instead of the assembly names `in` and `out`, because `in` is already a language token. Examples are maintained in `docs/examples/examples.txt`.

### Hardware calls in expressions

Confirmed value-producing hardware operations may appear inside otherwise-valid expressions, including declarations, assignments, conditions, and arguments to other hardware operations:

```js
let next = keyboard() + 1

if (keyboard() != 0) {
  action()
}

screen(setting, keyboard())
```

A precompiler lowers nested hardware reads into deterministic generated temporaries. The transformation must preserve left-to-right evaluation and short-circuit behavior. In particular, a hardware read in the right operand of `&&` or `||` must remain inside the conditional path where that operand would have been evaluated; it must not be hoisted unconditionally.

### Pixel 8 framebuffer macro

TuringScript supports one precompiler-managed, write-only Pixel 8 framebuffer:

```js
let screen = Screen8(19)

let GREEN_COLOR = 0b00011100
screen[10][10] = GREEN_COLOR
```

`let screen = Screen8(resolutionSetting)` is a dedicated declaration-like macro, not an ordinary variable declaration. The words `screen` and `Screen8` remain reserved and cannot be used as ordinary identifiers. `validateIdentifiers` must recognize this one exact form and defer it to the Screen8 validation stage.

The macro owns no ordinary variable or `pstore` pointer slot. Its framebuffer address exists only as the generated assembly label `framebuffer`.

The declaration is allowed exactly once, must be at top level, and must appear before every framebuffer write. Only `let screen` is accepted; `const`, `var`, aliases, reassignment, passing, returning, comparison, and standalone use are prohibited. Direct `screen(setting, value)` hardware calls remain separate syntax.

The resolution setting must be a precompiler-resolvable integer from `0` through `255`. Pixel 8 dimensions are:

```text
width  = 4 * (resolutionSetting + 1)
height = 3 * (resolutionSetting + 1)
bytes  = width * height
```

For setting `19`, the framebuffer is `80 * 60 = 4,800` bytes. Each byte is one `RRRGGGBB` color. For example, full green is `0b00011100` (`28`).

Framebuffer writes use zero-based `[x][y]` coordinates. Their byte offset is:

```text
offset = y * width + x
```

Therefore `screen[10][10]` at resolution setting `19` addresses byte `810`. Constant coordinates outside the selected dimensions are precompiler errors. Runtime coordinates have no bounds checks. The `x` expression, `y` expression, and color expression are evaluated exactly once, from left to right. A constant color must fit in `0..255`; for a runtime value, `store_8` writes its low eight bits.

The framebuffer is initially write-only. Pixel reads, compound assignments, increment/decrement, `.length`, row values, and using `screen[x]` by itself are prohibited. This avoids requiring generated `load_8` behavior.

The Screen8 precompiler lowers the source syntax to reserved internal operations conceptually equivalent to:

```text
__ts_screen8_init(19)
let __ts_screen8_x_0 = 10
let __ts_screen8_y_0 = 10
let __ts_screen8_color_0 = GREEN_COLOR
let __ts_screen8_offset_0 = __ts_screen8_y_0 * 80 + __ts_screen8_x_0
__ts_screen8_store(__ts_screen8_offset_0, __ts_screen8_color_0)
```

These `__ts_screen8_*` operations are compiler-private canonical forms and can never be written by the programmer. The core compiler evaluates their operands and emits postcompile-private assembly pseudo-operations. It does not expose general source access to `store_8`.

The Screen8 postcompile pipeline expands initialization into:

```asm
mov r1, 0
screen r1, 2
mov r1, 2
screen r1, 19
mov r1, 1
add r2, zr, framebuffer
screen r1, r2
```

A generated pixel-store pseudo-operation with offset and color registers is expanded conceptually into:

```asm
add offsetRegister, offsetRegister, framebuffer
store_8 [offsetRegister], colorRegister
```

Finally, postcompile appends exactly one framebuffer region:

```asm
framebuffer:
@0x2000
```

`@0x2000` pads memory with zero bytes up to absolute byte address `0x2000`; it is not an instruction. The postcompiler must calculate the final address of `framebuffer` after expanding all pseudo-operations and report an error unless `framebufferAddress + framebufferByteCount <= 0x2000`. At resolution setting `19`, the framebuffer must begin at or before address `0x0D40` (`8192 - 4800`). The postcompiler must use assembly byte sizes, not source-line counts, for this calculation.

Although the hardware resolution setting permits `0..255`, the fixed `@0x2000` boundary means settings above `25` can never fit even with an empty program. Smaller settings can still fail when the generated program occupies too much space before `framebuffer`. The validation stage may reject an impossible setting early, while final capacity is always checked after postcompile expansion.

The postcompiler does not append a halt or jump. As with every TuringScript program, the programmer must prevent execution from falling through into appended data when necessary.

## 15. Mapping to Symphony assembly

### Confirmed

The core compiler is responsible for:

- Parsing canonical precompiler output.
- Tracking declared variables and sequential RAM slots.
- Rejecting reads before declaration and duplicate declarations.
- Compiling canonical expressions.
- Lowering canonical control flow into deterministic labels, comparisons, and jumps.
- Selecting Symphony instructions.
- Allocating temporary registers and spilling values when required.
- Emitting deterministic assembly text.
- Preserving source comments on the first emitted line associated with a source statement.
- Compiling generated Screen8 initialization and store operations into explicit postcompile-private pseudo-operations with register operands.

Precompilers are responsible for source conveniences that can be represented in the core language, including `const`, `var`, booleans, static structs, array literals and lengths, array validation, large constants, `else if`, `for`, postfix increment/decrement, constant helpers, and registered helper expansions.

`pload` and `pstore` are compiler-emitted assembly instructions, not TuringScript source operations. Source programs access compiler-managed RAM through variables and arrays.

Source labels, `goto`, inline assembly, raw Symphony instructions, and other low-level escape hatches are prohibited.

Postcompile pipelines are responsible for expanding compiler-private assembly pseudo-operations, appending the `framebuffer` label and `@0x2000` reservation, and validating that the selected framebuffer fits below byte address `0x2000`. Generated `store_8` is permitted for this framebuffer even though direct source use remains prohibited.

The compiler appends no halt instruction or terminal loop. Ending execution safely is the programmer's responsibility. A program that must stop progressing can explicitly end in a suitable loop.

### Open lowering details

- Exact assembly label naming and escaping.
- Temporary-register allocation and spilling strategy.
- Constant folding and optional optimizations.
- Exact canonical representation of generated temporaries.
- Source-location preservation beyond attached source comments.

## 16. Diagnostics

### Confirmed

- Invalid syntax and unsupported features set `PipelineErrorState.isError` to `true` and append user-facing messages to `reasons`.
- A stage may collect multiple related reasons before it returns.
- `CompilerError.reason` is converted into a pipeline reason when a stage throws it.
- The first stage returning an error stops the remaining compilation steps.
- The compiler currently does not promise a separate error code, line, or column field.

## 17. Canonical precompiler output

### Confirmed

Precompiler output remains textual TuringScript. It is not a separate binary format, syntax tree, or hidden object representation.

The output must use only features understood by the next registered step. The final precompiler must emit only the core subset understood by the assembly compiler. At minimum, this means:

- Declarations use `let`, never `const` or `var`.
- Boolean values have become `0` or `1`.
- Static classes and instances have become generated scalar-backing and array-field arrays, and all struct property access has been replaced.
- Array literals have become `Array(size)` plus indexed assignments.
- Array sizes have been resolved, array rules have been validated, and `.length` has become a constant.
- `else if` has become nested `if`.
- C-style `for` and both array `for...in` forms have become `while` loops.
- Postfix increment/decrement has become ordinary assignment.
- Arithmetic compound assignment has become ordinary assignment.
- Large U32 literals have become operations using U16 pieces.
- Registered helper functions have been expanded into existing core statements.
- Nested value-producing hardware calls have been extracted into generated temporaries without changing evaluation or short-circuit order.
- The Screen8 macro and two-dimensional pixel assignments have become compiler-private `__ts_screen8_init` and `__ts_screen8_store` operations.
- Simple statements are emitted one per line without semicolons.
- Comments remain attached to the first generated line for their source statement.

A precompiler may itself tokenize or parse source internally. Its public boundary remains `PrecompilerPipeline -> CompilerResult`; tuple item `0` is the textual TuringScript passed to the next stage.

## 18. Remaining decisions before implementation

### Open now

No non-function language decisions are currently open. Implementation-defined repeated array and struct-instance initialization behavior remains the programmer's responsibility.

### Paused

All function ABI, recursion, nested-function, stack-frame, entry-point, and bare-return decisions listed in section 13.

## 19. Conformance examples

Each implemented feature must eventually have examples containing:

- TuringScript source.
- Precompiler output where lowering is involved.
- Expected assembly or required observable behavior.
- Expected `CompilerError.reason` for invalid input.
