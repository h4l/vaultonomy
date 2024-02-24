import { RefObject, useEffect, useState } from "react";

import { assert } from "../../assert";

export function useHtmlElementHeight(
  ref: RefObject<HTMLElement>,
): number | undefined {
  const [elHeight, setElHeight] = useState<number>();

  useEffect(() => {
    const el = ref.current;
    assert(el);

    const resize = new ResizeObserver((resizes) => {
      assert(resizes.length === 1);
      const [{ target, contentBoxSize }] = resizes;
      assert(target === el);
      assert(contentBoxSize.length > 0);

      const height = contentBoxSize[0].blockSize;
      setElHeight(height);
    });
    resize.observe(el);

    return () => resize.unobserve(el);
  }, []);

  return elHeight;
}
