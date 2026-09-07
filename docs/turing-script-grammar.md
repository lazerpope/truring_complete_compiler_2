# TuringScript Grammar

Status: Draft 0.1  
Companion specification: `docs/turing-script-spec.md`

This file defines two textual languages:

1. **Source TuringScript**, accepted before built-in precompilers run.
2. **Canonical TuringScript**, emitted by the final built-in precompiler and accepted by the lean assembly compiler.

Function productions remain intentionally omitted. Static-struct syntax is specified as a confirmed precompiler-only source feature and is absent from canonical TuringScript.

## 1. Notation

```text
Name       ::= production
"text"     ::= literal token
[ X ]      ::= zero or one X
{ X }      ::= zero or more X
X | Y      ::= X or Y
EOF        ::= end of source
NEWLINE    ::= normalized LF line ending
```

Productions describe syntax. Rules labelled **semantic rule** are validated after parsing.

## 2. Lexical grammar

```text
IdentifierStart ::= "A".."Z" | "a".."z" | "_" | "$"
IdentifierPart  ::= IdentifierStart | "0".."9"
Identifier      ::= IdentifierStart { IdentifierPart }

DecimalLiteral  ::= "0" | NonZeroDigit { DecimalDigit }
HexLiteral      ::= "0x" HexDigit { HexDigit } | "0X" HexDigit { HexDigit }
BinaryLiteral   ::= "0b" BinaryDigit { BinaryDigit } | "0B" BinaryDigit { BinaryDigit }
IntegerLiteral  ::= DecimalLiteral | HexLiteral | BinaryLiteral

NonZeroDigit    ::= "1".."9"
DecimalDigit    ::= "0".."9"
HexDigit        ::= DecimalDigit | "A".."F" | "a".."f"
BinaryDigit     ::= "0" | "1"
```

- Identifiers are case-sensitive.
- A decimal literal with multiple digits cannot begin with `0`.
- Octal, exponential notation, numeric separators, floats, and bigint suffixes are not tokens.
- User identifiers beginning with `__ts_` are prohibited. Built-in precompilers use that prefix for generated identifiers.
- Tokens use longest-match scanning. For example, `s>>`, `===`, and `!==` are each one token.
- Spaces and tabs separate tokens but do not terminate statements.
- `NEWLINE` terminates simple statements and is prohibited inside an expression or parenthesized header.
- `//` comments consume everything through the next newline.
- `/* ... */` comments may span lines and do not nest.
- A `#` begins a comment wherever it is encountered outside another comment. Preceding whitespace is not required.
- Comment contents are preserved exactly; whitespace normalization never rewrites them.

## 3. Reserved names

The following words cannot be user identifiers. This includes active language words, paused words, prohibited JavaScript words, built-ins, and hardware operations.

```text
Array Math Screen8
arguments async await
break case catch class const continue counter
debugger default delete do
else enum export extends
false finally for from function
get
if implements import in Infinity input instanceof interface
keyboard
let
NaN new null
of output
package private protected public
return
screen set static super switch
this throw time_0 time_1 true try typeof
undefined
var void
while with
yield
```

## 4. Source statement grammar

Simple statements occupy one logical line. Structural newlines around blocks are shown descriptively; the parser may represent them as separator tokens.

```text
SourceProgram          ::= { NEWLINE } [ SourceStatementList ] EOF
SourceStatementList    ::= SourceStatement { NEWLINE { NEWLINE } SourceStatement } { NEWLINE }

SourceStatement        ::= SourceSimpleStatement
                         | StaticStructDeclaration
                         | Screen8Declaration
                         | Screen8PixelAssignment
                         | IfStatement
                         | WhileStatement
                         | CStyleForStatement
                         | ArrayForStatement

SourceSimpleStatement  ::= VariableDeclaration
                         | AssignmentStatement
                         | UpdateStatement
                         | HardwareWriteStatement
                         | BreakStatement
                         | ContinueStatement

VariableDeclaration    ::= DeclarationKind Identifier "=" DeclarationInitializer
DeclarationKind        ::= "let" | "const" | "var"
DeclarationInitializer ::= ArrayCreation | ArrayLiteral | StructConstruction | SourceExpression

AssignmentStatement    ::= AssignmentTarget AssignmentOperator SourceExpression
AssignmentTarget       ::= Identifier | ArrayAccess | StructScalarField | StructArrayAccess
AssignmentOperator     ::= "=" | "+=" | "-=" | "*=" | "/=" | "%="

UpdateStatement        ::= AssignmentTarget ( "++" | "--" )

HardwareWriteStatement ::= "output" "(" SourceExpression ")"
                         | "screen" "(" SourceExpression "," SourceExpression ")"

BreakStatement         ::= "break"
ContinueStatement      ::= "continue"
```

