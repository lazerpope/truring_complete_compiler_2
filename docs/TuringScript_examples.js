# TuringScript syntax review corpus
# Each section and snippet is independent.
# The whole file is not intended to compile as one program.
# Names are intentionally reused so every form is easy to compare.

# ============================================================================
# VALID: identifiers and declarations
# ============================================================================

let a = 1
let b = a + 6
let camelCase = 2
let snake_case = 3
let _leadingUnderscore = 4
let $dollarName = 5
let name123 = 6
let lowercase = 7
let Lowercase = 8

let decimal = 42
let zero = 0
let hexadecimalLower = 0xff
let hexadecimalUpper = 0XFF
let binaryLower = 0b0101
let binaryUpper = 0B0101
let largestU16 = 65535
let largerThanU16 = 65536
let largestU32 = 0xffffffff
let negativeOne = -1
let negativeValue = -55

let enabled = true       // will become 1
let disabled = false    // will become 0
let emptyValue = null   // will become 0
let missingValue = undefined  // will become 0

const constantValue = 10 // assignment checked only ad compiletime and also converted to let
var convertedToLet = 20

# ============================================================================
# VALID: ordinary assignments
# ============================================================================

let value = 1
value = 2
value = otherValue
value = otherValue + 1
value = (otherValue + 1) * 2

value += 1
value -= 1
value *= 2
value /= 2
value %= 3

value++
value--

# ============================================================================
# VALID: arithmetic operand permutations
# ============================================================================

let literalLiteralAdd = 1 + 2
let variableLiteralAdd = a + 2
let literalVariableAdd = 1 + b
let variableVariableAdd = a + b

let add = a + b
let subtract = a - b
let multiply = a * b
let divide = a / b
let modulo = a % b

let divideByZero = a / 0 // yields 0
let moduloByZero = a % 0 // yields a

let result = value++
let result = value--

let groupedFirst = (a + b) * c
let groupedSecond = a + (b * c)
let groupedThird = (a + b) * (c - d)
let deeplyGrouped = (((a + b) * c) - d) / e

let leftAssociativeAdd = a + b + c + d
let leftAssociativeSubtract = a - b - c - d
let leftAssociativeMultiply = a * b * c
let leftAssociativeMixed = a + b * c - d / e

# ============================================================================
# VALID: unary operations
# ============================================================================

let negativeLiteral = -5
let negativeVariable = -value
let doubleNegative = -(-value)
let bitwiseNot = ~value
let doubleBitwiseNot = ~(~value)
let logicalNot = !value
let doubleLogicalNot = !!value
let mixedUnary = !~(-value)

# ============================================================================
# VALID: bitwise operations
# ============================================================================

let bitwiseAnd = a & b
let bitwiseXor = a ^ b
let bitwiseOr = a | b

let bitwiseLiteralLiteral = 0b1100 & 0b1010
let bitwiseVariableLiteral = flagsValue & 0xff
let bitwiseLiteralVariable = 0xff & flagsValue
let bitwiseVariableVariable = firstMask & secondMask

let bitwisePrecedence = a | b ^ c & d
let bitwiseGrouped = (a | b) ^ (c & d)

# ============================================================================
# VALID: shifts
# ============================================================================

let shiftLeft = value << amount
let shiftRightUnsigned = value >> amount
let shiftRightSigned = value s>> amount

let shiftLiteral = 1 << 5
let shiftByZero = value >> 0
let shiftByThirtyOne = value >> 31
let shiftByThirtyTwo = value >> 32
let shiftByFiftyFive = value >> 55
let signedShiftNegativePattern = 0x80000000 s>> 1
let groupedShift = (a + b) << (c - d)

# ============================================================================
# VALID: equality and comparison values
# ============================================================================

let looseEqual = a == b
let strictEqual = a === b  // converts to == 
let looseNotEqual = a != b 
let strictNotEqual = a !== b  // converts to != 

let unsignedLess = a < b
let unsignedLessEqual = a <= b
let unsignedGreater = a > b
let unsignedGreaterEqual = a >= b

let signedLess = a s< b
let signedLessEqual = a s<= b
let signedGreater = a s> b
let signedGreaterEqual = a s>= b

let literalComparison = 5 > 2
let variableLiteralComparison = speed > 5
let literalVariableComparison = 5 > speed
let variableVariableComparison = speed > minimumSpeed
let calculatedComparison = a + b > c * d
let groupedComparison = (a + b) > (c * d)

# ============================================================================
# VALID: condition expressions
# ============================================================================

if (value) {
  output(value)
}

if (!value) {
  output(0)
}

if (a > b) {
  output(a)
}

if (a > b && hp > 0) {
  output(hp)
}

