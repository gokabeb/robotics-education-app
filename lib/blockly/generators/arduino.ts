import * as Blockly from "blockly"
import { Order } from "blockly/javascript"
import { DEFAULT_PIN_CONFIG } from "@/lib/robot-config/pin-config"

// Create Arduino generator extending the JavaScript generator
const arduinoGenerator = new Blockly.Generator("Arduino")

// Set operator precedence (order)
arduinoGenerator.ORDER_ATOMIC = Order.ATOMIC
arduinoGenerator.ORDER_NONE = Order.NONE

// Add functions required for Blockly generators
arduinoGenerator.scrub_ = function (block, code, thisOnly) {
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock()
  if (nextBlock && !thisOnly) {
    return code + arduinoGenerator.blockToCode(nextBlock)
  }
  return code
}

// Motor blocks
arduinoGenerator.forBlock["motor_set_speed"] = function (block: Blockly.Block) {
  const motor = block.getFieldValue("MOTOR")
  const speed = arduinoGenerator.valueToCode(block, "SPEED", Order.ATOMIC) || "0"
  
  if (motor === "BOTH") {
    return `setMotorSpeed(MOTOR_LEFT, ${speed});\n  setMotorSpeed(MOTOR_RIGHT, ${speed});\n`
  }
  return `setMotorSpeed(MOTOR_${motor}, ${speed});\n`
}

arduinoGenerator.forBlock["motor_spin"] = function (block: Blockly.Block) {
  const motor = block.getFieldValue("MOTOR")
  const direction = block.getFieldValue("DIRECTION")
  
  if (motor === "BOTH") {
    return `spinMotor(MOTOR_LEFT, ${direction});\n  spinMotor(MOTOR_RIGHT, ${direction});\n`
  }
  return `spinMotor(MOTOR_${motor}, ${direction});\n`
}

arduinoGenerator.forBlock["motor_stop"] = function (block: Blockly.Block) {
  const motor = block.getFieldValue("MOTOR")
  
  if (motor === "BOTH") {
    return `stopMotor(MOTOR_LEFT);\n  stopMotor(MOTOR_RIGHT);\n`
  }
  return `stopMotor(MOTOR_${motor});\n`
}

// Movement blocks
arduinoGenerator.forBlock["robot_move_forward"] = function (block: Blockly.Block) {
  const speed = arduinoGenerator.valueToCode(block, "SPEED", Order.ATOMIC) || "50"
  return `moveForward(${speed});\n`
}

arduinoGenerator.forBlock["robot_move_backward"] = function (block: Blockly.Block) {
  const speed = arduinoGenerator.valueToCode(block, "SPEED", Order.ATOMIC) || "50"
  return `moveBackward(${speed});\n`
}

arduinoGenerator.forBlock["robot_turn_left"] = function (block: Blockly.Block) {
  const speed = arduinoGenerator.valueToCode(block, "SPEED", Order.ATOMIC) || "50"
  return `turnLeft(${speed});\n`
}

arduinoGenerator.forBlock["robot_turn_right"] = function (block: Blockly.Block) {
  const speed = arduinoGenerator.valueToCode(block, "SPEED", Order.ATOMIC) || "50"
  return `turnRight(${speed});\n`
}

arduinoGenerator.forBlock["robot_stop"] = function () {
  return `stopRobot();\n`
}

// Sensor blocks
arduinoGenerator.forBlock["sensor_read_distance"] = function () {
  return ["readDistance()", Order.ATOMIC]
}

arduinoGenerator.forBlock["sensor_read_line"] = function (block: Blockly.Block) {
  const sensor = block.getFieldValue("SENSOR")
  return [`readLineSensor(LINE_${sensor})`, Order.ATOMIC]
}

arduinoGenerator.forBlock["sensor_is_obstacle"] = function (block: Blockly.Block) {
  const distance = arduinoGenerator.valueToCode(block, "DISTANCE", Order.ATOMIC) || "20"
  return [`(readDistance() < ${distance})`, Order.ATOMIC]
}

arduinoGenerator.forBlock["sensor_is_line_detected"] = function (block: Blockly.Block) {
  const sensor = block.getFieldValue("SENSOR")
  if (sensor === "ANY") {
    return [`isLineDetected()`, Order.ATOMIC]
  }
  return [`isLineDetectedOn(LINE_${sensor})`, Order.ATOMIC]
}

// Timing blocks
arduinoGenerator.forBlock["wait_seconds"] = function (block: Blockly.Block) {
  const seconds = arduinoGenerator.valueToCode(block, "SECONDS", Order.ATOMIC) || "1"
  return `delay(${seconds} * 1000);\n`
}