Semantic rules:

- A declaration always requires an initializer.
- An assignment is a statement and never an expression.
- A target must be a scalar identifier or array element.
- Assigning to an array identifier or to `array.length` is prohibited.
- Arithmetic compound assignment and postfix update evaluate their target exactly once.
- `break` and `continue` are valid only inside the nearest enclosing loop.
- `output` and `screen` do not produce values.
- Ordinary expression statements such as `a + b` are prohibited.
- Standalone blocks are prohibited.
- Semicolons are prohibited except for the two separators in a C-style `for` header.

`let screen = Screen8(...)` and `screen[x][y] = value` are dedicated macro productions. In those productions, `screen` is a fixed reserved token rather than an `Identifier`.

## 5. Source control-flow grammar

```text
Block                  ::= "{" { NEWLINE } [ SourceStatementList ] "}"

IfStatement            ::= "if" "(" SourceExpression ")" Block
                           [ { NEWLINE } "else" ( Block | IfStatement ) ]

WhileStatement         ::= "while" "(" SourceExpression ")" Block

CStyleForStatement     ::= "for" "(" ForInitializer ";" SourceExpression ";" ForUpdate ")" Block

ForInitializer         ::= "let" Identifier "=" SourceExpression
                         | AssignmentTarget "=" SourceExpression

ForUpdate              ::= AssignmentTarget AssignmentOperator SourceExpression
                         | AssignmentTarget ( "++" | "--" )

ArrayForStatement      ::= "for" "(" [ "let" ] Identifier "in" ArrayIterable ")" Block
ArrayIterable          ::= Identifier | StructArrayField
```

Semantic rules:

- Braces are mandatory.
- Every C-style `for` clause is mandatory.
- A C-style `for` declaration is scalar; it cannot declare an array.
- Both array-loop forms require their iterable to be a declared array or a known struct array field.
- `for (let index in values)` declares `index` in the single program-wide scope.
- `for (index in values)` reuses a previously declared scalar `index` and resets it to `0` when the loop is reached.
- Both forms visit indexes `0` through `values.length - 1`.
- `else if` associates with the preceding unmatched `if` and is lowered to an `if` nested inside an `else` block.
- A `continue` in a lowered C-style `for` executes the update before the next condition test.
- A `continue` in a lowered array loop increments the generated index before the next condition test.

## 6. Source array grammar

```text
ArrayCreation          ::= "Array" "(" ConstantExpression ")"
ArrayLiteral           ::= "[" ArrayLiteralContents "]"
ArrayLiteralContents   ::= ArraySlot { "," ArraySlot } [ "," ]
ArraySlot              ::= [ SourceExpression ]

ArrayAccess            ::= Identifier "[" SourceExpression "]"
ArrayLength            ::= Identifier "." "length"
```

Array-literal slot parsing is defined by top-level comma placement:

- `[]` is prohibited.
- A single final trailing comma is discarded and does not add a slot.
- Every other omitted slot becomes `0`.
- `[1, 2,]` becomes two elements.
- `[1, , 3]` becomes `1`, `0`, `3`.
- `[,]` becomes one zero element.
- `[,,]` becomes two zero elements.

Further semantic rules:

- `Array(size)` requires a precompiler-resolvable integer greater than zero.
- Nested arrays are prohibited.
- An array identifier may occur only in `array[index]` and `array.length` after its declaration.
- An array index may be any valid one-line scalar expression.
- A constant out-of-bounds index is a precompiler error.
- A runtime index has no bounds check.
- Runtime array-literal elements execute from left to right whenever control reaches the declaration.
- Whether repeatedly reaching `Array(size)` clears or preserves its existing static storage is implementation-defined. Programs must not depend on either behavior.

## 7. Source Screen8 framebuffer grammar

```text
Screen8Declaration     ::= "let" "screen" "=" "Screen8" "(" ConstantExpression ")"
Screen8PixelAssignment ::= "screen" "[" SourceExpression "]"
                          "[" SourceExpression "]" "=" SourceExpression
```

Semantic rules:

