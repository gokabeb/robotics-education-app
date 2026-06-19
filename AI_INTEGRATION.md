# AI Code Generation - Integration Guide

## Overview

Xylo's AI code generation feature uses OpenAI's GPT-4o-mini to create Arduino C++ code for educational robots. The system is intelligently integrated across the platform, understanding robot configurations from the Builder and enhancing code from the Block Editor.

## Features

### 1. **Smart Context-Aware Generation**
The AI considers:
- **Robot Configuration**: When you build a robot in the Robot Builder, the AI knows about your chassis, motors, and sensors
- **Existing Code**: Enhance code from the Block Editor or previous AI generations
- **Target Behavior**: Choose from pre-built behavior templates for common robotics tasks
- **Hardware Specifications**: Generates code specifically for Arduino Uno/Nano with L298N motor driver

### 2. **Pre-built Behavior Templates**
Choose from professionally designed behavior templates:
- 🔹 **Line Follower**: Follow black lines using 3-sensor array with proportional control
- 🚧 **Obstacle Avoider**: Navigate around obstacles using ultrasonic sensor
- 🧱 **Wall Follower**: Maintain consistent distance from walls
- 🎮 **Serial Remote Control**: Control robot via serial commands (F/B/L/R/S)
- 🌀 **Maze Solver**: Navigate mazes using right-hand rule algorithm
- 💡 **Light Seeker**: Move towards light sources using LDR sensors

### 3. **Integrated Workflow**
```
Robot Builder → AI Generator → Simulator → Flasher
     ↓              ↓              ↓           ↓
  Config       Generate       Test       Deploy
   Save         Code         Virtual     Physical
```

## How to Use

### Method 1: Start from Scratch

1. **Open AI Generator** (`/generator`)
2. **Choose a behavior template** or write custom prompt
3. **Click "Generate Code"** to create Arduino code
4. **Test in Simulator** or **Flash to Arduino**

### Method 2: Start with Robot Builder

1. **Build your robot** in `/builder`
   - Select chassis, motors, sensors
   - Configure component properties
2. **Click "Generate Code for Robot"** (saves config)
3. **Open AI Generator** - it will use your robot's configuration
4. **Describe desired behavior** - AI tailors code to your specific robot
5. **Test and deploy**

### Method 3: Enhance Block Code

1. **Create visual program** in `/playground` (Block Editor)
2. **Click "Enhance with AI"** button
3. **AI Generator opens** with your block-generated code as base
4. **Describe improvements** (e.g., "add obstacle avoidance when distance < 20cm")
5. **AI modifies your code** while preserving structure

## Technical Details

### API Endpoint

**POST** `/api/generate`

```typescript
{
  prompt: string              // User's code description
  existingCode?: string       // Base code to enhance (from blocks/previous gen)
  robotConfig?: {             // From Robot Builder
    chassis: { id: string, name: string }
    motors: Array<{ component: { name: string, id: string } }>
    sensors: Array<{ component: { name: string, id: string } }>
  }
  targetBehavior?: string     // Selected template ID (e.g., "line-follower")
}
```

**Response**: Streaming text (Arduino C++ code)

### System Prompt

The AI is instructed to generate code for:
- **Target Hardware**: Arduino Uno/Nano
- **Motor Driver**: L298N (Motor A: pins 5,4,3 / Motor B: pins 6,7,8)
- **Sensors**: 
  - HC-SR04 ultrasonic (pins 9,10)
  - 3-sensor line array (A0, A1, A2)
  - Optional: LDR photoresistors (A3, A4)

### Code Requirements

Generated code always includes:
1. ✅ Pin definitions as constants at the top
2. ✅ `setup()` function for initialization
3. ✅ `loop()` function for main logic
4. ✅ Helper functions (`moveForward()`, `turnLeft()`, `readDistance()`, etc.)
5. ✅ Clear comments for K-12 students
6. ✅ Error handling and edge cases
7. ✅ Meaningful variable names

## Environment Setup

### Required Environment Variable

```env
OPENAI_API_KEY=sk-your-openai-key-here
```

Get your key at: https://platform.openai.com/api-keys