if (a > b || hp > 0) {
  output(hp)
}

if (a > b && hp > 0 || isGolden == true) {
  output(1)
}

if ((a > b && hp > 0) || isGolden == true) {
  output(1)
}

if (a > b && (hp > 0 || isGolden == true)) {
  output(1)
}

if ((a > b || c > d) && (e == f || g != h)) {
  output(1)
}

# Boolean values outside conditions are syntactically accepted but undefined.
let undefinedLogicalAndResult = a && b
let undefinedLogicalOrResult = a || b

# ============================================================================
# VALID: if, else, and else if
# ============================================================================

if (condition) {
  output(1)
}

if (condition) {
  output(1)
} else {
  output(0)
}

if (firstCondition) {
  output(1)
} else if (secondCondition) {
  output(2)
} else if (thirdCondition) {
  output(3)
} else {
  output(0)
}

if (outerCondition) {
  if (innerCondition) {
    output(1)
  } else {
    output(2)
  }
}

# ============================================================================
# VALID: while, break, and continue
# ============================================================================

while (condition) {
  value = value + 1
}

while (value < 100) {
  value++
  if (value == 50) {
    break
  }
}

while (value < 100) {
  value++
  if (value % 2 == 0) {
    continue
  }
  output(value)
}

while (outerCondition) {
  while (innerCondition) {
    break
  }
  continue
}

# ============================================================================
# VALID: C-style for loops
# ============================================================================

for (let i = 0; i < 10; i++) {
  output(i)
}

let i = 0
for (i = 0; i < 10; i++) {
  output(i)
}

for (let i = 10; i > 0; i--) {
  output(i)
}

for (let i = 0; i < 10; i += 2) {
  output(i)
}

for (let i = 100; i > 0; i -= 5) {
  output(i)
}

for (let i = 1; i < 100; i *= 2) {
  output(i)
}

for (let i = 100; i > 1; i /= 2) {
  output(i)
}

for (let i = 0; i < 100; i = i + step) {
  if (i == skipIndex) {
    continue
  }
  if (i == stopIndex) {
    break
  }
  output(i)
}

# ============================================================================
# VALID: static array creation
# ============================================================================

let values = Array(1)
let values = Array(10)
let values = Array(5 * 2)
let values = Array((5 + 5) * 2)


const arraySize = 10
let values = Array(arraySize)

const width = 5
const height = 2
let values = Array(width * height)

let first = values[0]
let second = values[1]
let runtimeIndex = values[index]
let expressionIndex = values[index + 1]
let groupedIndex = values[(index + offset) * 2]
let hardwareIndex = values[keyboard()]

values[0] = 10
values[index] = 20
values[index + 1] = a + b
values[(index + offset) * 2] = keyboard() + 1

values[index] += 1
values[index] -= 1
values[index] *= 2
values[index] /= 2
values[index] %= 3
values[index]++
values[index]--

let knownLength = values.length
let calculatedFromLength = values.length + 1

const constantValues = Array(10)
constantValues[0] = 99
constantValues[index]++

# ============================================================================
# VALID: array literals
# ============================================================================

let values = [1]
let values = [1, 2, 3]
let values = [1, 2, 3,] // is [1,2,3]
let values = [1, , 3] // is [1,0,3]
let values = [,] // is [0,0]
let values = [,,] // is [0,0,0]
let values = [a, b, c]
let values = [a + 1, b * 2, c >> 1]
let values = [keyboard(), input(), counter()]
let values = [Math.min(a, b), Math.max(c, d)]

const constantValues = [1, 2, 3]
constantValues[1] = 99

# Array declarations inside control flow use statically reserved storage.
while (condition) {
  let temporaryValues = Array(10)
  temporaryValues[index]++
}

while (condition) {
  let initializedValues = [10, 20, 30]
  initializedValues[0]++
}

# ============================================================================
# VALID: array index iteration
# ============================================================================

for (let index in values) {
  output(index)
}

let reusedIndex = 0
for (reusedIndex in values) {
  output(values[reusedIndex])
}

for (let index in values) {
  output(values[index])
}

for (let index in values) {
  values[index]++
}

for (let index in values) {
  if (values[index] == 0) {
    continue
  }
  if (values[index] == stopValue) {
    break
  }
  output(values[index])
}

# ============================================================================
# VALID: Math precompiler namespace
# ============================================================================

let unsignedMinimum = Math.min(a, b)
let unsignedMaximum = Math.max(a, b)
let signedMinimum = Math.smin(a, b)
let signedMaximum = Math.smax(a, b)
let absoluteValue = Math.abs(value)


let maximumU32 = Math.U32_MAX
let maximumS32 = Math.S32_MAX


