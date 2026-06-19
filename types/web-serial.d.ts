// Web Serial API Type Definitions

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
}

interface SerialOptions {
  baudRate: number
  dataBits?: 7 | 8
  stopBits?: 1 | 2
  parity?: "none" | "even" | "odd"
  bufferSize?: number
  flowControl?: "none" | "hardware"
}

interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[]
}

interface SerialPortFilter {
  usbVendorId?: number
  usbProductId?: number
}

interface Serial extends EventTarget {
  onconnect: ((this: Serial, ev: Event) => void) | null
  ondisconnect: ((this: Serial, ev: Event) => void) | null
  getPorts(): Promise<SerialPort[]>
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
}

interface Navigator {
  serial: Serial
}

