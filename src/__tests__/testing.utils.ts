import { nextTick } from "process";

export const sleep = async (n?: number) => {
  await new Promise((resolve) => setTimeout(resolve, n ?? 1));
};

export const nextTickPromise = () =>
  new Promise((resolve) => nextTick(resolve));
