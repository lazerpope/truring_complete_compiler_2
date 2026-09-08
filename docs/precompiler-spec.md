# TuringScript Precompiler Specification

Status: Draft 0.1  
Companion language specification: `docs/turing-script-spec.md`  
Companion grammar: `docs/turing-script-grammar.md`

Development is precompiler-first. No new language lowering should be added to the Symphony compiler pipeline while the corresponding precompiler stage is missing.

## 1. Pipeline contract

Every precompiler and compiler pipeline has exactly this public shape:

```ts
type PrecompilerPipeline = [
  code: string,
  error: {
    isError: boolean
    reasons: string[]
  },
  debug: {
    isEnabled: boolean
    results: Array<{
      phase: 'precompiler' | 'pipeline'
      stepName: string
      resultingCode: string
    }>
  },
]

type CompilerResult = PrecompilerPipeline
type CompilerStep = (pipeline: PrecompilerPipeline) => CompilerResult
```

Each stage:

- Receives the complete tuple and returns the complete tuple.
- Reads source from tuple item `0` and places its result back in item `0`.
- Returns immediately without transformation when `error.isError` is already true.
- Adds user-facing failures to `error.reasons` and sets `error.isError` to true.
- Never deletes reasons or debug results produced by earlier stages.
- Does not directly add its debug snapshot. `Compiler.applySteps` records the snapshot using the registered stage name after the stage returns.
- Must preserve comments. When one source statement expands, its comment stays on the first generated line.
- Should be deterministic and idempotent where practical.
- Uses `runCompilerTransform` for ordinary `string -> string` transformations.

## 2. Debug collection

`DEBUG_COLLECT` is declared in `src/compiler/main.ts`.

When it is `true`:

1. Compilation creates a debug state with `isEnabled: true`.
2. After every successfully invoked or failed stage, `Compiler.applySteps` appends its phase, registered name, and resulting code.
3. Later stages see the accumulated debug state unchanged.
4. Compilation prints one styled console group containing every collected result in registration order.
5. The final `CompilerResult` also exposes those results programmatically at tuple item `2`.

When it is `false`, no snapshots are appended or printed.

## 3. One rule per stage

Every independently correctable language rule has its own file and registered name. A stage must not quietly perform an unrelated lowering. Shared tokenization, parsing, comment handling, and generated-name helpers may live in utility files, but utilities are not registered stages.

For example:

```text
collapseEquality.ts
  ===  -> ==
  !==  -> !=
```

It does not also lower booleans, rewrite declarations, or format whitespace.

## 4. Ordered built-in stages

All listed stages are implemented and registration order must match this table.

