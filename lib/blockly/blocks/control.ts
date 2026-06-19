import * as Blockly from "blockly"

// Wait seconds
Blockly.Blocks["wait_seconds"] = {
  init: function () {
    this.appendDummyInput().appendField("wait")
    this.appendValueInput("SECONDS").setCheck("Number")
    this.appendDummyInput().appendField("seconds")
    this.setInputsInline(true)
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#FF9800")
    this.setTooltip("Wait for specified seconds")
    this.setHelpUrl("")
  },
}

// Wait milliseconds
Blockly.Blocks["wait_milliseconds"] = {
  init: function () {
    this.appendDummyInput().appendField("wait")
    this.appendValueInput("MS").setCheck("Number")
    this.appendDummyInput().appendField("milliseconds")
    this.setInputsInline(true)
    this.setPreviousStatement(true, null)
    this.setNextStatement(true, null)
    this.setColour("#FF9800")
    this.setTooltip("Wait for specified milliseconds")
    this.setHelpUrl("")
  },
}

// Loop forever
Blockly.Blocks["robot_loop_forever"] = {
  init: function () {
    this.appendDummyInput().appendField("loop forever")
    this.appendStatementInput("DO").setCheck(null)
    this.setPreviousStatement(true, null)
    this.setColour("#795548")
    this.setTooltip("Repeat the enclosed blocks forever")
    this.setHelpUrl("")
  },
}

