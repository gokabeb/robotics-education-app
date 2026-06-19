import { OpenAI } from "openai"
import { NextRequest, NextResponse } from "next/server"

const EXPLAIN_SYSTEM_PROMPT =
  "You are an educational robotics assistant. Explain the following Arduino robot code in plain English, aimed at middle-school students. Describe what the robot will do step by step. Be concise (3-5 sentences max)."

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

export async function POST(request: NextRequest) {
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
    const { code } = await request.json()

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "code is required" }, { status: 400 })
    }

    const openai = getOpenAIClient()

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
        { role: "user", content: code },
      ],
      stream: true,
      temperature: 0.5,
      max_tokens: 300,
    })

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
    console.error("Error explaining code:", error)

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API error: ${error.message}` },
        { status: error.status || 500 }
      )
    }

    return NextResponse.json({ error: "Failed to explain code" }, { status: 500 })
  }
}
