import type { CompileRequest, CompileResult } from "./types"

export async function compileSketch(request: CompileRequest): Promise<CompileResult> {
  const response = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    return {
      success: false,
      errors: [{ line: null, column: null, message: `Compile server error: ${response.status}`, severity: "error" }],
    }
  }

  return response.json() as Promise<CompileResult>
}
