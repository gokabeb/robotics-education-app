export const toolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Movement",
      colour: "#4CAF50",
      contents: [
        { kind: "block", type: "robot_move_forward" },
        { kind: "block", type: "robot_move_backward" },
        { kind: "block", type: "robot_turn_left" },
        { kind: "block", type: "robot_turn_right" },
        { kind: "block", type: "robot_stop" },
      ],
    },
    {
      kind: "category",
      name: "Motors",
      colour: "#2196F3",
      contents: [
        { kind: "block", type: "motor_set_speed" },
        { kind: "block", type: "motor_spin" },
        { kind: "block", type: "motor_stop" },
      ],
    },
    {
      kind: "category",
      name: "Sensors",
      colour: "#9C27B0",
      contents: [
        { kind: "block", type: "sensor_read_distance" },
        { kind: "block", type: "sensor_read_line" },
        { kind: "block", type: "sensor_is_obstacle" },
        { kind: "block", type: "sensor_is_line_detected" },
      ],
    },
    {
      kind: "category",
      name: "Timing",
      colour: "#FF9800",
      contents: [
        { kind: "block", type: "wait_seconds" },
        { kind: "block", type: "wait_milliseconds" },
      ],
    },
    {
      kind: "category",
      name: "Logic",
      colour: "#607D8B",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category",
      name: "Loops",
      colour: "#795548",
      contents: [
        { kind: "block", type: "controls_repeat_ext" },
        { kind: "block", type: "controls_whileUntil" },
        { kind: "block", type: "controls_for" },
        { kind: "block", type: "robot_loop_forever" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      colour: "#E91E63",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_random_int" },
      ],
    },
    {
      kind: "category",
      name: "Variables",
      colour: "#00BCD4",
      custom: "VARIABLE",
    },
    {
      kind: "category",
      name: "Functions",
      colour: "#FF5722",
      custom: "PROCEDURE",
    },
  ],
}

