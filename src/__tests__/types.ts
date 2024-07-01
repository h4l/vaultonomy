import { EthAddress, EthHexSignature, RawEthAddress } from "../types";

const checksumAddress = "0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66";

describe("EthAddress", () => {
  test("accepts address with valid checksum", () => {
    expect(EthAddress.parse(checksumAddress)).toEqual(checksumAddress);
  });

  test("accepts address with no embedded checksum (lowercase)", () => {
    expect(EthAddress.parse(checksumAddress.toLowerCase())).toEqual(
      checksumAddress,
    );
  });

  test("rejects address with invalid checksum", () => {
    expect(() => EthAddress.parse(checksumAddress.replace("A", "a"))).toThrow(
      "Invalid address checksum",
    );
  });

  test("rejects address with invalid structure", () => {
    expect(() => EthAddress.parse("0x...")).toThrow("Invalid address");
  });
});

describe("RawEthAddress", () => {
  test("accepts address with valid checksum", () => {
    expect(RawEthAddress.parse(checksumAddress)).toEqual(checksumAddress);
  });

  test("accepts address with no embedded checksum (lowercase)", () => {
    expect(RawEthAddress.parse(checksumAddress.toLowerCase())).toEqual(
      checksumAddress.toLowerCase(),
    );
  });

  test("rejects address with invalid checksum", () => {
    expect(() =>
      RawEthAddress.parse(checksumAddress.replace("A", "a")),
    ).toThrow("Invalid address checksum");
  });

  test("rejects address with invalid structure", () => {
    expect(() => RawEthAddress.parse("0x...")).toThrow("Invalid address");
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
    expect(() => EthHexSignature.parse(thing)).toThrow(
      "Invalid hex signature string",
    );
  });
});
