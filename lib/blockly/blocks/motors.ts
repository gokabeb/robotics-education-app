import * as Blockly from "blockly"

// Motor set speed block
Blockly.Blocks["motor_set_speed"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("set motor")
      .appendField(
        new Blockly.FieldDropdown([
          ["left", "LEFT"],
          ["right", "RIGHT"],
          ["both", "BOTH"],
        ]),
        "MOTOR"
      )
      .appendField("speed to")
    this.appendValueInput("SPEED").setCheck("Number")
    this.appendDummyInput().appendField("%")
    this.setInputsInline(true)
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#2196F3")
    this.setTooltip("Set motor speed from -100 to 100")
    this.setHelpUrl("")
  },
}

// Motor spin block
Blockly.Blocks["motor_spin"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("spin motor")
      .appendField(
        new Blockly.FieldDropdown([
          ["left", "LEFT"],
          ["right", "RIGHT"],
          ["both", "BOTH"],
        ]),
        "MOTOR"
      )
      .appendField(
        new Blockly.FieldDropdown([
          ["forward", "FORWARD"],
          ["backward", "BACKWARD"],
        ]),
        "DIRECTION"
      )
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#2196F3")
    this.setTooltip("Spin motor in specified direction")
    this.setHelpUrl("")
  },
}

// Motor stop block
Blockly.Blocks["motor_stop"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("stop motor")
      .appendField(
        new Blockly.FieldDropdown([
          ["left", "LEFT"],
          ["right", "RIGHT"],
          ["both", "BOTH"],
        ]),
        "MOTOR"
      )
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#2196F3")
    this.setTooltip("Stop the specified motor")
    this.setHelpUrl("")
  },
}

// Robot move forward
Blockly.Blocks["robot_move_forward"] = {
  init: function () {
    this.appendDummyInput().appendField("move forward at speed")
    this.appendValueInput("SPEED").setCheck("Number")
    this.appendDummyInput().appendField("%")
    this.setInputsInline(true)
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#4CAF50")
    this.setTooltip("Move the robot forward")
    this.setHelpUrl("")
  },
}

// Robot move backward
Blockly.Blocks["robot_move_backward"] = {
  init: function () {
    this.appendDummyInput().appendField("move backward at speed")
    this.appendValueInput("SPEED").setCheck("Number")
    this.appendDummyInput().appendField("%")
    this.setInputsInline(true)
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#4CAF50")
    this.setTooltip("Move the robot backward")
    this.setHelpUrl("")
  },
}

// Robot turn left
Blockly.Blocks["robot_turn_left"] = {
  init: function () {
    this.appendDummyInput().appendField("turn left at speed")
    this.appendValueInput("SPEED").setCheck("Number")
    this.appendDummyInput().appendField("%")
    this.setInputsInline(true)
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#4CAF50")
    this.setTooltip("Turn the robot left")
    this.setHelpUrl("")
  },
}

// Robot turn right
Blockly.Blocks["robot_turn_right"] = {
  init: function () {
    this.appendDummyInput().appendField("turn right at speed")
    this.appendValueInput("SPEED").setCheck("Number")
    this.appendDummyInput().appendField("%")
    this.setInputsInline(true)
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#4CAF50")
    this.setTooltip("Turn the robot right")
    this.setHelpUrl("")
  },
}

// Robot stop
Blockly.Blocks["robot_stop"] = {
  init: function () {
    this.appendDummyInput().appendField("stop robot")
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#4CAF50")
    this.setTooltip("Stop all robot motors")
    this.setHelpUrl("")
  },
}