### Optional (Platform works without it)

If `OPENAI_API_KEY` is not set:
- AI Generator shows error message with setup instructions
- Other features (Builder, Simulator, Flasher) work normally
- Users can still manually write code or use Block Editor

## Data Flow

### Robot Configuration Context

When you build a robot in `/builder` and click "Test" or navigate to Generator:

```javascript
// Saved to sessionStorage
{
  "chassis": { "id": "chassis-2wd", "name": "2-Wheel Differential Drive" },
  "motors": [
    { "component": { "id": "motor-dc-standard", "name": "Standard DC Motor" }},
    { "component": { "id": "motor-dc-standard", "name": "Standard DC Motor" }}
  ],
  "sensors": [
    { "component": { "id": "sensor-ultrasonic", "name": "Ultrasonic Distance Sensor" }},
    { "component": { "id": "sensor-line-array", "name": "3-Sensor Line Array" }}
  ]
}
```

The AI uses this to:
- Generate appropriate pin configurations
- Include only relevant sensor reading functions
- Optimize motor control based on drive type
- Add comments specific to your robot setup

### Code Enhancement Context

When enhancing code from Block Editor:

```javascript
// Your Blockly-generated code is sent as "existingCode"
// AI prompt becomes:
"Here is my current Arduino code:
[YOUR BLOCKLY CODE]

Please modify or enhance this code based on my next request."
```

This ensures the AI:
- Preserves your existing logic structure
- Adds new features without breaking existing code
- Maintains consistent style and variable naming
- Explains changes in comments

## Example Prompts

### Basic Movement
```
"Create a robot that moves forward for 2 seconds, turns right 90 degrees, 
moves forward again for 2 seconds, then stops."
```

### Sensor-Based
```
"Build an obstacle avoider that moves forward until the ultrasonic sensor 
detects an object within 30cm, then turns right, checks again, and if still 
blocked, turns around 180 degrees."
```

### Advanced Behavior
```
"Create a line-following robot with obstacle detection. Follow the black line 
using center-weighted proportional control. If an obstacle is detected within 
20cm while line following, stop, wait for the obstacle to clear, then resume."
```

### Enhancement Request
```
"Add a safety feature: if the robot detects no line for more than 3 seconds, 
stop all motors and flash an LED on pin 13 as an error indicator."
```

## Integration Points

### Component Communication

```typescript
// Save code for other components
sessionStorage.setItem("xylo_code", generatedCode)
sessionStorage.setItem("xylo_project_name", "AI Generated Code")

// Simulator automatically loads this on mount
// Flasher provides copy/Arduino IDE opening
```

### Robot Builder → Generator

```typescript
// Builder saves robot configuration
const config = generateRobotConfig(design)
sessionStorage.setItem("xylo_robot_config", JSON.stringify(config))

// Generator detects and uses config
const savedConfig = sessionStorage.getItem("xylo_robot_config")
// Shows banner: "✅ Using robot config from Builder"
```

### Block Editor → Generator

```typescript
// Block Editor saves Arduino code
sessionStorage.setItem("xylo_code", arduinoCode)

// Generator loads as base for enhancement
const savedCode = sessionStorage.getItem("xylo_code")
// Shows banner: "ℹ️ Using code from Block Editor as base"
```

## UI Components

### Main Generator Interface

Located: `/generator` (`components/generator/code-generator.tsx`)

**Left Panel - Input:**
- Behavior template cards (6 templates)
- Custom prompt textarea
- Example prompts
- Tips for better results
- Context indicators (robot config, existing code)

**Right Panel - Output:**
- Generated Arduino code (streaming)
- Copy, Download, Reset buttons
- "Test in Simulator" button → Opens `/simulator` with code loaded
- "Flash to Arduino" button → Opens `/flasher` with code loaded

### Workflow Guidance

If no robot config detected:
```
ℹ️ Pro Tip: Design your robot first!
Build your robot in the Robot Builder first. The AI will generate code 
tailored to your specific robot configuration, sensors, and motors.
[Open Robot Builder →]
```

### Status Indicators

