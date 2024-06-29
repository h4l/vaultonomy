import { jest } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { act } from "react";

import { useImageSize } from "../useImageSize";

class FooImage extends Image {
  naturalHeight: number = 0;
  naturalWidth: number = 0;
}

describe("useImageSize()", () => {
  test("returns no size before Image load", () => {
    const image = new FooImage();
    jest.spyOn(window, "Image").mockReturnValue(image);

    const { result, rerender } = renderHook((url: string | undefined) =>
      useImageSize(url),
    );

    expect(result.current).toEqual({ loaded: false });

    rerender("https://example.com/img.png");

    expect(image.src).toEqual("https://example.com/img.png");
    expect(result.current).toEqual({ loaded: false });

    act(() => {
      image.naturalWidth = 123;
      image.naturalHeight = 456;
      image.dispatchEvent(new Event("load"));
    });

    expect(result.current).toEqual({ loaded: true, width: 123, height: 456 });
  });
});
