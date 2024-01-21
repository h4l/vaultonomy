import { VaultonomyError } from "../VaultonomyError";

export class HTTPResponseError extends VaultonomyError {
  readonly response: Response;
  constructor(message: string, options: { response: Response } & ErrorOptions) {
    super(message, options);
    this.response = options.response;
  }
}
