/**
 * Arduino-to-Xylo-Script Transpiler
 *
 * Supported Arduino constructs:
 * | Arduino construct               | Script output              |
 * |---------------------------------|----------------------------|
 * | moveForward(speed)              | forward(mapped_speed)      |
 * | moveBackward(speed)             | backward(mapped_speed)     |
 * | turnLeft(speed)                 | left(mapped_speed)         |
 * | turnRight(speed)                | right(mapped_speed)        |
 * | stopRobot()                     | stop()                     |
 * | setMotorSpeed(motor, speed)     | setMotors(l, r)            |
 * | delay(ms)                       | wait(ms)                   |
 * | while(true) / for(;;) body      | loop { ... }               |
 * | if(condition) { ... }           | if sensor_condition { ... }|
 * | readDistance() / isObstacle()   | sensor condition in if     |
 * | Everything else                 | skipped; added to unsupported[] |
 */

import { RobotPinConfig, DEFAULT_PIN_CONFIG } from "@/lib/robot-config/pin-config"

export interface TranspileResult {
  script: string         // Xylo script commands
  unsupported: string[]  // List of unsupported constructs found
  error?: string         // Fatal parse error if any
}

/** Map Arduino 0-255 speed to Xylo 0-100 speed */
function mapSpeed(speed: number): number {
  return Math.round((Math.min(255, Math.max(0, speed)) / 255) * 100)
}

/** Strip block and line comments from Arduino source */
function stripComments(code: string): string {
  // Remove block comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, " ")
  // Remove line comments
  code = code.replace(/\/\/[^\n]*/g, "")
  return code
}

/** Extract the body of void loop() {} */
function extractLoopBody(code: string): string | null {
  const loopMatch = code.match(/void\s+loop\s*\(\s*\)/)
  if (!loopMatch || loopMatch.index === undefined) return null

  const start = code.indexOf("{", loopMatch.index)
  if (start === -1) return null

  let depth = 0
  let i = start
  while (i < code.length) {
    if (code[i] === "{") depth++
    else if (code[i] === "}") {
      depth--
      if (depth === 0) {
        return code.slice(start + 1, i).trim()
      }
    }
    i++
  }
  return null
}

/**
 * Split code body into top-level statements, respecting braces.
 * Returns array of trimmed statement strings (with their braces if block).
 */
function splitStatements(body: string): string[] {
  const statements: string[] = []
  let current = ""
  let depth = 0

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]

    if (ch === "{") {
      depth++
      current += ch
    } else if (ch === "}") {
      depth--
      current += ch
      if (depth === 0) {
        const trimmed = current.trim()
        if (trimmed) statements.push(trimmed)
        current = ""
      }
    } else if (ch === ";" && depth === 0) {
      const trimmed = current.trim()
      if (trimmed) statements.push(trimmed)
      current = ""
    } else {
      current += ch
    }
  }

  const trimmed = current.trim()
  if (trimmed) statements.push(trimmed)

  return statements
}

