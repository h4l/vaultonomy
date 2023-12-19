import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { UserAvatarImage } from "../UserAvatar";

describe("UserAvatarImage", () => {
  test("renders placeholder until user's image is loaded", async () => {
    render(
      <svg>
        <UserAvatarImage url="example" />
      </svg>
    );

    expect(await screen.getByTestId("user-avatar-image")).not.toBeVisible();
    expect(await screen.getByTestId("placeholder-avatar-image")).toBeVisible();
  });

  test("renders image with y offset according to image height", async () => {
    render(
      <svg>
        <UserAvatarImage url="example" />
      </svg>
    );

    const image = (await screen.getByTestId(
      "user-avatar-image"
    )) as unknown as SVGImageElement;
    const initialY = image.getAttribute("y");

    act(() => {
      // simulate the image having loaded
      image.getBBox = () => ({ height: 410 } as DOMRect);
      image.dispatchEvent(new Event("load"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("user-avatar-image")).toBeVisible()
    );
    expect(
      await screen.queryByTestId("placeholder-avatar-image")
    ).not.toBeInTheDocument();

    const calculatedY = screen
      .getByTestId("user-avatar-image")
      .getAttribute("y");
    expect(initialY).not.toEqual(calculatedY);
  });
});
