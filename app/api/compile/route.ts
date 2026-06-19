import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { promisify } from "util"
import type { CompileRequest, CompileResult, CompileDiagnostic } from "@/lib/avr/types"
import { BOARD_PROFILES } from "@/lib/avr/board-profiles"

const execAsync = promisify(exec)

export async function POST(req: NextRequest): Promise<NextResponse<CompileResult>> {
  const body = (await req.json()) as CompileRequest
  const { code, board } = body

  if (!code || !board) {
    return NextResponse.json(
      { success: false, errors: [{ line: null, column: null, message: "Missing code or board", severity: "error" }] },
      { status: 400 }
    )
  }

  const profile = BOARD_PROFILES[board]
  if (!profile) {
    return NextResponse.json(
      { success: false, errors: [{ line: null, column: null, message: `Unknown board: ${board}`, severity: "error" }] },
      { status: 400 }
    )
  }

  // arduino-cli requires the .ino filename to match the folder name
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "xylo-compile-"))
  const sketchDir = path.join(tmpDir, "sketch")
  await fs.mkdir(sketchDir)
  const sketchFile = path.join(sketchDir, "sketch.ino")
  await fs.writeFile(sketchFile, code, "utf-8")

  try {
    const buildDir = path.join(tmpDir, "build")
    await fs.mkdir(buildDir)

    const cmd = [
      "arduino-cli", "compile",
      "--fqbn", profile.fqbn,
      "--output-dir", buildDir,
      "--format", "json",
      sketchDir,
    ].join(" ")

    let stdout = ""
    let stderr = ""
    try {
      const result = await execAsync(cmd, { timeout: 30_000 })
      stdout = result.stdout
      stderr = result.stderr
    } catch (err: unknown) {
      if (err && typeof err === "object" && "stdout" in err) {
        stdout = (err as { stdout: string }).stdout ?? ""
        stderr = (err as { stderr: string }).stderr ?? ""
      } else {
        throw err
      }
    }

    const combined = stdout + stderr
    const parsed = tryParseArduinoJSON(combined)

    if (parsed && !parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.errors })
    }

    const hexFile = path.join(buildDir, "sketch.ino.hex")
    let hex: string
    try {
      hex = await fs.readFile(hexFile, "utf-8")
    } catch {
      return NextResponse.json({
        success: false,
        errors: [{ line: null, column: null, message: "Compilation produced no .hex file — check arduino-cli setup", severity: "error" }],
      })
    }

    const flashBytes = parsed?.flashBytes ?? 0
    const sramBytes = parsed?.sramBytes ?? 0
    const warnings = parsed?.warnings ?? []

    return NextResponse.json({ success: true, hex, flashBytes, sramBytes, warnings })
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

interface ParsedArduinoOutput {
  success: boolean
  errors: CompileDiagnostic[]
  warnings: CompileDiagnostic[]
  flashBytes: number
  sramBytes: number
}

function tryParseArduinoJSON(output: string): ParsedArduinoOutput | null {
  try {
    const lines = output.split("\n").filter((l) => l.trim().startsWith("{"))
    const diagnostics: CompileDiagnostic[] = []
    let flashBytes = 0
    let sramBytes = 0
    let hasErrors = false

    for (const line of lines) {
      const obj = JSON.parse(line)

      if (obj.compiler_err) {
        const errLines = String(obj.compiler_err).split("\n")
        for (const errLine of errLines) {
          const match = errLine.match(/sketch\.ino:(\d+):(\d+):\s+(error|warning):\s+(.+)/)
          if (match) {
            const severity = match[3] as "error" | "warning"
            if (severity === "error") hasErrors = true
            diagnostics.push({
              line: parseInt(match[1], 10),
              column: parseInt(match[2], 10),
              message: match[4].trim(),
              severity,
            })
          }
        }
      }

      if (obj.builder_result?.executable_sections_size) {
        const sections = obj.builder_result.executable_sections_size
        flashBytes = sections.find((s: {name: string; size: number}) => s.name === ".text")?.size ?? 0
        sramBytes = sections.find((s: {name: string; size: number}) => s.name === ".data")?.size ?? 0
      }
    }

    return {
      success: !hasErrors,
      errors: diagnostics.filter((d) => d.severity === "error"),
      warnings: diagnostics.filter((d) => d.severity === "warning"),
      flashBytes,
      sramBytes,
    }
  } catch {
    return null
  }
}
