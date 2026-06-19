import * as Blockly from "blockly"

// Python code generator for Blockly blocks
// This generates Python equivalent of the Arduino/C++ code

const pythonGenerator: Record<string, (block: Blockly.Block) => string> = {}

// Movement blocks
pythonGenerator["move_forward"] = function (block: Blockly.Block): string {
  const speed = block.getFieldValue("SPEED") || 50
  return `robot.move_forward(${speed})\n`
}

pythonGenerator["move_backward"] = function (block: Blockly.Block): string {
  const speed = block.getFieldValue("SPEED") || 50
  return `robot.move_backward(${speed})\n`
}

pythonGenerator["turn_left"] = function (block: Blockly.Block): string {
  const degrees = block.getFieldValue("DEGREES") || 90
  return `robot.turn_left(${degrees})\n`
}

pythonGenerator["turn_right"] = function (block: Blockly.Block): string {
  const degrees = block.getFieldValue("DEGREES") || 90
  return `robot.turn_right(${degrees})\n`
}

pythonGenerator["stop"] = function (): string {
  return `robot.stop()\n`
}

pythonGenerator["set_motors"] = function (block: Blockly.Block): string {
  const left = block.getFieldValue("LEFT") || 0
  const right = block.getFieldValue("RIGHT") || 0
  return `robot.set_motors(${left}, ${right})\n`
}

// Sensor blocks
pythonGenerator["read_distance"] = function (): string {
  return `robot.get_distance()`
}

pythonGenerator["read_line_sensor"] = function (block: Blockly.Block): string {
  const sensor = block.getFieldValue("SENSOR") || "CENTER"
  return `robot.get_line_sensor("${sensor.toLowerCase()}")`
}

pythonGenerator["read_color"] = function (): string {
  return `robot.get_color()`
}

pythonGenerator["is_obstacle_detected"] = function (block: Blockly.Block): string {
  const threshold = block.getFieldValue("THRESHOLD") || 20
  return `robot.get_distance() < ${threshold}`
}

// Control blocks
pythonGenerator["wait_seconds"] = function (block: Blockly.Block): string {
  const seconds = block.getFieldValue("SECONDS") || 1
  return `time.sleep(${seconds})\n`
}

pythonGenerator["wait_milliseconds"] = function (block: Blockly.Block): string {
  const ms = block.getFieldValue("MS") || 100
  return `time.sleep(${ms / 1000})\n`
}

pythonGenerator["repeat_times"] = function (block: Blockly.Block): string {
  const times = block.getFieldValue("TIMES") || 10
  const statements = generatePythonFromBlock(block.getInputTargetBlock("DO"))
  const indented = statements.split("\n").map((line) => line ? `    ${line}` : "").join("\n")
  return `for _ in range(${times}):\n${indented}\n`
}

pythonGenerator["repeat_forever"] = function (block: Blockly.Block): string {
  const statements = generatePythonFromBlock(block.getInputTargetBlock("DO"))
  const indented = statements.split("\n").map((line) => line ? `    ${line}` : "").join("\n")
  return `while True:\n${indented}\n`
}

pythonGenerator["if_then"] = function (block: Blockly.Block): string {
  const condition = generatePythonFromBlock(block.getInputTargetBlock("CONDITION")) || "True"
  const statements = generatePythonFromBlock(block.getInputTargetBlock("DO"))
  const indented = statements.split("\n").map((line) => line ? `    ${line}` : "").join("\n")
  return `if ${condition.trim()}:\n${indented}\n`
}

pythonGenerator["if_then_else"] = function (block: Blockly.Block): string {
  const condition = generatePythonFromBlock(block.getInputTargetBlock("CONDITION")) || "True"
  const doStatements = generatePythonFromBlock(block.getInputTargetBlock("DO"))
  const elseStatements = generatePythonFromBlock(block.getInputTargetBlock("ELSE"))
  const doIndented = doStatements.split("\n").map((line) => line ? `    ${line}` : "").join("\n")
  const elseIndented = elseStatements.split("\n").map((line) => line ? `    ${line}` : "").join("\n")
  return `if ${condition.trim()}:\n${doIndented}\nelse:\n${elseIndented}\n`
}