arduinoGenerator.forBlock["wait_milliseconds"] = function (block: Blockly.Block) {
  const ms = arduinoGenerator.valueToCode(block, "MS", Order.ATOMIC) || "100"
  return `delay(${ms});\n`
}

// Loop forever
arduinoGenerator.forBlock["robot_loop_forever"] = function (block: Blockly.Block) {
  const statements = arduinoGenerator.statementToCode(block, "DO")
  return `while (true) {\n${statements}}\n`
}

// Math number
arduinoGenerator.forBlock["math_number"] = function (block: Blockly.Block) {
  const code = Number(block.getFieldValue("NUM"))
  return [String(code), Order.ATOMIC]
}

// Math arithmetic
arduinoGenerator.forBlock["math_arithmetic"] = function (block: Blockly.Block) {
  const OPERATORS: Record<string, [string, number]> = {
    ADD: [" + ", Order.ADDITION],
    MINUS: [" - ", Order.SUBTRACTION],
    MULTIPLY: [" * ", Order.MULTIPLICATION],
    DIVIDE: [" / ", Order.DIVISION],
    POWER: ["", Order.NONE],
  }
  const op = block.getFieldValue("OP")
  const tuple = OPERATORS[op]
  const operator = tuple[0]
  const order = tuple[1]
  
  const argument0 = arduinoGenerator.valueToCode(block, "A", order) || "0"
  const argument1 = arduinoGenerator.valueToCode(block, "B", order) || "0"
  
  if (op === "POWER") {
    return [`pow(${argument0}, ${argument1})`, Order.ATOMIC]
  }
  
  return [`${argument0}${operator}${argument1}`, order]
}

// Logic compare
arduinoGenerator.forBlock["logic_compare"] = function (block: Blockly.Block) {
  const OPERATORS: Record<string, string> = {
    EQ: "==",
    NEQ: "!=",
    LT: "<",
    LTE: "<=",
    GT: ">",
    GTE: ">=",
  }
  const op = OPERATORS[block.getFieldValue("OP")]
  const order = Order.RELATIONAL
  const argument0 = arduinoGenerator.valueToCode(block, "A", order) || "0"
  const argument1 = arduinoGenerator.valueToCode(block, "B", order) || "0"
  return [`${argument0} ${op} ${argument1}`, order]
}

// Logic operation (AND, OR)
arduinoGenerator.forBlock["logic_operation"] = function (block: Blockly.Block) {
  const operator = block.getFieldValue("OP") === "AND" ? "&&" : "||"
  const order = block.getFieldValue("OP") === "AND" ? Order.LOGICAL_AND : Order.LOGICAL_OR
  const argument0 = arduinoGenerator.valueToCode(block, "A", order) || "false"
  const argument1 = arduinoGenerator.valueToCode(block, "B", order) || "false"
  return [`${argument0} ${operator} ${argument1}`, order]
}

// Logic negate
arduinoGenerator.forBlock["logic_negate"] = function (block: Blockly.Block) {
  const argument0 = arduinoGenerator.valueToCode(block, "BOOL", Order.LOGICAL_NOT) || "false"
  return [`!${argument0}`, Order.LOGICAL_NOT]
}

// Logic boolean
arduinoGenerator.forBlock["logic_boolean"] = function (block: Blockly.Block) {
  const code = block.getFieldValue("BOOL") === "TRUE" ? "true" : "false"
  return [code, Order.ATOMIC]
}

// Controls if
arduinoGenerator.forBlock["controls_if"] = function (block: Blockly.Block) {
  let n = 0
  let code = ""
  
  do {
    const conditionCode = arduinoGenerator.valueToCode(block, "IF" + n, Order.NONE) || "false"
    const branchCode = arduinoGenerator.statementToCode(block, "DO" + n)
    code += (n === 0 ? "if" : " else if") + ` (${conditionCode}) {\n${branchCode}}`
    n++
  } while (block.getInput("IF" + n))
  
  if (block.getInput("ELSE")) {
    const branchCode = arduinoGenerator.statementToCode(block, "ELSE")
    code += ` else {\n${branchCode}}`
  }
  
  return code + "\n"
}

// Controls repeat
arduinoGenerator.forBlock["controls_repeat_ext"] = function (block: Blockly.Block) {
  const times = arduinoGenerator.valueToCode(block, "TIMES", Order.ATOMIC) || "10"
  const branch = arduinoGenerator.statementToCode(block, "DO")
  return `for (int i = 0; i < ${times}; i++) {\n${branch}}\n`
}

