/**
 * Seed script: "Introduction to Robotics" course
 *
 * Run with: npx tsx scripts/seed-curriculum.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) in env
 *
 * Idempotent: checks if course already exists before inserting.
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Set them in .env.local and run: npx tsx scripts/seed-curriculum.ts"
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ---- Content helpers -------------------------------------------------------

function textBlock(content: string, order: number) {
  return { content_json: { type: "text", content, order }, order_index: order }
}

function quizBlock(
  questions: { text: string; options: string[]; correct: number }[],
  order: number
) {
  return { content_json: { type: "quiz", questions, order }, order_index: order }
}

function activityBlock(
  activityType: string,
  instructions: string,
  config: Record<string, unknown>,
  order: number
) {
  return {
    content_json: { type: "activity", activityType, instructions, config, order },
    order_index: order,
  }
}

// ---- Course definition -----------------------------------------------------

const COURSE_TITLE = "Introduction to Robotics"

const MODULES = [
  {
    title: "What Is a Robot?",
    order_index: 1,
    lessons: [
      {
        title: "Robots Are Everywhere",
        description: "Discover where robots are used in everyday life.",
        content_type: "text",
        duration_minutes: 15,
        order_index: 1,
        learning_objectives: [
          "Define what a robot is",
          "Give 3 examples of robots in daily life",
          "Explain why robots are useful",
        ],
        content: [
          textBlock(
            `## Robots Are Everywhere

You might not realize it, but robots are all around you. A robot is any machine that can **sense** its environment, **decide** what to do, and **act** on that decision — often without direct human control.

### Examples in daily life

- **Robotic vacuums** (like Roomba) sense obstacles and navigate your home
- **Self-checkout machines** scan barcodes and process payments
- **Car assembly lines** use robotic arms to weld and paint vehicles
- **Mars rovers** explore the surface of another planet autonomously
- **Surgical robots** help doctors perform precise operations

### Why are robots useful?

Robots are great at tasks that are **repetitive**, **dangerous**, **extremely precise**, or **far away**. They don't get tired, they don't make mistakes from fatigue, and they can work in environments that are unsafe for humans.`,
            1
          ),
          quizBlock(
            [
              {
                text: "Which of the following is the best definition of a robot?",
                options: [
                  "A machine that looks like a human",
                  "A machine that can sense, decide, and act",
                  "Any electronic device",
                  "A computer program",
                ],
                correct: 1,
              },
              {
                text: "Which task is robots NOT particularly well-suited for?",
                options: [
                  "Repetitive assembly line work",
                  "Exploring dangerous environments",
                  "Creative writing",
                  "Precise surgical assistance",
                ],
                correct: 2,
              },
              {
                text: "A robotic vacuum cleaner uses which capability to avoid furniture?",
                options: ["Decision-making only", "Sensing", "Acting only", "None of the above"],
                correct: 1,
              },
            ],
            2
          ),
        ],
      },
      {
        title: "Parts of a Robot: Body, Brain, and Senses",
        description: "Learn about the physical and electronic components that make up a robot.",
        content_type: "text",
        duration_minutes: 20,
        order_index: 2,
        learning_objectives: [
          "Identify the chassis, controller, and sensors of a robot",
          "Explain what each part does",
          "Match robot parts to their functions",
        ],
        content: [
          textBlock(
            `## Parts of a Robot

Every robot, no matter how complex, has three core parts: a **body** (chassis), a **brain** (controller), and **senses** (sensors).

### 1. Body (Chassis)

The chassis is the physical frame of the robot. It holds everything together and determines the robot's shape and movement style.

- **Wheeled** chassis: most common, good for flat surfaces
- **Tracked** chassis: like a tank, good for rough terrain
- **Legged** chassis: can navigate complex terrain

### 2. Brain (Controller / Microcontroller)

The controller is the computer that runs the robot's program. For the Xylo robot, we use an **Arduino** microcontroller.

- Reads sensor inputs
- Runs the code you write
- Sends signals to motors and other outputs

### 3. Senses (Sensors)

Sensors let the robot perceive its environment:

| Sensor | Measures |
|--------|----------|
| Ultrasonic sensor | Distance to objects |
| Line sensor | Black/white surface under robot |
| Light sensor (LDR) | Brightness |
| IR sensor | Nearby obstacles |

### How they work together

\`\`\`
Sensor → reads environment
  ↓
Controller → runs program, makes decision
  ↓
Motors → take action
\`\`\``,
            1
          ),
          quizBlock(
            [
              {
                text: "What is the role of the microcontroller in a robot?",
                options: ["Powers the motors", "Reads sensor data and runs the program", "Holds the robot together", "Measures distance"],
                correct: 1,
              },
              {
                text: "Which sensor would you use to detect a black line on a white floor?",
                options: ["Ultrasonic sensor", "Temperature sensor", "Line sensor", "Accelerometer"],
                correct: 2,
              },
            ],
            2
          ),
        ],
      },
      {
        title: "How Robots Move",
        description: "Understand motors, wheels, and differential drive.",
        content_type: "text",
        duration_minutes: 15,
        order_index: 3,
        learning_objectives: [
          "Explain how DC motors work",
          "Describe differential drive steering",
          "Predict robot movement from motor speeds",
        ],
        content: [
          textBlock(
            `## How Robots Move

The Xylo robot uses **two DC motors** — one for each wheel — controlled by a **motor driver** (L298N chip).

### DC Motors

A DC (Direct Current) motor spins when electricity flows through it. By controlling:
- **Speed**: how much current (0–100%)
- **Direction**: which way the current flows (forward/backward)

### Differential Drive

The Xylo robot uses **differential drive** — two independently controlled wheels:

| Left motor | Right motor | Result |
|-----------|------------|--------|
| Fast forward | Fast forward | Move forward |
| Fast backward | Fast backward | Move backward |
| Stopped | Fast forward | Turn left (spin) |
| Fast forward | Stopped | Turn right (spin) |
| Slow forward | Fast forward | Gentle left curve |

This is the same system used by tanks, wheelchairs, and most simple robots!

### The Motor Driver

The L298N motor driver takes signals from the Arduino and converts them into the right amount of power for each motor. The Arduino controls the **enable pin** (speed via PWM) and **direction pins**.`,
            1
          ),
          quizBlock(
            [
              {
                text: "To make a differential-drive robot turn right, you should:",
                options: [
                  "Speed up both motors",
                  "Speed up the left motor more than the right",
                  "Speed up the right motor more than the left",
                  "Stop both motors",
                ],
                correct: 1,
              },
              {
                text: "What does PWM stand for in motor control?",
                options: ["Pulse Width Modulation", "Power Wire Management", "Program Write Mode", "Pin Width Mapping"],
                correct: 0,
              },
            ],
            2
          ),
        ],
      },
    ],
  },
  {
    title: "Your First Robot Program",
    order_index: 2,
    lessons: [
      {
        title: "Opening the Simulator",
        description: "Get familiar with the Xylo robot simulator.",
        content_type: "interactive",
        duration_minutes: 15,
        order_index: 1,
        learning_objectives: [
          "Navigate to the robot simulator",
          "Use keyboard controls to drive the robot",
          "Understand the different arena options",
        ],
        content: [
          textBlock(
            `## Opening the Simulator

The Xylo simulator lets you test robot programs without any physical hardware. This is perfect for experimenting safely before uploading code to a real robot.

### What you'll see

- **Canvas** (left): the 2D arena where your robot lives
- **Controls panel** (right): buttons and keyboard shortcuts
- **Arena selector**: choose between Open Arena, Maze, Obstacle Course, and Line Follow

### Keyboard controls

| Key | Action |
|-----|--------|
| W / ↑ | Move forward |
| S / ↓ | Move backward |
| A / ← | Turn left |
| D / → | Turn right |
| Space | Stop |
| R | Reset position |

### Sensor display

When driving, you'll see three blue rays extending from the front of the robot — these are the ultrasonic sensor's simulated beams. The number next to each shows distance in centimeters.`,
            1
          ),
          activityBlock(
            "simulator",
            "Open the simulator and drive your robot around the open arena using the keyboard controls (WASD or arrow keys). Try to reach the green goal circle in under 30 seconds.",
            { arena: "open-arena" },
            2
          ),
        ],
      },
      {
        title: "Making the Robot Move with Code",
        description: "Write your first robot script using the code runner.",
        content_type: "interactive",
        duration_minutes: 20,
        order_index: 2,
        learning_objectives: [
          "Understand the basic simulator script commands",
          "Write a sequence of movement commands",
          "Run code and observe the robot's behavior",
        ],
        content: [
          textBlock(
            `## Making the Robot Move with Code

Instead of controlling the robot by hand, you can write a **program** — a sequence of commands the robot follows automatically.

### Script commands

The simulator understands these commands:

\`\`\`
forward(speed)    -- move forward at speed 0-100
backward(speed)   -- move backward
left(speed)       -- turn left
right(speed)      -- turn right
stop()            -- stop all motors
wait(ms)          -- pause for ms milliseconds
setMotors(l, r)   -- set left and right motors independently
\`\`\`

### Your first program

Try this in the Code Runner tab:

\`\`\`
forward(50)
wait(1000)
right(50)
wait(500)
forward(50)
wait(1000)
stop()
\`\`\`

This moves the robot forward for 1 second, turns right for 0.5 seconds, moves forward again, then stops.`,
            1
          ),
          activityBlock(
            "simulator",
            "Open the Code tab in the simulator. Type in the example program above and click Run. Watch what happens! Then try modifying the speed and wait times to change the robot's path.",
            { arena: "open-arena" },
            2
          ),
        ],
      },
      {
        title: "Challenge: Drive in a Square",
        description: "Program your robot to drive in a perfect square.",
        content_type: "challenge",
        duration_minutes: 25,
        order_index: 3,
        learning_objectives: [
          "Apply forward and turn commands in sequence",
          "Use trial-and-error to tune timing",
          "Complete a full square path",
        ],
        content: [
          textBlock(
            `## Challenge: Drive in a Square

Now it's time to put your programming skills to the test. Your goal is to write a program that makes the robot drive in a **square** — forward, turn right 90°, forward, turn right 90°, and so on until it returns to the start.

### Tips

- A square has **4 sides** and **4 right-angle turns**
- Use \`wait()\` to control how far the robot travels and how much it turns
- You'll need to experiment with the wait times to get exactly 90° turns
- Start with \`forward(50)\` and \`right(50)\` and adjust from there

### Hint structure

\`\`\`
// Side 1
forward(50)
wait(???)
right(50)
wait(???)
// Repeat 3 more times...
stop()
\`\`\``,
            1
          ),
          activityBlock(
            "simulator",
            "Write a program that drives the robot in a square. The robot should end up back at (approximately) its starting position. Try to complete all 4 sides.",
            { arena: "open-arena" },
            2
          ),
        ],
      },
    ],
  },
  {
    title: "Robot Sensors",
    order_index: 3,
    lessons: [
      {
        title: "What Are Sensors?",
        description: "Explore the different types of sensors used in robots.",
        content_type: "text",
        duration_minutes: 15,
        order_index: 1,
        learning_objectives: [
          "Name at least 3 types of robot sensors",
          "Match each sensor to its use case",
          "Explain how the ultrasonic sensor measures distance",
        ],
        content: [
          textBlock(
            `## What Are Sensors?

Sensors are the robot's "eyes, ears, and skin." They convert physical phenomena (light, distance, touch) into electrical signals the controller can read.

### Sensors on the Xylo Robot

#### Ultrasonic Sensor (HC-SR04)
- **Measures**: distance to the nearest object in front of the robot
- **How**: sends a pulse of ultrasound, times how long it takes to bounce back
- **Range**: 2cm – 400cm
- **Use cases**: obstacle avoidance, wall following, parking

#### Line Sensors (3 × analog)
- **Measures**: whether the surface beneath is light or dark
- **How**: emits infrared light, measures how much reflects back
- **Positions**: left (A0), center (A1), right (A2)
- **Use cases**: line following, edge detection

#### Why multiple sensors?

With three line sensors side-by-side, the robot can tell:
- Is it on the line? (center sensor reads dark)
- Is it drifting left? (right sensor reads dark)
- Is it drifting right? (left sensor reads dark)

This lets it make fine adjustments to stay on course.`,
            1
          ),
          quizBlock(
            [
              {
                text: "Which sensor would you use to stop a robot before it hits a wall?",
                options: ["Line sensor", "Ultrasonic sensor", "Temperature sensor", "Gyroscope"],
                correct: 1,
              },
              {
                text: "If the RIGHT line sensor detects the line but the center does not, which way should the robot turn to get back on track?",
                options: ["Turn left", "Turn right", "Move faster", "Stop"],
                correct: 1,
              },
              {
                text: "What does the ultrasonic sensor use to measure distance?",
                options: ["Light waves", "Infrared", "Sound waves (ultrasound)", "Radio waves"],
                correct: 2,
              },
            ],
            2
          ),
        ],
      },
      {
        title: "Using the Distance Sensor",
        description: "Program the robot to react to obstacles using the ultrasonic sensor.",
        content_type: "interactive",
        duration_minutes: 25,
        order_index: 2,
        learning_objectives: [
          "Use if-conditions in robot code",
          "Read the distance sensor value",
          "Program a stop-before-wall behavior",
        ],
        content: [
          textBlock(
            `## Using the Distance Sensor

In the simulator, you can react to sensor readings using **if conditions**. The sensor value is available automatically — the simulator provides it to your program.

### Stop before a wall

The AI-generated or Blockly-generated code will include logic like:

\`\`\`arduino
// Arduino C++ style (from AI generator)
void loop() {
  if (isObstacle(20)) {
    stopRobot();
  } else {
    moveForward(150);
  }
}
\`\`\`

When you send this to the simulator with "Test in Simulator," it gets converted to simulator commands automatically.

### Using the AI Generator

1. Go to **/generator**
2. Select the "Obstacle Avoider" template
3. Click **Generate Code**
4. Click **Test in Simulator**
5. Watch the robot stop before walls!`,
            1
          ),
          activityBlock(
            "simulator",
            "Use the AI Generator to create an 'obstacle avoider' program. Click 'Test in Simulator' to load it, then click Run. Observe how the robot reacts when it gets close to a wall.",
            { arena: "obstacle-course" },
            2
          ),
        ],
      },
      {
        title: "Challenge: Obstacle Avoider",
        description: "Navigate the obstacle course without hitting anything.",
        content_type: "challenge",
        duration_minutes: 30,
        order_index: 3,
        learning_objectives: [
          "Combine sensor reading with motor control",
          "Complete a challenge with no collisions",
          "Debug robot behavior by adjusting thresholds",
        ],
        content: [
          textBlock(
            `## Challenge: Obstacle Avoider