let maximumU16 = Math.U16_MAX
let maximumS16 = Math.S16_MAX

let mathLiteralLiteral = Math.min(1, 2)
let mathVariableLiteral = Math.max(value, 10)
let mathLiteralVariable = Math.min(10, value)
let mathVariableVariable = Math.max(first, second)
let mathExpressionArguments = Math.min(a + b, c * d)
let nestedMath = Math.max(Math.min(a, b), Math.min(c, d))
let mathWithHardware = Math.max(keyboard(), input())
let minimumAbsolute = Math.min(Math.abs(a), Math.abs(b))
let signedLimitChoice = Math.smax(Math.S32_MIN, value)
const constantSize = 10
let minimumArraySize = Array(Math.max(1, constantSize))

# ============================================================================
# VALID: hardware reads
# ============================================================================

let generalInput = input()
let keyboardValue = keyboard()
let timeLow = time_0()
let timeHigh = time_1()
let instructionCounter = counter()

generalInput = input()
keyboardValue = keyboard()
timeLow = time_0()
timeHigh = time_1()
instructionCounter = counter()

let incrementedInput = input() + 1
let incrementedKeyboard = keyboard() + 1
let elapsed = time_1() - time_0()
let instructionsPlusOffset = counter() + offset
let combinedHardware = input() + keyboard() + counter()

if (input() != 0) {
  output(1)
}

if (keyboard() != 0) {
  output(1)
}

if (enabled && keyboard() != 0) {
  output(1)
}

if (keyboard() != 0 || input() != 0) {
  output(1)
}

# ============================================================================
# VALID: hardware writes
# ============================================================================

output(0)
output(42)
output(value)
output(a + b)
output(keyboard())
output(input() + 1)
output(Math.max(a, b))
output(values[index])

screen(setting, value)
screen(setting, 255)
screen(setting + 1, value)
screen(setting, keyboard())
screen(keyboard(), input())
screen(Math.min(firstSetting, secondSetting), values[index])

# ============================================================================
# IMPLEMENTED: Pixel 8 framebuffer macro
# ============================================================================

let screen = Screen8(19) // 80 x 60, write-only Pixel 8 framebuffer
let GREEN_COLOR = 0b00011100
screen[10][10] = GREEN_COLOR // x = 10, y = 10, framebuffer byte 810

let pixelX = keyboard()
let pixelY = input()
let pixelColor = counter()
screen[pixelX][pixelY] = pixelColor

# Prohibited Screen8 forms:
let secondScreen = Screen8(19)
let pixel = screen[10][10]
screen[10] = GREEN_COLOR
screen[10][10] += 1
screen[10][10]++

# ============================================================================
# VALID: comments and whitespace
# ============================================================================

// normal comment
//  comment text keeps   all of its spaces
# hash comment
#  hash comment keeps   all of its spaces

let value = 1 // inline slash comment
let value = 1#inline hash comment without preceding whitespace
let value = 1 # inline hash comment after whitespace

/* block comment */
/* block comment
   containing whitespace
   and multiple lines */

let compact=1
let     spaced     =     compact     +     2



# Blank lines above remain blank lines during whitespace preprocessing.

# ============================================================================
# VALID BUT PROGRAMMER-RESPONSIBILITY CASES
# ============================================================================

# Runtime out-of-bounds indexing has no check.
let value = values[runtimeIndex]

# Shift counts wrap modulo 32.
let wrappedShift = value >> 55

# Constant-fold overflow is not corrected or diagnosed.
const programmerManagedConstant = 0xffffffff + 1

# Repeated Array(size) clearing behavior is implementation-defined.
# Meaning you are on your own.
while (condition) {
  let reusedStorage = Array(10)
  reusedStorage[0]++
}

# Program completion is the programmer's responsibility.
while (true) {
  output(0)
}

# ============================================================================
# INVALID: declaration and assignment forms
# ============================================================================

let missingInitializer
const missingInitializer
var missingInitializer

let a = 1, b = 2
const a = 1, b = 2

let duplicate = 1
let duplicate = 2

let result = (value = 10)
if ((value = 10) > 0) {
  output(value)
}

a = b = 1

++value
--value


value &= mask
value |= mask
value ^= mask
value <<= amount
value >>= amount
value s>>= amount
value >>>= amount
value **= exponent
value &&= condition
value ||= condition
value ??= fallback

# ============================================================================
# INVALID: numeric and expression forms
# ============================================================================

let unaryPlus = +value
let floatValue = 1.5
let numericSeparator = 1_000
let octalValue = 0o777
let legacyOctalValue = 0777
let exponentialValue = 1e3
let bigintValue = 10n
let tooLarge = 0x100000000
let nanValue = NaN
let infinityValue = Infinity


