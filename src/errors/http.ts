export class HTTPResponseError extends Error {
  readonly response: Response;
  constructor(message: string, options: { response: Response } & ErrorOptions) {
    super(message, options);
    this.response = options.response;
  }
}
