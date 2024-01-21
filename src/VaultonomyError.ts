export abstract class VaultonomyError extends Error {
  get name(): string {
    return this.constructor.name;
  }
}