let runtimeExponent = value ** 2
let runtimeExponent = 2 ** value
let ternaryValue = condition ? first : second
let commaValue = (a, b)
let unsignedJavaScriptShift = value >>> amount

let stringValue = "text"
let stringValue = 'text'
let templateValue = `text`
let regularExpression = /text/

let multilineExpression = a +
  b

# ============================================================================
# INVALID: array forms
# ============================================================================

let emptyArray = []
let zeroArray = Array(0)
let runtimeSizedArray = Array(keyboard())
let runtimeSizedArray = Array(runtimeSize)
let negativeSizedArray = Array(-1)

let nestedArray = [[1, 2], [3, 4]]
let nestedArray = Array(Array(10))

let first = Array(10)
let second = first
first = second
first = Array(20)

let comparedArrays = first == second
let comparedArray = first == 0
output(first)
screen(setting, first)

let knownOutOfBounds = values[999]
values[999] = 1

values.length = 20
values.otherProperty
values.push(1)
values.pop()
values.map(callback)

# ============================================================================
# INVALID: control-flow forms
# ============================================================================

if (condition)
  output(1)

while (condition)
  output(1)

for (let i = 0; i < 10; i++)
  output(i)

for (;;) {
  output(1)
}

for (; i < 10; i++) {
  output(i)
}

for (let i = 0; ; i++) {
  output(i)
}

for (let i = 0; i < 10;) {
  output(i)
}

for (let i = 0, i < 10, i++) {
  output(i)
}

for (let values = Array(10); condition; values[0]++) {
  output(values[0])
}

for (const index in values) {
  output(index)
}

for (let value of values) {
  output(value)
}

do {
  output(1)
} while (condition)

switch (value) {
  case 1:
    output(1)
}

break
continue

{
  value = 10
}

# ============================================================================
# INVALID: semicolons and same-line statements
# ============================================================================

let value = 1;
value = 2;
let a = 1; let b = 2

# Semicolons are valid only as these two for-header separators.
for (let i = 0; i < 10; i++) {
  output(i)
}

# ============================================================================
# INVALID: objects and unsupported JavaScript features
# ============================================================================

let objectValue = { x: 1 }
let createdValue = new Thing()
let { x } = objectValue
let [first, second] = values
let spreadValue = [...values]
let optionalValue = value?.field
let fallbackValue = value ?? otherValue

let valueType = typeof value
delete value
void value
let instanceCheck = value instanceof Thing
let membershipCheck = value in values

let thisValue = this
let parentValue = super
let argumentsValue = arguments

with (value) {
  output(1)
}

debugger
await value
yield value

# ============================================================================
# INVALID: property access and Math members
# ============================================================================

let field = value.field
let field = value["field"]
let pi = Math.PI
let rounded = Math.round(value)
let random = Math.random()
let wrongMin = Math.min(a)
let wrongMax = Math.max(a, b, c)
let wrongAbs = Math.abs(a, b)
let wrongCase = math.min(a, b)

# ============================================================================
# INVALID: raw memory, assembly, labels, and goto
# ============================================================================

let value = pload(100)
pstore(100, value)
load_32 value, [100]
store_32 [100], value
mov r1, 10
add r1, r1, 1

start:
goto start
jmp start

asm {
  mov r1, 10
}

# ============================================================================
# INVALID: reserved and generated identifiers
# ============================================================================

let __ts_temporary = 1
let if = 1
let while = 1
let for = 1
let let = 1
let const = 1
let Array = 1
let Math = 1
let input = 1
let output = 1
let keyboard = 1
let screen = 1
let time_0 = 1
let time_1 = 1
let counter = 1
let true = 1
let false = 1
let null = 1
let undefined = 1

# ============================================================================
# IMPLEMENTED: static structs
# ============================================================================

class Player {
  health = 100
  inventory = Array(8)
  position = [0, 0]
  score = 0
}

let player = Player(75, 500)
const defaultPlayer = Player()

player.health = 80
player.health++
player.score += 10
player.inventory[2] = 50
player.inventory[index]++
player.position[0] = player.position[1] + 1
let inventorySize = player.inventory.length

for (let itemIndex in player.inventory) {
  output(player.inventory[itemIndex])
}

# Prohibited struct forms:
player = defaultPlayer
let playerAlias = player
let samePlayer = player == defaultPlayer
player.inventory = otherInventory
let standaloneInventory = player.inventory
let dynamicField = player[field]

class Empty {
}

class InvalidMethods {
  value = 0
  update() {
    value++
  }
}

# Functions remain paused; their ABI and final grammar are intentionally absent.
