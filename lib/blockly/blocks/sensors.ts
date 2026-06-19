import * as Blockly from "blockly"

// Read distance sensor
Blockly.Blocks["sensor_read_distance"] = {
  init: function () {
    this.appendDummyInput().appendField("distance sensor reading (cm)")
    this.setOutput(true, "Number")
    this.setColour("#9C27B0")
    this.setTooltip("Read the distance sensor value in centimeters")
    this.setHelpUrl("")
  },
}

// Read line sensor
Blockly.Blocks["sensor_read_line"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("line sensor")
      .appendField(
        new Blockly.FieldDropdown([
          ["left", "LEFT"],
          ["center", "CENTER"],
          ["right", "RIGHT"],
        ]),
        "SENSOR"
      )
      .appendField("reading")
    this.setOutput(true, "Number")
    this.setColour("#9C27B0")
    this.setTooltip("Read the line sensor value (0-1023)")
    this.setHelpUrl("")
  },
}

// Is obstacle detected
Blockly.Blocks["sensor_is_obstacle"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("obstacle detected within")
    this.appendValueInput("DISTANCE").setCheck("Number")
    this.appendDummyInput().appendField("cm")
    this.setInputsInline(true)
    this.setOutput(true, "Boolean")
    this.setColour("#9C27B0")
    this.setTooltip("Check if an obstacle is within the specified distance")
    this.setHelpUrl("")
  },
}

// Is line detected
Blockly.Blocks["sensor_is_line_detected"] = {
  init: function () {
    this.appendDummyInput()
      .appendField("line detected on")
      .appendField(
        new Blockly.FieldDropdown([
          ["left sensor", "LEFT"],
          ["center sensor", "CENTER"],
          ["right sensor", "RIGHT"],
          ["any sensor", "ANY"],
        ]),
        "SENSOR"
      )
    this.setOutput(true, "Boolean")
    this.setColour("#9C27B0")
    this.setTooltip("Check if a line is detected by the sensor")
    this.setHelpUrl("")
  },
}

