import { useEffect, useState } from "react";

type Size = { loaded: false } | { loaded: true; width: number; height: number };

/** Load an image and provide its width and height. */
export function useImageSize(url: string | undefined): Size {
  const [img, _setImg] = useState(() => new Image());
  const [size, setSize] = useState<Size>(() => ({ loaded: false }));
  useEffect(() => {
    if (url === undefined) return;

    const onLoad = () => {
      setSize({
        loaded: true,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.addEventListener("load", onLoad);
    img.setAttribute("src", url);

    return () => {
      img.removeEventListener("load", onLoad);
      img.removeAttribute("src");
      setSize({ loaded: false });
    };
  }, [url]);

  return size;
}
