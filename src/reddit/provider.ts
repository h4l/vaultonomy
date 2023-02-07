export interface ProviderMessage {
  readonly type: string;
  readonly data: unknown;
}

export interface RequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | object;
}

export class RedditProvider extends EventTarget {
  async request(args: RequestArguments): Promise<unknown> {
    args;
    throw new Error();
  }
}