/** Check if a condition string represents an obstacle/distance sensor */
function translateCondition(condition: string): string {
  const trimmed = condition.trim()

  // isObstacle() or isObstacle(distance)
  if (/isObstacle\s*\(/.test(trimmed)) {
    const distMatch = trimmed.match(/isObstacle\s*\(\s*(\d+)\s*\)/)
    const dist = distMatch ? distMatch[1] : "20"
    return `distance < ${dist}`
  }

  // readDistance() < N
  const distCmpMatch = trimmed.match(/readDistance\s*\(\s*\)\s*([<>]=?)\s*(\d+)/)
  if (distCmpMatch) {
    return `distance ${distCmpMatch[1]} ${distCmpMatch[2]}`
  }

  return "obstacle"
}

/** Transpile a single statement (no outer braces) */
function transpileStatement(
  stmt: string,
  indent: string,
  unsupported: string[]
): string {
  const s = stmt.trim()

  // moveForward(speed)
  const fwdMatch = s.match(/^moveForward\s*\(\s*(\d+)\s*\)\s*;?$/)
  if (fwdMatch) return `${indent}forward(${mapSpeed(parseInt(fwdMatch[1]))})\n`

  // moveBackward(speed)
  const bwdMatch = s.match(/^moveBackward\s*\(\s*(\d+)\s*\)\s*;?$/)
  if (bwdMatch) return `${indent}backward(${mapSpeed(parseInt(bwdMatch[1]))})\n`

  // turnLeft(speed)
  const leftMatch = s.match(/^turnLeft\s*\(\s*(\d+)\s*\)\s*;?$/)
  if (leftMatch) return `${indent}left(${mapSpeed(parseInt(leftMatch[1]))})\n`

  // turnRight(speed)
  const rightMatch = s.match(/^turnRight\s*\(\s*(\d+)\s*\)\s*;?$/)
  if (rightMatch) return `${indent}right(${mapSpeed(parseInt(rightMatch[1]))})\n`

  // stopRobot()
  if (/^stopRobot\s*\(\s*\)\s*;?$/.test(s)) return `${indent}stop()\n`

  // stop() — in case AI generates it directly
  if (/^stop\s*\(\s*\)\s*;?$/.test(s)) return `${indent}stop()\n`

  // delay(ms)
  const delayMatch = s.match(/^delay\s*\(\s*(\d+)\s*\)\s*;?$/)
  if (delayMatch) return `${indent}wait(${delayMatch[1]})\n`

  // setMotorSpeed(MOTOR_LEFT/RIGHT, speed) — simplified: treat as both motors
  const motorSpeedMatch = s.match(/^setMotorSpeed\s*\(\s*\w+\s*,\s*(\d+)\s*\)\s*;?$/)
  if (motorSpeedMatch) {
    const speed = mapSpeed(parseInt(motorSpeedMatch[1]))
    return `${indent}setMotors(${speed}, ${speed})\n`
  }

  // if (condition) { ... }
  const ifMatch = s.match(/^if\s*\(([^)]+)\)\s*\{([\s\S]*)\}/)
  if (ifMatch) {
    const condition = translateCondition(ifMatch[1])
    const body = ifMatch[2].trim()
    const innerStatements = splitStatements(body)
    const innerLines = innerStatements
      .map((inner) => transpileStatement(inner, indent + "  ", unsupported))
      .join("")
    return `${indent}if ${condition} {\n${innerLines}${indent}}\n`
  }

  // while(true) or for(;;) — infinite loop body
  const whileTrueMatch = s.match(/^while\s*\(\s*(?:true|1)\s*\)\s*\{([\s\S]*)\}/)
  const forEverMatch = s.match(/^for\s*\(\s*;;\s*\)\s*\{([\s\S]*)\}/)
  const loopBody = whileTrueMatch?.[1] ?? forEverMatch?.[1]
  if (loopBody !== undefined) {
    const innerStatements = splitStatements(loopBody.trim())
    const innerLines = innerStatements
      .map((inner) => transpileStatement(inner, indent + "  ", unsupported))
      .join("")
    return `${indent}loop {\n${innerLines}${indent}}\n`
  }

  // Skip setup/loop declarations and braces-only
  if (/^void\s+(setup|loop)\s*\(/.test(s)) return ""
  if (s === "{" || s === "}") return ""

  // Skip empty
  if (!s || s === ";") return ""

  // Everything else is unsupported
  unsupported.push(s.replace(/\s+/g, " ").substring(0, 80))
  return ""
}

export function transpileArduino(
  code: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: RobotPinConfig = DEFAULT_PIN_CONFIG
): TranspileResult {
  const unsupported: string[] = []

  try {
    const stripped = stripComments(code)
    const loopBody = extractLoopBody(stripped)

    if (loopBody === null) {
      // No void loop() found — try to transpile whole thing as flat script
      const statements = splitStatements(stripped.trim())
      const lines = statements
        .map((s) => transpileStatement(s, "", unsupported))
        .join("")
      return { script: lines.trim(), unsupported }
    }

    const statements = splitStatements(loopBody)
    const lines = statements
      .map((s) => transpileStatement(s, "  ", unsupported))
      .join("")

    const script = `loop {\n${lines}}`

    return { script, unsupported }
  } catch (err) {
    return {
      script: "",
      unsupported: [],
      error: err instanceof Error ? err.message : "Unknown transpile error",
    }
  }
}

/** Returns true if code looks like Arduino C++ (has void setup or void loop) */
export function isArduinoCode(code: string): boolean {
  return /void\s+(setup|loop)\s*\(/.test(code)
}
