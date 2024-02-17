const PX_PER_REM = 16;

export function pxAsRem(px: number): string {
  return `${px / PX_PER_REM}rem`;
}

export function pxNumbersAsRem(dimension: number | string): string {
  return typeof dimension === "number" ? pxAsRem(dimension) : dimension;
}