// Logic blocks
pythonGenerator["logic_compare"] = function (block: Blockly.Block): string {
  const a = generatePythonFromBlock(block.getInputTargetBlock("A")) || "0"
  const b = generatePythonFromBlock(block.getInputTargetBlock("B")) || "0"
  const op = block.getFieldValue("OP") || "EQ"
  const ops: Record<string, string> = {
    EQ: "==",
    NEQ: "!=",
    LT: "<",
    LTE: "<=",
    GT: ">",
    GTE: ">=",
  }
  return `${a.trim()} ${ops[op]} ${b.trim()}`
}

pythonGenerator["logic_operation"] = function (block: Blockly.Block): string {
  const a = generatePythonFromBlock(block.getInputTargetBlock("A")) || "True"
  const b = generatePythonFromBlock(block.getInputTargetBlock("B")) || "True"
  const op = block.getFieldValue("OP") === "AND" ? "and" : "or"
  return `(${a.trim()} ${op} ${b.trim()})`
}

pythonGenerator["logic_negate"] = function (block: Blockly.Block): string {
  const value = generatePythonFromBlock(block.getInputTargetBlock("BOOL")) || "True"
  return `not ${value.trim()}`
}

pythonGenerator["logic_boolean"] = function (block: Blockly.Block): string {
  return block.getFieldValue("BOOL") === "TRUE" ? "True" : "False"
}

// Math blocks
pythonGenerator["math_number"] = function (block: Blockly.Block): string {
  return String(block.getFieldValue("NUM") || 0)
}

pythonGenerator["math_arithmetic"] = function (block: Blockly.Block): string {
  const a = generatePythonFromBlock(block.getInputTargetBlock("A")) || "0"
  const b = generatePythonFromBlock(block.getInputTargetBlock("B")) || "0"
  const op = block.getFieldValue("OP") || "ADD"
  const ops: Record<string, string> = {
    ADD: "+",
    MINUS: "-",
    MULTIPLY: "*",
    DIVIDE: "/",
    POWER: "**",
  }
  return `(${a.trim()} ${ops[op]} ${b.trim()})`
}

// Variable blocks
pythonGenerator["variables_get"] = function (block: Blockly.Block): string {
  const varName = block.getFieldValue("VAR") || "x"
  return varName
}

pythonGenerator["variables_set"] = function (block: Blockly.Block): string {
  const varName = block.getFieldValue("VAR") || "x"
  const value = generatePythonFromBlock(block.getInputTargetBlock("VALUE")) || "0"
  return `${varName} = ${value.trim()}\n`
}

// Generate Python code from a block
function generatePythonFromBlock(block: Blockly.Block | null): string {
  if (!block) return ""

  let code = ""
  let currentBlock: Blockly.Block | null = block

  while (currentBlock) {
    const type = currentBlock.type
    if (pythonGenerator[type]) {
      code += pythonGenerator[type](currentBlock)
    }
    currentBlock = currentBlock.getNextBlock()
  }

  return code
}

// Main function to generate Python code from workspace
export function generatePythonCode(workspace: Blockly.WorkspaceSvg): string {
  const topBlocks = workspace.getTopBlocks(true)
  
  let code = `# Robot Control Script (Python)
# Generated by Xylo Robotics Platform

import time
from xylo import Robot

# Initialize robot
robot = Robot()

# Main program
def main():
`

  let mainCode = ""
  for (const block of topBlocks) {
    mainCode += generatePythonFromBlock(block)
  }

  if (!mainCode.trim()) {
    mainCode = "    pass  # Add blocks to generate code\n"
  } else {
    // Indent all lines
    mainCode = mainCode
      .split("\n")
      .map((line) => (line ? `    ${line}` : ""))
      .join("\n")
  }

  code += mainCode
  code += `
# Run the program
if __name__ == "__main__":
    main()
`

  return code
}

export { pythonGenerator }