// Controls while
arduinoGenerator.forBlock["controls_whileUntil"] = function (block: Blockly.Block) {
  const until = block.getFieldValue("MODE") === "UNTIL"
  let argument0 = arduinoGenerator.valueToCode(block, "BOOL", Order.NONE) || "false"
  const branch = arduinoGenerator.statementToCode(block, "DO")
  
  if (until) {
    argument0 = `!(${argument0})`
  }
  
  return `while (${argument0}) {\n${branch}}\n`
}

// Controls for
arduinoGenerator.forBlock["controls_for"] = function (block: Blockly.Block) {
  const variable = arduinoGenerator.getVariableName(block.getFieldValue("VAR"))
  const from = arduinoGenerator.valueToCode(block, "FROM", Order.ATOMIC) || "0"
  const to = arduinoGenerator.valueToCode(block, "TO", Order.ATOMIC) || "10"
  const increment = arduinoGenerator.valueToCode(block, "BY", Order.ATOMIC) || "1"
  const branch = arduinoGenerator.statementToCode(block, "DO")
  
  return `for (int ${variable} = ${from}; ${variable} <= ${to}; ${variable} += ${increment}) {\n${branch}}\n`
}

// Random integer
arduinoGenerator.forBlock["math_random_int"] = function (block: Blockly.Block) {
  const from = arduinoGenerator.valueToCode(block, "FROM", Order.ATOMIC) || "1"
  const to = arduinoGenerator.valueToCode(block, "TO", Order.ATOMIC) || "100"
  return [`random(${from}, ${to} + 1)`, Order.ATOMIC]
}

// Variables get
arduinoGenerator.forBlock["variables_get"] = function (block: Blockly.Block) {
  const varName = arduinoGenerator.getVariableName(block.getFieldValue("VAR"))
  return [varName, Order.ATOMIC]
}

// Variables set
arduinoGenerator.forBlock["variables_set"] = function (block: Blockly.Block) {
  const varName = arduinoGenerator.getVariableName(block.getFieldValue("VAR"))
  const value = arduinoGenerator.valueToCode(block, "VALUE", Order.NONE) || "0"
  return `${varName} = ${value};\n`
}

// Helper to get variable name
arduinoGenerator.getVariableName = function (id: string) {
  // Simple variable name generation
  return id.replace(/[^a-zA-Z0-9_]/g, "_")
}

// Helper to generate statements from a block
arduinoGenerator.statementToCode = function (block: Blockly.Block, name: string): string {
  const targetBlock = block.getInputTargetBlock(name)
  if (!targetBlock) {
    return ""
  }
  const code = arduinoGenerator.blockToCode(targetBlock)
  if (typeof code === "string") {
    return "  " + code.split("\n").filter(line => line).join("\n  ") + "\n"
  }
  return ""
}

// Helper to get value code
arduinoGenerator.valueToCode = function (block: Blockly.Block, name: string, outerOrder: number): string {
  const targetBlock = block.getInputTargetBlock(name)
  if (!targetBlock) {
    return ""
  }
  const tuple = arduinoGenerator.blockToCode(targetBlock)
  if (Array.isArray(tuple)) {
    return tuple[0]
  }
  return ""
}