| Order | Stage/file                       | Status      | Single responsibility                                                                                                                                                                  |
| ----: | -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    01 | `normalizeLineEndings.ts`        | Implemented | Convert CRLF and CR to LF.                                                                                                                                                             |
|    02 | `removeWhitespaces.ts`           | Implemented | Collapse unnecessary code whitespace while preserving blank lines and exact comment contents.                                                                                          |
|    03 | `validateSemicolons.ts`          | Implemented | Reject semicolons except the two delimiters in a C-style `for` header.                                                                                                                 |
|    04 | `validateIdentifiers.ts`         | Implemented | Enforce identifier syntax, case rules, reserved names, duplicates, and the reserved `__ts_` prefix.                                                                                    |
|    05 | `validateStaticStructs.ts`       | Implemented | Validate class schemas, fields, construction, access, scalar arguments, array-field rules, and all prohibited struct-as-value behavior.                                                |
|    06 | `lowerStaticStructs.ts`          | Implemented | Remove class schemas and instances by emitting deterministic scalar backing arrays and separate array-field arrays, then rewrite every valid field use.                                |
|    07 | `validateUnsupportedSyntax.ts`   | Implemented | Reject prohibited JavaScript and low-level escape-hatch syntax after confirmed struct syntax has been removed.                                                                         |
|    08 | `collapseEquality.ts`            | Implemented | Convert `===` to `==` and `!==` to `!=` outside comments.                                                                                                                              |
|    09 | `lowerBooleanLiterals.ts`        | Implemented | Convert `true` to `1` and `false` to `0`.                                                                                                                                              |
|    10 | `lowerNullishLiterals.ts`        | Implemented | Convert `null` and `undefined` to `0`.                                                                                                                                                 |
|    11 | `validateConstAssignments.ts`    | Implemented | Record `const` bindings and reject later reassignment while leaving declarations intact for constant evaluation.                                                                       |
|    12 | `lowerMathConstants.ts`          | Implemented | Replace `Math.U16_MAX`, `Math.S16_MAX`, `Math.U32_MAX`, `Math.S32_MIN`, and `Math.S32_MAX` with their U32 values.                                                                      |
|    13 | `foldConstantExpressions.ts`     | Implemented | Resolve known `const` names, evaluate required constant expressions, and partially fold literal `+`, `-`, `*`, and `/` subexpressions without treating mutable variables as constants. |
|    14 | `validateScreen8.ts`             | Implemented | Validate Screen8 declaration, pixel writes, `screen.present(color)`, constant colors, known bounds, and prohibited screen-as-value behavior.                                           |
|    15 | `lowerScreen8.ts`                | Implemented | Lower Screen8 initialization, pixel writes, and presentation into canonical compiler-private forms.                                                                                  |
|    16 | `validateArrayRules.ts`          | Implemented | Collect ordinary and struct-generated array metadata and reject zero sizes, runtime sizes, nested arrays, aliasing, reassignment, comparison, passing, and other invalid array use.    |
|    17 | `lowerArrayLiterals.ts`          | Implemented | Expand ordinary and struct-generated array literals into `Array(size)` plus ordered indexed assignments; holes become zero and a trailing comma is ignored.                            |
|    18 | `replaceArrayLengths.ts`         | Implemented | Replace each valid ordinary or struct-generated `array.length` with its known constant size.                                                                                           |
|    19 | `validateConstantArrayBounds.ts` | Implemented | Reject every precompiler-known out-of-bounds index, including struct array fields after lowering; leave runtime indexes unchecked.                                                     |
|    20 | `lowerArrayForLoops.ts`          | Implemented | Convert declaring `for (let index in array)` and reuse-form `for (index in array)` loops to `while`, including struct array fields after lowering and correct `continue` behavior.     |
|    21 | `lowerCStyleForLoops.ts`         | Implemented | Convert C-style `for` to `while`, moving its update into the body and every applicable `continue` path.                                                                                |
|    22 | `lowerElseIf.ts`                 | Implemented | Convert `else if` into an `if` nested in an `else` block.                                                                                                                              |
|    23 | `lowerPostfixUpdates.ts`         | Implemented | Convert statement-form `target++` and `target--` into ordinary assignments while evaluating array indexes once.                                                                        |
|    24 | `lowerCompoundAssignments.ts`    | Implemented | Convert `+=`, `-=`, `*=`, `/=`, and `%=` into ordinary assignments while evaluating targets once.                                                                                      |
|    25 | `lowerMathCalls.ts`              | Implemented | Expand runtime `Math.min`, `max`, `smin`, `smax`, and `abs` after loop lowering, with once-only left-to-right and short-circuit-safe evaluation.                                       |
|    26 | `lowerNestedHardwareReads.ts`    | Implemented | Extract nested value-producing hardware calls into deterministic temporaries without changing left-to-right or short-circuit behavior.                                                 |
|    27 | `lowerLargeConstants.ts`         | Implemented | Replace U32 expression literals above U16 with high/low U16 construction statements. Allocation-size metadata is not rewritten.                                                        |
|    28 | `lowerConstDeclarations.ts`      | Implemented | Convert validated `const` declarations to `let`.                                                                                                                                       |
|    29 | `lowerVarDeclarations.ts`        | Implemented | Convert `var` declarations to `let` without JavaScript hoisting.                                                                                                                       |
|    30 | `validateCanonicalSource.ts`     | Implemented | Parse the final text against the canonical grammar and report anything that an earlier stage failed to remove.                                                                         |
|    31 | `formatCanonicalSource.ts`       | Implemented | Apply deterministic final formatting without modifying comment contents.                                                                                                               |

Static structs and Screen8 are implemented. Function stages remain paused and intentionally absent from this order.

## 5. Registration

Stages are registered explicitly with stable names:

```ts
compiler.registerPrecompiler('normalizeLineEndings', normalizeLineEndings)
compiler.registerPrecompiler('removeWhitespaces', removeWhitespaces)
compiler.registerPrecompiler('collapseEquality', collapseEquality)
```

Registration order is execution order and therefore part of compiler behavior. The table above is the normative target order; implemented stages keep their relative table order even while intervening stages are still planned.

### Compiler registration

```ts
compiler.registerPipeline('compileCanonical', compileCanonical)
```

The complete flow is:

```text
TuringScript source
  -> precompilers
  -> canonical compiler pipeline
  -> final Symphony assembly
```

For Screen8, `compileCanonical` has five responsibilities:

1. Compile initialization so `framebuffer_0` is displayed and reserved register `r13` points at hidden `framebuffer_1`.
2. Expand each private pixel-store pseudo-operation into `r13`-relative address addition plus `store_8`.
3. Expand each private present pseudo-operation into a screen-offset update, an `r13` buffer toggle, and a hidden-buffer color clear.
4. Reject generated code that overlaps the two framebuffers ending at absolute address `0x8000`.
5. Append two equal framebuffer regions immediately before `@0x8000`.

The compiler accepts these private operations only after the trusted precompiler stages. User source cannot spell them because identifiers beginning with `__ts_`, labels, inline assembly, and raw memory operations are rejected before lowering.

## 6. Error behavior

A validation stage should collect all errors that it can identify reliably in one pass, append all of them to `reasons`, and return the error state. No later stage runs after that return.

A transformation stage should avoid partial output. If it cannot safely transform the entire input, it returns the original incoming code with its error reasons.

Unexpected exceptions and thrown `CompilerError` instances are caught at the step boundary and converted to one reason. They must not escape to the UI.

## 7. Generated names

- Generated identifiers begin with `__ts_`.
- The remainder contains a readable stage purpose and deterministic numeric counter, such as `__ts_math_max_0`.
- A stage scans existing generated identifiers before choosing its next counter.
- Generated names never use randomness.
- When a generated temporary would otherwise evaluate an expression twice, the expression is assigned to the temporary once and all generated uses reference that temporary.