Your robot must navigate through the obstacle course and reach the goal **without hitting any obstacles**.

### Strategy

1. Move forward until an obstacle is detected within ~30cm
2. Turn until the path is clear
3. Continue forward
4. Repeat until the goal is reached

### Tuning tips

- If the robot turns but still hits obstacles: increase detection distance
- If the robot turns too much: reduce turn wait time
- If the robot gets stuck in a corner: add a check for multiple blocked directions`,
            1
          ),
          activityBlock(
            "simulator",
            "Load your obstacle avoidance code and navigate through the obstacle course to reach the goal. You must complete it with zero collisions. Use the Code tab to load your program.",
            { arena: "obstacle-course" },
            2
          ),
        ],
      },
    ],
  },
  {
    title: "Building Your Own Robot",
    order_index: 4,
    lessons: [
      {
        title: "Using the Robot Builder",
        description: "Design a custom robot using the drag-and-drop builder.",
        content_type: "interactive",
        duration_minutes: 20,
        order_index: 1,
        learning_objectives: [
          "Open the Robot Builder and add components",
          "Add a chassis, motors, and sensors",
          "Save a robot configuration",
        ],
        content: [
          textBlock(
            `## Using the Robot Builder

The **Robot Builder** at /builder lets you design a custom robot by dragging components from the library onto a canvas.

