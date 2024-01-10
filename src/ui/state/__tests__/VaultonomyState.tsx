import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { VaultonomyRoot } from "../VaultonomyState";

type ExtensionDetectionModule =
  typeof import("../../../webextensions/extension-detector");

// jest.unstable_mockModule("./src/webextensions/ExtensionDetector", async () => {
//   const module: ExtensionDetectionModule = {
//     DefaultExtensionDetector:
//       jest.fn<ExtensionDetectionModule["isExtensionInstalled"]>(),
//   };
//   return module;
// });

// const { isExtensionInstalled } = await import(
//   "../../../webextensions/ExtensionDetector"
// );

test("foo", () => {
  class Foo {
    constructor(
      public a: string,
      public b: number,
    ) {}

    frob(): string {
      return `a=${this.a}, b=${this.b}`;
    }
  }
  jest.spyOn(Foo.prototype, "frob").mockImplementationOnce(() => "mocked!");
  const f = new Foo("A", 42);
  expect(f.frob()).toEqual("mocked!");
  expect(f.frob()).toEqual("a=A, b=42");
});

// describe("<VaultonomyRoot>", () => {
//   describe("hasMetaMaskExtension", () => {
//     test("is true when installed", async () => {
//       jest.mocked(isExtensionInstalled).mockResolvedValueOnce(true);

//       render(<VaultonomyRoot></VaultonomyRoot>);

//       // TODO: how should we test this? Perhaps not via render?
//     });
//   });
// });