- Exactly one declaration is allowed, at top level and before all pixel writes.
- The resolution setting resolves at precompile time to `0..255`.
- With the fixed framebuffer ending at `0x2000`, settings above `25` are always invalid; final capacity depends on compiled program size and is checked by the compiler.
- The first index is zero-based `x`; the second is zero-based `y`.
- Width is `4 * (setting + 1)` and height is `3 * (setting + 1)`.
- The byte offset is `y * width + x`.
- Constant out-of-bounds coordinates are errors; runtime coordinates are unchecked.
- Index and color expressions are evaluated once in `x`, `y`, color order.
- A constant color is in `0..255`; a runtime color contributes its low eight bits.
- Screen8 is write-only. Reads, partial indexing, compound assignment, and updates are prohibited.
- `screen` is not a runtime value and cannot be aliased, reassigned, passed, returned, or compared.

## 8. Source static-struct grammar

```text
StaticStructDeclaration ::= "class" Identifier "{" NEWLINE
                            StaticStructField
                            { NEWLINE StaticStructField }
                            { NEWLINE } "}"

StaticStructField       ::= Identifier "=" StructFieldInitializer
StructFieldInitializer ::= ArrayCreation | ArrayLiteral | SourceExpression

StructConstruction      ::= Identifier "(" [ StructScalarArguments ] ")"
StructScalarArguments   ::= SourceExpression { "," SourceExpression }

StructScalarField       ::= Identifier "." Identifier
StructArrayField        ::= Identifier "." Identifier
StructArrayAccess       ::= StructArrayField "[" SourceExpression "]"
StructArrayLength       ::= StructArrayField "." "length"
```

Whether a two-part member expression is a scalar field or an array field is determined from the class schema during struct validation. This syntax is source-only and must be removed before canonical parsing.

Semantic rules:

- Class declarations are top-level, nonempty, unique, and must precede construction.
- Every field is uniquely named within its class and requires an initializer.
- Scalar constructor arguments map only to scalar fields in scalar-field declaration order; missing arguments use defaults and excess arguments are errors.
- Array fields use their schema initializer and do not consume constructor arguments.
- Every instance has one generated scalar backing array and one independent generated array for each array field. No scalar backing array is emitted when a class has no scalar fields.
- Struct identifiers and array fields are not values. They cannot be reassigned, copied, compared, returned, or passed.
- Scalar fields and array elements are mutable even through a `const` instance.
- Array fields support indexing, `.length`, and array `for...in`; the ordinary array rules apply after struct lowering.
- Methods, constructors, static members, inheritance, `new`, dynamic field access, arrays of structs, nested structs, and nested arrays are prohibited.

## 9. Source expression grammar

Assignment is deliberately absent from this grammar.

```text
SourceExpression       ::= LogicalOrExpression

LogicalOrExpression    ::= LogicalAndExpression { "||" LogicalAndExpression }
LogicalAndExpression   ::= BitwiseOrExpression { "&&" BitwiseOrExpression }
BitwiseOrExpression    ::= BitwiseXorExpression { "|" BitwiseXorExpression }
BitwiseXorExpression   ::= BitwiseAndExpression { "^" BitwiseAndExpression }
BitwiseAndExpression   ::= EqualityExpression { "&" EqualityExpression }

EqualityExpression     ::= RelationalExpression
                           { ( "==" | "!=" | "===" | "!==" ) RelationalExpression }

RelationalExpression   ::= ShiftExpression
                           { ( "<" | "<=" | ">" | ">="
                             | "s<" | "s<=" | "s>" | "s>=" ) ShiftExpression }

ShiftExpression        ::= AdditiveExpression
                           { ( "<<" | ">>" | "s>>" ) AdditiveExpression }

AdditiveExpression     ::= MultiplicativeExpression { ( "+" | "-" ) MultiplicativeExpression }
MultiplicativeExpression ::= PowerExpression { ( "*" | "/" | "%" ) PowerExpression }
PowerExpression        ::= UnaryExpression { "**" UnaryExpression }
UnaryExpression        ::= { "!" | "~" | "-" } PrimaryExpression

PrimaryExpression      ::= IntegerLiteral
                         | "true" | "false" | "null" | "undefined"
                         | Identifier
                         | ArrayAccess
                         | ArrayLength
                         | StructScalarField
                         | StructArrayAccess
                         | StructArrayLength
                         | MathExpression
                         | HardwareReadExpression
                         | "(" SourceExpression ")"

HardwareReadExpression ::= "input" "(" ")"
                         | "keyboard" "(" ")"
                         | "time_0" "(" ")"
                         | "time_1" "(" ")"
                         | "counter" "(" ")"

MathExpression         ::= MathCall | MathConstant
MathCall               ::= "Math" "." MathBinaryName
                           "(" SourceExpression "," SourceExpression ")"
                         | "Math" "." "abs" "(" SourceExpression ")"
MathBinaryName         ::= "min" | "max" | "smin" | "smax"
MathConstant           ::= "Math" "." MathConstantName
MathConstantName       ::= "U16_MAX" | "S16_MAX"
                         | "U32_MAX" | "S32_MIN" | "S32_MAX"
```