### Components you can add

| Category | Examples |
|----------|---------|
| Chassis | Standard, compact, heavy-duty |
| Motors | DC motor, servo |
| Sensors | Ultrasonic, line sensor, IR, color |
| Accessories | LED array, speaker, arm |

### How to use it

1. Drag a **chassis** from the library onto the canvas — this is the foundation
2. Drag **motors** and attach them to the chassis
3. Drag **sensors** and position them where you want
4. Click a component to edit its properties (pin assignments, etc.)
5. Click **Save Configuration** to store your design

### Using your design with the AI Generator

After saving, navigate to the **AI Generator**. It will show "Using robot config from Builder" and generate code specifically tailored to your robot's components and pin assignments.`,
            1
          ),
          activityBlock(
            "builder",
            "Open the Robot Builder. Add a standard chassis, two DC motors, and one ultrasonic sensor. Position the sensor at the front of the robot. Save your configuration, then navigate to the AI Generator to see it load your robot's setup.",
            {},
            2
          ),
        ],
      },
      {
        title: "Project: Design and Test Your Robot",
        description: "Build a complete robot and program it to complete a task.",
        content_type: "challenge",
        duration_minutes: 40,
        order_index: 2,
        learning_objectives: [
          "Design a robot with appropriate sensors for a task",
          "Generate code tailored to your robot design",
          "Test and iterate on your robot in the simulator",
        ],
        content: [
          textBlock(
            `## Project: Design and Test Your Robot

This is your capstone project for Module 4. You'll design a robot from scratch, generate code for it, and test it in the simulator.

### Project requirements

1. **Design**: Build a robot in the Robot Builder with at least:
   - 1 chassis
   - 2 motors
   - 1 or more sensors

2. **Program**: Use the AI Generator (with your robot config loaded) to generate code for a behavior of your choice:
   - Line follower
   - Obstacle avoider
   - Wall follower
   - Or your own creative idea!

3. **Test**: Run your code in the simulator and observe the behavior

4. **Iterate**: Modify the prompt or code to improve performance

### Tips for success

- Start simple — get basic movement working before adding sensor logic
- Use the "Explain Code" button in the generator to understand what was generated
- Try the simulator's different arenas to find the best match for your behavior`,
            1
          ),
          activityBlock(
            "builder",
            "Design your robot in the Builder, generate code for it with the AI Generator, then test it in the simulator. Try to complete at least one full navigation task (reach a goal, follow a line, or avoid all obstacles).",
            {},
            2
          ),
        ],
      },
    ],
  },
]

