# TuringScript precompiler review corpus
# Each numbered section is independent and maps one-to-one to the ordered stages
# in docs/precompiler-spec.md. The complete file is not intended to compile.

// normalizeLineEndings ------------------------------------------------------
# Run these lines once with CRLF and once with CR-only endings.
let firstLine = 1
let secondLine = firstLine + 1

// removeWhitespaces ---------------------------------------------------------
let     spacedValue     =     1    +    2
let commentedValue = 3 // this comment keeps   all of its whitespace

// validateSemicolons --------------------------------------------------------
let invalidTerminator = 1;
for (let validSeparator = 0; validSeparator < 3; validSeparator++) {
  output(validSeparator)
}

// validateIdentifiers -------------------------------------------------------
let valid_name$1 = 1
let __ts_invalidReservedPrefix = 2
let while = 3

// validateUnsupportedSyntax -------------------------------------------------
let invalidObject = { value: 1 }
goto invalidLabel

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
fixedValue = 11

// foldConstantExpressions --------------------------------------------------
const foldedSize = (5 * 2) + (2 ** 3)
let foldedValues = Array(foldedSize)

// lowerMathConstants --------------------------------------------------------
let maximumU16 = Math.U16_MAX
let maximumS16 = Math.S16_MAX
let maximumU32 = Math.U32_MAX
let minimumS32 = Math.S32_MIN
let maximumS32 = Math.S32_MAX

// lowerMathCalls ------------------------------------------------------------
let unsignedMinimum = Math.min(left, right)
let unsignedMaximum = Math.max(left, right)
let signedMinimum = Math.smin(left, right)
let signedMaximum = Math.smax(left, right)
let magnitude = Math.abs(value)

// validateArrayRules --------------------------------------------------------
let validArray = Array(10)
let invalidZeroArray = Array(0)
let invalidRuntimeArray = Array(keyboard())
validArray = Array(20)

// lowerArrayLiterals --------------------------------------------------------
let literalValues = [1, runtimeValue + 1, , keyboard(),]

// replaceArrayLengths -------------------------------------------------------
let lengthValues = Array(12)
let knownLength = lengthValues.length
let lengthExpression = lengthValues.length + 1

// validateConstantArrayBounds ----------------------------------------------
let boundedValues = Array(3)
let validElement = boundedValues[2]
let invalidElement = boundedValues[3]
boundedValues[99] = 1

// lowerArrayForLoops --------------------------------------------------------
let iteratedValues = Array(4)
for (let index in iteratedValues) {
  if (iteratedValues[index] == 0) {
    continue
  }
  output(index)
}

// lowerCStyleForLoops -------------------------------------------------------
for (let index = 0; index < 10; index++) {
  if (index == 5) {
    continue
  }
  output(index)
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
