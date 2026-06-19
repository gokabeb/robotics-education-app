import { OpenAI } from "openai"
import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_PIN_CONFIG } from "@/lib/robot-config/pin-config"

const cfg = DEFAULT_PIN_CONFIG

const SYSTEM_PROMPT = `You are an expert Arduino robotics programmer for educational robots. Your role is to generate complete, compilable Arduino C++ code based on user descriptions.

Target hardware configuration:
- Arduino Uno/Nano compatible microcontroller
- L298N motor driver for two DC motors
  - Motor A (Left): Enable pin ${cfg.leftMotor.enable}, Direction pins ${cfg.leftMotor.in1} and ${cfg.leftMotor.in2}
  - Motor B (Right): Enable pin ${cfg.rightMotor.enable}, Direction pins ${cfg.rightMotor.in1} and ${cfg.rightMotor.in2}
- HC-SR04 ultrasonic distance sensor: TRIG pin ${cfg.ultrasonic.trig}, ECHO pin ${cfg.ultrasonic.echo}
- Line sensor array on analog pins A${cfg.lineSensors.left} (left), A${cfg.lineSensors.center} (center), A${cfg.lineSensors.right} (right)

Code requirements:
1. Always include clear comments explaining each section
2. Include proper setup() and loop() functions
3. Define all pin constants at the top of the file
4. Include helper functions for common operations (moveForward, turnLeft, readDistance, etc.)
5. Handle edge cases and include basic error handling
6. Keep code simple enough for K-12 students to understand
7. Use meaningful variable names

Output format:
- Return ONLY the Arduino C++ code
- Do not include any explanations before or after the code
- Do not use markdown code blocks
- The code should be ready to copy-paste into Arduino IDE

Example behaviors you can implement:
- Line following
- Obstacle avoidance
- Remote control via serial
- Maze solving
- Light following (with additional sensors)
- Dance routines
- Sound-reactive movements (with sound sensor)`

// Create OpenAI client lazily to avoid build-time errors
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured")
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export async function POST(request: NextRequest) {
  // Early check: fail fast with structured error if key is missing
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: "AI_NOT_CONFIGURED",
        message:
          "OpenAI API key is not configured. See ENV_VARIABLES.md for setup instructions.",
      },
      { status: 503 }
    )
  }

  try {
    const { prompt, existingCode, robotConfig, targetBehavior } = await request.json()

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    let openai: OpenAI
    try {
      openai = getOpenAIClient()
    } catch {
      return NextResponse.json(
        {
          error: "AI_NOT_CONFIGURED",
          message:
            "OpenAI API key is not configured. See ENV_VARIABLES.md for setup instructions.",
        },
        { status: 503 }
      )
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ]

    // Add robot configuration context if provided
    if (robotConfig) {
      const configText = buildRobotConfigContext(robotConfig)
      messages.push({
        role: "system",
        content: `Student's robot configuration:\n${configText}\n\nGenerate code that works with this specific robot setup.`,
      })
    }

    // Add target behavior context if provided
    if (targetBehavior) {
      messages.push({
        role: "system",
        content: `Target use case: ${targetBehavior}. Optimize the code for this specific scenario.`,
      })
    }

    // If there's existing code, include it for context
    if (existingCode) {
      messages.push({
        role: "user",
        content: `Here is my current Arduino code:\n\n${existingCode}\n\nPlease modify or enhance this code based on my next request.`,
      })
      messages.push({
        role: "assistant",
        content: "I understand your current code. What would you like me to modify or add?",
      })
    }

    messages.push({
      role: "user",
      content: prompt,
    })

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
    })

    // Create a ReadableStream for streaming the response
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ""
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    console.error("Error generating code:", error)
    
    if (error instanceof OpenAI.APIError) {
      return Response.json(
        { error: `OpenAI API error: ${error.message}` },
        { status: error.status || 500 }
      )
    }

    return Response.json(
      { error: "Failed to generate code" },
      { status: 500 }
    )
  }
}

// Helper function to build robot config context
function buildRobotConfigContext(config: {
  chassis?: { id: string; name: string }
  motors?: Array<{ component?: { name: string; id: string } }>
  sensors?: Array<{ component?: { name: string; id: string } }>
}): string {
  const parts: string[] = []
  
  if (config.chassis) {
    parts.push(`Chassis: ${config.chassis.name}`)
  }
  
  if (config.motors && config.motors.length > 0) {
    const motorTypes = config.motors.map(m => m.component?.name || 'Motor').join(', ')
    parts.push(`Motors: ${motorTypes} (${config.motors.length} total)`)
  }
  
  if (config.sensors && config.sensors.length > 0) {
    const sensorTypes = config.sensors.map(s => s.component?.name || 'Sensor').join(', ')
    parts.push(`Sensors: ${sensorTypes}`)
  }
  
  return parts.length > 0 ? parts.join('\n') : 'Standard 2-wheel differential drive robot'
}