// ---- Seed logic ------------------------------------------------------------

async function seed() {
  console.log("Checking if course already exists...")

  const { data: existing } = await supabase
    .from("courses")
    .select("id")
    .eq("title", COURSE_TITLE)
    .single()

  if (existing) {
    console.log(`Course "${COURSE_TITLE}" already exists (id: ${existing.id}). Skipping.`)
    return
  }

  console.log(`Inserting course "${COURSE_TITLE}"...`)

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      title: COURSE_TITLE,
      description:
        "Learn the fundamentals of robotics through hands-on projects with the Xylo robot platform. Build, program, and test real robots — no experience required.",
      difficulty: "beginner",
      estimated_hours: 8,
      grade_range: "6-8",
      is_premium: false,
      order_index: 1,
    })
    .select()
    .single()

  if (courseError || !course) {
    console.error("Failed to insert course:", courseError)
    process.exit(1)
  }

  console.log(`  Course id: ${course.id}`)

  for (const mod of MODULES) {
    const { data: module, error: modError } = await supabase
      .from("modules")
      .insert({
        course_id: course.id,
        title: mod.title,
        order_index: mod.order_index,
      })
      .select()
      .single()

    if (modError || !module) {
      console.error(`  Failed to insert module "${mod.title}":`, modError)
      continue
    }

    console.log(`  Module: ${module.title} (${module.id})`)

    for (const lesson of mod.lessons) {
      const { content, ...lessonData } = lesson

      const { data: insertedLesson, error: lessonError } = await supabase
        .from("lessons")
        .insert({
          ...lessonData,
          module_id: module.id,
          course_id: course.id,
        })
        .select()
        .single()

      if (lessonError || !insertedLesson) {
        console.error(`    Failed to insert lesson "${lesson.title}":`, lessonError)
        continue
      }

      console.log(`    Lesson: ${insertedLesson.title} (${insertedLesson.id})`)

      // Insert content blocks
      if (content && content.length > 0) {
        const blocks = content.map((block) => ({
          lesson_id: insertedLesson.id,
          content_json: block.content_json,
          order_index: block.order_index,
        }))

        const { error: contentError } = await supabase
          .from("lesson_content")
          .insert(blocks)

        if (contentError) {
          console.error(`      Failed to insert content blocks:`, contentError)
        } else {
          console.log(`      Inserted ${blocks.length} content block(s)`)
        }
      }
    }
  }

  console.log("\nSeed complete!")
  console.log(`Course "${COURSE_TITLE}" is now available at /learn`)
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