// Generate full Arduino code with preamble
export function generateArduinoCode(workspace: Blockly.Workspace): string {
  // Get user code from blocks
  const userCode = arduinoGenerator.workspaceToCode(workspace)
  
  const cfg = DEFAULT_PIN_CONFIG

  // Arduino code template
  const preamble = `/*
 * Robot Control Code
 * Generated by Xylo Robotics Platform
 * https://xylo.app
 */

// ========== PIN DEFINITIONS ==========
// Motor A (Left Motor)
#define MOTOR_LEFT_EN   ${cfg.leftMotor.enable}   // PWM speed control
#define MOTOR_LEFT_IN1  ${cfg.leftMotor.in1}   // Direction control 1
#define MOTOR_LEFT_IN2  ${cfg.leftMotor.in2}   // Direction control 2

// Motor B (Right Motor)
#define MOTOR_RIGHT_EN  ${cfg.rightMotor.enable}   // PWM speed control
#define MOTOR_RIGHT_IN1 ${cfg.rightMotor.in1}   // Direction control 1
#define MOTOR_RIGHT_IN2 ${cfg.rightMotor.in2}   // Direction control 2

// Ultrasonic Sensor (HC-SR04)
#define TRIG_PIN        ${cfg.ultrasonic.trig}
#define ECHO_PIN        ${cfg.ultrasonic.echo}

// Line Sensors
#define LINE_LEFT       A${cfg.lineSensors.left}
#define LINE_CENTER     A${cfg.lineSensors.center}
#define LINE_RIGHT      A${cfg.lineSensors.right}

// Constants
#define MOTOR_LEFT      0
#define MOTOR_RIGHT     1
#define FORWARD         1
#define BACKWARD        0
#define LINE_THRESHOLD  500

// ========== MOTOR FUNCTIONS ==========
void setMotorSpeed(int motor, int speed) {
  int pin = (motor == MOTOR_LEFT) ? MOTOR_LEFT_EN : MOTOR_RIGHT_EN;
  int pwmValue = map(abs(speed), 0, 100, 0, 255);
  analogWrite(pin, pwmValue);
}

void spinMotor(int motor, int direction) {
  int in1, in2;
  if (motor == MOTOR_LEFT) {
    in1 = MOTOR_LEFT_IN1;
    in2 = MOTOR_LEFT_IN2;
  } else {
    in1 = MOTOR_RIGHT_IN1;
    in2 = MOTOR_RIGHT_IN2;
  }
  
  if (direction == FORWARD) {
    digitalWrite(in1, HIGH);
    digitalWrite(in2, LOW);
  } else {
    digitalWrite(in1, LOW);
    digitalWrite(in2, HIGH);
  }
}

void stopMotor(int motor) {
  int in1, in2;
  if (motor == MOTOR_LEFT) {
    in1 = MOTOR_LEFT_IN1;
    in2 = MOTOR_LEFT_IN2;
  } else {
    in1 = MOTOR_RIGHT_IN1;
    in2 = MOTOR_RIGHT_IN2;
  }
  digitalWrite(in1, LOW);
  digitalWrite(in2, LOW);
}

// ========== MOVEMENT FUNCTIONS ==========
void moveForward(int speed) {
  setMotorSpeed(MOTOR_LEFT, speed);
  setMotorSpeed(MOTOR_RIGHT, speed);
  spinMotor(MOTOR_LEFT, FORWARD);
  spinMotor(MOTOR_RIGHT, FORWARD);
}

void moveBackward(int speed) {
  setMotorSpeed(MOTOR_LEFT, speed);
  setMotorSpeed(MOTOR_RIGHT, speed);
  spinMotor(MOTOR_LEFT, BACKWARD);
  spinMotor(MOTOR_RIGHT, BACKWARD);
}

void turnLeft(int speed) {
  setMotorSpeed(MOTOR_LEFT, speed / 2);
  setMotorSpeed(MOTOR_RIGHT, speed);
  spinMotor(MOTOR_LEFT, FORWARD);
  spinMotor(MOTOR_RIGHT, FORWARD);
}

void turnRight(int speed) {
  setMotorSpeed(MOTOR_LEFT, speed);
  setMotorSpeed(MOTOR_RIGHT, speed / 2);
  spinMotor(MOTOR_LEFT, FORWARD);
  spinMotor(MOTOR_RIGHT, FORWARD);
}

void stopRobot() {
  stopMotor(MOTOR_LEFT);
  stopMotor(MOTOR_RIGHT);
}

// ========== SENSOR FUNCTIONS ==========
long readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH);
  long distance = duration * 0.034 / 2;
  return distance;
}

int readLineSensor(int sensor) {
  return analogRead(sensor);
}

bool isLineDetectedOn(int sensor) {
  return analogRead(sensor) > LINE_THRESHOLD;
}

bool isLineDetected() {
  return isLineDetectedOn(LINE_LEFT) || 
         isLineDetectedOn(LINE_CENTER) || 
         isLineDetectedOn(LINE_RIGHT);
}

// ========== SETUP ==========
void setup() {
  // Initialize Serial for debugging
  Serial.begin(${cfg.baudRate});
  
  // Motor pins
  pinMode(MOTOR_LEFT_EN, OUTPUT);
  pinMode(MOTOR_LEFT_IN1, OUTPUT);
  pinMode(MOTOR_LEFT_IN2, OUTPUT);
  pinMode(MOTOR_RIGHT_EN, OUTPUT);
  pinMode(MOTOR_RIGHT_IN1, OUTPUT);
  pinMode(MOTOR_RIGHT_IN2, OUTPUT);
  
  // Ultrasonic sensor pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Line sensor pins (analog, no setup needed)
  
  // Initialize motors stopped
  stopRobot();
  
  Serial.println("Robot initialized!");
}

// ========== MAIN LOOP ==========
void loop() {
`

  const postamble = `}
`

  // Indent user code
  const indentedCode = userCode
    .split("\n")
    .map(line => line ? "  " + line : "")
    .join("\n")

  return preamble + indentedCode + postamble
}

export { arduinoGenerator }

