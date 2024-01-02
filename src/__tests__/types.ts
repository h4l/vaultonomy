import { EthAddress, EthHexSignature } from "../types";

describe("EthAddress", () => {
  test("accepts address with valid checksum", () => {
    expect(
      EthAddress.parse("0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66"),
    ).toEqual("0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66");
  });

  test("accepts address with no embedded checksum (lowercase)", () => {
    expect(
      EthAddress.parse(
        "0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66".toLowerCase(),
      ),
    ).toEqual("0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66");
  });

  test("rejects address with invalid checksum", () => {
    expect(() =>
      EthAddress.parse(
        "0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66".replace("A", "a"),
      ),
    ).toThrowError("Invalid address checksum");
  });

  test("rejects address with invalid structure", () => {
    expect(() => EthAddress.parse("0x...")).toThrowError("Invalid address");
  });
});

describe("EthHexSignature", () => {
  const sig = `0x${"0".repeat(130)}`;
  test("accepts hex signatures", () => {
    expect(EthHexSignature.parse(sig)).toEqual(sig);
  });

  test.each`
    thing
    ${""}
    ${" "}
    ${` ${sig} `}
  `("rejects non-signature value $thing", ({ thing }: { thing: unknown }) => {
    expect(() => EthHexSignature.parse(thing)).toThrowError(
      "Invalid hex signature string",
    );
  });
});
