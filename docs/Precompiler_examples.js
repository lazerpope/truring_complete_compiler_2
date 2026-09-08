# TuringScript precompiler review corpus
# Each section maps one-to-one to the ordered stages in docs/precompiler-spec.md.
# Only accepted source is included; deliberately failing validation cases belong in tests.

let left = 1
let right = 2
let runtimeValue = 3
let value = 4
let counterValue = 0
let firstCondition = 0
let secondCondition = 1
let updatedValues = Array(4)

// normalizeLineEndings ------------------------------------------------------
# Run these lines once with CRLF and once with CR-only endings.
let firstLine = 1
let secondLine = firstLine + 1

// removeWhitespaces ---------------------------------------------------------
let     spacedValue     =     1    +    2
let commentedValue = 3 // this comment keeps   all of its whitespace

// validateSemicolons --------------------------------------------------------
for (let semicolonIndex = 0; semicolonIndex < 3; semicolonIndex++) {
  output(semicolonIndex)
}

// validateIdentifiers -------------------------------------------------------
let valid_name$1 = 1

// validateStaticStructs -----------------------------------------------------
class ValidStruct {
  scalar = 1
  values = Array(2)
}
let validStruct = ValidStruct(5)
validStruct.scalar++
validStruct.values[0] = validStruct.scalar

// lowerStaticStructs --------------------------------------------------------
class LoweredStruct {
  first = 10
  items = [1, runtimeValue]
  second = 20
}
let loweredStruct = LoweredStruct(30)
loweredStruct.second += loweredStruct.first
for (let structIndex in loweredStruct.items) {
  output(loweredStruct.items[structIndex])
}

// validateUnsupportedSyntax -------------------------------------------------
# Unsupported syntax is intentionally absent from this successful corpus.
let supportedSyntax = valid_name$1 + 1

// collapseEquality ----------------------------------------------------------
let strictEqual = left === right
let strictNotEqual = left !== right // !== inside this comment stays unchanged

// lowerBooleanLiterals ------------------------------------------------------
let enabled = 1 + true
let disabled = false

// lowerNullishLiterals ------------------------------------------------------
let nullValue = null
let undefinedValue = undefined

// validateConstAssignments -------------------------------------------------
const fixedValue = 10
let copiedFixedValue = fixedValue

// lowerMathConstants --------------------------------------------------------
let maximumU16 = Math.U16_MAX
let maximumS16 = Math.S16_MAX
let maximumU32 = Math.U32_MAX
let minimumS32 = Math.S32_MIN
let maximumS32 = Math.S32_MAX

// foldConstantExpressions --------------------------------------------------
let foldedBooleans = true + true
const foldedBase = 1
let foldedConstUse = foldedBase + 3
let partiallyFolded = runtimeValue + 4 * 2
const foldedSize = (5 * 2) + (2 ** 3)
let foldedValues = Array(foldedSize)

// validateScreen8 ----------------------------------------------------------
const screenResolution = 19
let screen = Screen8(screenResolution)
screen[10][10] = 0b00011100

// lowerScreen8 -------------------------------------------------------------
let runtimePixelX = keyboard()
let runtimePixelY = input()
screen[runtimePixelX][runtimePixelY] = counter()
screen.present(0)

// validateArrayRules --------------------------------------------------------
let validArray = Array(10)
validArray[0] = copiedFixedValue

// lowerArrayLiterals --------------------------------------------------------
let literalValues = [1, runtimeValue + 1, , keyboard(),]

// replaceArrayLengths -------------------------------------------------------
let lengthValues = Array(12)
let knownLength = lengthValues.length
let lengthExpression = lengthValues.length + 1

// validateConstantArrayBounds ----------------------------------------------
let boundedValues = Array(3)
let validElement = boundedValues[2]

// lowerArrayForLoops --------------------------------------------------------
let iteratedValues = Array(4)
for (let arrayIndex in iteratedValues) {
  if (iteratedValues[arrayIndex] == 0) {
    continue
  }
  output(arrayIndex)
}

for (arrayIndex in iteratedValues) {
  output(iteratedValues[arrayIndex])
}

// lowerCStyleForLoops -------------------------------------------------------
for (let cStyleIndex = 0; cStyleIndex < 10; cStyleIndex++) {
  if (cStyleIndex == 5) {
    continue
  }
  output(cStyleIndex)
}

// lowerElseIf ---------------------------------------------------------------
if (firstCondition) {
  output(1)
} else if (secondCondition) {
  output(2)
} else {
  output(0)
}

// lowerPostfixUpdates -------------------------------------------------------
counterValue++
counterValue--
updatedValues[keyboard()]++

// lowerCompoundAssignments -------------------------------------------------
value += 1
value -= 2
value *= 3
value /= 4
value %= 5
updatedValues[keyboard()] += value

// lowerMathCalls ------------------------------------------------------------
// 1
let unsignedMinimum = Math.min(left, right)
// 2
let unsignedMaximum = Math.max(left, right)
// 3
let signedMinimum = Math.smin(left, right)
// 4
let signedMaximum = Math.smax(left, right)
// 5
let magnitude = Math.abs(value)

// lowerNestedHardwareReads -------------------------------------------------
let nestedRead = keyboard() + input() + counter()
if (keyboard() != 0 && input() != 0) {
  screen(keyboard(), input())
}

// lowerLargeConstants -------------------------------------------------------
let largestImmediate = 65535
let constructedU32 = 0x12345678
let maximumWord = 0xffffffff

// lowerConstDeclarations ----------------------------------------------------
const convertedConstant = 25

// lowerVarDeclarations ------------------------------------------------------
var convertedVariable = 50

// validateCanonicalSource --------------------------------------------------
let canonicalValue = 1
canonicalValue = canonicalValue + 1
if (canonicalValue == 2) {
  output(canonicalValue)
}

// formatCanonicalSource -----------------------------------------------------
if (canonicalValue) {
let unindentedValue=canonicalValue+1
screen(0,unindentedValue)
}
