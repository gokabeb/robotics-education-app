export function createMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => new Array(n).fill(0))
}

export function createVector(n: number): number[] {
  return new Array(n).fill(0)
}

/**
 * In-place LU factorization with partial pivoting (Doolittle).
 * A is modified in place. Returns pivot permutation array.
 * Throws if matrix is singular (|pivot| < 1e-12).
 */
export function luFactorize(A: number[][], n: number): number[] {
  const piv = Array.from({ length: n }, (_, i) => i)

  for (let k = 0; k < n; k++) {
    let maxVal = Math.abs(A[k][k])
    let maxRow = k
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(A[i][k]) > maxVal) {
        maxVal = Math.abs(A[i][k])
        maxRow = i
      }
    }

    if (maxRow !== k) {
      ;[A[k], A[maxRow]] = [A[maxRow], A[k]]
      ;[piv[k], piv[maxRow]] = [piv[maxRow], piv[k]]
    }

    if (Math.abs(A[k][k]) < 1e-12) {
      throw new Error(`Singular matrix at pivot ${k} — check circuit for open nets or short circuits`)
    }

    for (let i = k + 1; i < n; i++) {
      A[i][k] /= A[k][k]
      for (let j = k + 1; j < n; j++) {
        A[i][j] -= A[i][k] * A[k][j]
      }
    }
  }

  return piv
}

/**
 * Solve LUx = Pb using the factored A (from luFactorize) and pivot array.
 * b is not modified. Returns solution vector x.
 */
export function luSolve(LU: number[][], piv: number[], b: number[]): number[] {
  const n = b.length
  const x = piv.map(i => b[i])

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      x[i] -= LU[i][j] * x[j]
    }
  }

  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j < n; j++) {
      x[i] -= LU[i][j] * x[j]
    }
    x[i] /= LU[i][i]
  }

  return x
}