Semantic rules:

- Operators at the same precedence associate from left to right, including constant-only `**`.
- Operands evaluate exactly once from left to right.
- `**` is accepted only when the entire power expression is precompiler-resolvable as a constant.
- Unary `+`, prefix update, ternary expressions, and assignments inside expressions are prohibited.
- `&&` and `||` have defined short-circuit behavior in control-flow conditions. Their behavior elsewhere remains undefined as specified by the language specification.
- Nested hardware reads are extracted into generated temporaries without changing evaluation or short-circuit order.

## 10. Constant-expression grammar

This subset is used for `Array(size)`, constant `**`, and other required precompiler evaluation.

```text
ConstantExpression       ::= ConstantBitwiseOr
ConstantBitwiseOr        ::= ConstantBitwiseXor { "|" ConstantBitwiseXor }
ConstantBitwiseXor       ::= ConstantBitwiseAnd { "^" ConstantBitwiseAnd }
ConstantBitwiseAnd       ::= ConstantShift { "&" ConstantShift }
ConstantShift            ::= ConstantAdditive { ( "<<" | ">>" | "s>>" ) ConstantAdditive }
ConstantAdditive         ::= ConstantMultiplicative { ( "+" | "-" ) ConstantMultiplicative }
ConstantMultiplicative   ::= ConstantPower { ( "*" | "/" | "%" ) ConstantPower }
ConstantPower            ::= ConstantUnary { "**" ConstantUnary }
ConstantUnary            ::= { "~" | "-" } ConstantPrimary

ConstantPrimary          ::= IntegerLiteral
                           | ResolvedConstIdentifier
                           | MathConstant
                           | ConstantMathCall
                           | "(" ConstantExpression ")"

ConstantMathCall         ::= "Math" "." MathBinaryName
                             "(" ConstantExpression "," ConstantExpression ")"
                           | "Math" "." "abs" "(" ConstantExpression ")"
```

Semantic rules:

- `ResolvedConstIdentifier` must refer to a previously declared `const` whose initializer is itself resolvable by this grammar.
- Hardware reads, array access, mutable variables, comparisons, logical operators, and assignments are not constant expressions.
- Division by zero evaluates to `0`; modulo `A` by zero evaluates to `A`.
- The precompiler performs no overflow correction or automatic intermediate truncation. Keeping calculations within the intended U32 range is the programmer's responsibility.
- A final array size must be an integer in the U32 range and greater than zero.

## 11. Canonical TuringScript grammar

Built-in precompilers must reduce source syntax to this subset before the lean compiler runs.

