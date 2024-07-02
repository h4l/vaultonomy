import { nextTick } from "node:process";

export const sleep = async (n?: number) => {
  await new Promise((resolve) => setTimeout(resolve, n ?? 1));
};

export const nextTickPromise = () =>
  new Promise((resolve) => nextTick(resolve));

export function dateParseStrict(datetime: string): number {
  const timestamp = Date.parse(datetime);
  if (!(timestamp > 0))
    throw new Error(`failed to parse datetime: ${datetime}`);
  return timestamp;
}
