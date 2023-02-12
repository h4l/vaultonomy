export const sleep = async (n?: number) => {
  await new Promise((resolve) => setTimeout(resolve, n ?? 1));
};