```text
CoreProgram             ::= { NEWLINE } [ CoreStatementList ] EOF
CoreStatementList       ::= CoreStatement { NEWLINE { NEWLINE } CoreStatement } { NEWLINE }

CoreStatement           ::= CoreSimpleStatement
                          | CoreIfStatement
                          | CoreWhileStatement

CoreSimpleStatement     ::= CoreScalarDeclaration
                          | CoreArrayDeclaration
                          | CoreAssignment
                          | CoreHardwareReadDeclaration
                          | CoreHardwareReadAssignment
                          | CoreHardwareWrite
                          | CoreGeneratedScreen8Store
                          | BreakStatement
                          | ContinueStatement

CoreScalarDeclaration   ::= "let" Identifier "=" CoreExpression
CoreArrayDeclaration    ::= "let" Identifier "=" "Array" "(" U32SizeLiteral ")"
CoreAssignment          ::= CoreAssignmentTarget "=" CoreExpression
CoreAssignmentTarget    ::= Identifier | Identifier "[" CoreExpression "]"

CoreHardwareReadDeclaration ::= "let" GeneratedOrUserIdentifier "=" HardwareReadExpression
CoreHardwareReadAssignment  ::= Identifier "=" HardwareReadExpression

CoreHardwareWrite       ::= "output" "(" CoreOperand ")"
                          | "screen" "(" CoreOperand "," CoreOperand ")"
CoreOperand             ::= Identifier | U16Literal

CoreGeneratedScreen8Store ::= "__ts_screen8_store" "(" CoreOperand "," CoreOperand ")"

CoreIfStatement         ::= "if" "(" CoreExpression ")" CoreBlock
                           [ { NEWLINE } "else" CoreBlock ]
CoreWhileStatement      ::= "while" "(" CoreExpression ")" CoreBlock
CoreBlock               ::= "{" { NEWLINE } [ CoreStatementList ] "}"

CoreExpression          ::= CoreLogicalOr
CoreLogicalOr           ::= CoreLogicalAnd { "||" CoreLogicalAnd }
CoreLogicalAnd          ::= CoreBitwiseOr { "&&" CoreBitwiseOr }
CoreBitwiseOr           ::= CoreBitwiseXor { "|" CoreBitwiseXor }
CoreBitwiseXor          ::= CoreBitwiseAnd { "^" CoreBitwiseAnd }
CoreBitwiseAnd          ::= CoreEquality { "&" CoreEquality }
CoreEquality            ::= CoreRelational { ( "==" | "!=" ) CoreRelational }
CoreRelational          ::= CoreShift
                            { ( "<" | "<=" | ">" | ">="
                              | "s<" | "s<=" | "s>" | "s>=" ) CoreShift }
CoreShift               ::= CoreAdditive { ( "<<" | ">>" | "s>>" ) CoreAdditive }
CoreAdditive            ::= CoreMultiplicative { ( "+" | "-" ) CoreMultiplicative }
CoreMultiplicative      ::= CoreUnary { ( "*" | "/" | "%" ) CoreUnary }
CoreUnary               ::= { "!" | "~" | "-" } CorePrimary
CorePrimary             ::= U16Literal
                          | Identifier
                          | Identifier "[" CoreExpression "]"
                          | "(" CoreExpression ")"

U16Literal              ::= IntegerLiteral
U32SizeLiteral          ::= IntegerLiteral
GeneratedOrUserIdentifier ::= Identifier
```

Canonical semantic restrictions:

- Every `U16Literal` must be in `0..65535`.
- `U32SizeLiteral` is already resolved, greater than zero, and used only as allocation metadata.
- Only `let` remains; `const` and `var` checks have already run.
- `true`, `false`, `null`, and `undefined` have become `0` or `1`.
- Array literals have become `Array(size)` plus indexed assignments.
- Static structs, struct construction, struct fields, `.length`, `Math`, constant `**`, `else if`, both forms of `for`, postfix updates, and compound assignments are absent.
- Source-level `Screen8` declarations and two-dimensional `screen[x][y]` assignments are absent. Initialization is three canonical `screen` calls; only the compiler-generated `__ts_screen8_buffer_<bytes>` operand and `__ts_screen8_store` operation may remain.
- Strict equality spellings have been collapsed: `===` is `==`, and `!==` is `!=`.
- Nested hardware reads and complex hardware-write arguments have become ordered temporary statements.
- User-authored identifiers never begin with `__ts_`; generated identifiers do.
- Comments remain attached to the first generated statement for their source statement.

### Compiler-owned Screen8 assembly forms

Canonical source may contain these private generated forms; they are never accepted from user source:

```text
screen(1, __ts_screen8_buffer_ByteCount)
__ts_screen8_store(OffsetOperand, ColorOperand)
```

The compiler emits real `screen`, address arithmetic, and `store_8` instructions, then appends:

```asm
framebuffer:
@0x2000
```

The final framebuffer must fit entirely below absolute byte address `0x2000`.

## 12. Program completion

The grammar does not require a terminal statement. The compiler appends neither a halt instruction nor a loop. Safe termination and any final infinite loop are the programmer's responsibility.

## 13. Deliberate exclusions and implementation-defined behavior

- Low-level labels, `goto`, inline assembly, raw Symphony instructions, and other escape hatches are prohibited.
- Repeated `Array(size)` clearing behavior is implementation-defined and must not be relied upon.
- Repeated struct-instance initialization inherits the implementation-defined behavior of its generated backing arrays.
