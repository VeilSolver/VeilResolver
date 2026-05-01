export class SolverAPIError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = "SolverAPIError"
  }
}

export class SettlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SettlementError"
  }
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EncryptionError"
  }
}

export class StrategyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StrategyError"
  }
}