- 🔄 **Generating...** - AI is streaming code
- ✅ **Code generated successfully!** - Ready to test/deploy
- ⚠️ **OpenAI API key not configured** - Setup instructions shown
- ℹ️ **Using robot config from Builder** - Context-aware mode active
- ℹ️ **Using code from Block Editor as base** - Enhancement mode active

## Error Handling

### Missing API Key
```
Error: OpenAI API key not configured. 
Please add OPENAI_API_KEY to your environment variables.
```
**Solution**: Add key to `.env.local` and restart dev server

### API Rate Limit
```
Error: OpenAI API error: Rate limit exceeded
```
**Solution**: Wait a moment or upgrade OpenAI plan

### Invalid Prompt
```
Error: Prompt is required
```
**Solution**: Enter a description in the prompt field

### Network Issues
```
Error: Failed to generate code
```
**Solution**: Check internet connection and try again

## Best Practices

### For Students

1. **Start Simple**: Use behavior templates for learning
2. **Be Specific**: Include sensor thresholds and speeds in prompts
3. **Test First**: Always test in Simulator before deploying to hardware
4. **Iterate**: Enhance generated code step-by-step rather than regenerating

### For Educators

1. **Curriculum Integration**: Use behavior templates to teach specific concepts:
   - Line following → Sensor reading, conditional logic
   - Obstacle avoidance → Distance measurement, decision making
   - Maze solving → Algorithms, state machines
   
2. **Scaffolding**: Progress students through:
   - Behavior templates → Understand existing code
   - Custom prompts → Describe desired behavior
   - Code enhancement → Modify and improve
   
3. **Assessment**: Use AI Generator to quickly create diverse challenges
4. **Differentiation**: Templates for beginners, custom prompts for advanced

## Performance

- **Average generation time**: 5-10 seconds
- **Code length**: 150-300 lines (typical)
- **Token usage**: ~3000 tokens per generation
- **Cost**: ~$0.01 per generation (GPT-4o-mini pricing)

## Security

- API key stored server-side only (not exposed to client)
- User prompts not logged or stored by Xylo
- OpenAI's data usage policy applies: https://openai.com/policies/usage-policies
- For education plans: Consider OpenAI's education discounts

## Future Enhancements

Planned features:
- [ ] Multiple AI providers (Anthropic, Google, local models)
- [ ] Code explanation and documentation generation
- [ ] Automatic bug detection and fixing
- [ ] Curriculum-aligned challenge generation
- [ ] Multi-robot coordination code generation
- [ ] Real-time collaboration on AI-generated code
- [ ] Code version history and comparison
- [ ] Integration with GitHub Copilot for inline suggestions

## Troubleshooting

### Code doesn't compile in Arduino IDE

**Possible causes:**
1. Missing libraries (e.g., Servo.h for servo motors)
2. Incorrect board selection in Arduino IDE
3. Wrong pin definitions for your hardware

**Solution**: 
- Verify hardware setup matches code comments
- Install required libraries via Arduino Library Manager
- Check board selection: Tools → Board → Arduino Uno/Nano

### Generated code doesn't work in Simulator

**Reason**: Simulator uses JavaScript execution, Arduino code is for hardware

**Solution**: 
- Test Arduino code directly on hardware via Flasher
- For simulator testing, use the simplified command syntax:
  ```javascript
  forward(50)
  wait(1000)
  right(50)
  ```

### AI generates incorrect code for my robot

**Possible causes:**
1. Robot config not saved from Builder
2. Prompt too vague or contradictory
3. Hardware different from default setup

**Solution**:
- Rebuild and save robot in Builder first
- Be very specific in prompt about hardware differences
- Use "existing code" enhancement to correct iteratively

## Support

For issues related to AI generation:
1. Check `OPENAI_API_KEY` is set correctly
2. Verify OpenAI account has available credits
3. Check browser console for detailed error messages
4. See `SETUP.md` for environment variable configuration

---

**Last Updated**: 2025-12-28  
**Xylo Version**: 1.0.0 MVP  
**OpenAI Model**: gpt-4o-mini  
**API Version**: v1

