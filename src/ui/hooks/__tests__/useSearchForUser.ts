import { expect, jest } from "@jest/globals";

import { ParsedQuery, parseQuery } from "../useSearchForUser";

describe("parseQuery()", () => {
  // prettier-ignore
  const cases: [string, ParsedQuery][] = [
    ["", { type: "invalid-query", reason: "empty" }],
    ["  ", { type: "invalid-query", reason: "empty" }],
    ["foo bar", { type: "invalid-query", reason: "multiple" }],
    // Usernames
    ["h4l", { type: "username", value: 'h4l' }],
    [" H4l ", { type: "username", value: 'h4l' }],
    [" u/H4l ", { type: "username", value: 'h4l' }],
    [" https://reddit.com/u/H4l ", { type: "username", value: 'h4l' }],
    [" https://reddit.com/user/H4l ", { type: "username", value: 'h4l' }],
    [" https://aNy.rEddIt.com/user/H4l ", { type: "username", value: 'h4l' }],
    [" https://aNy.rEddIt.com/user/H4l/ ", { type: "username", value: 'h4l' }],
    ["H😧l", { type: "invalid-query", reason: 'username' }],
    ["aaaaaBBBBBcccccDDDDD", { type: "username", value: 'aaaaabbbbbcccccddddd' }],
    ["aaaaaBBBBBcccccDDDDDe", { type: "invalid-query", reason: 'username-length' }],
    // Usernames can look like addresses
    ["0xf00", { type: "username", value: '0xf00' }],
    ["0xaaaBBBBBcccccDDDDD", { type: "username", value: '0xaaabbbbbcccccddddd' }],
    // Over-long usernames that look like addresses are parsed as invalid addresses
    ["0xaaaBBBBBcccccDDDDDe", { type: "invalid-query", reason: 'address' }],
    // Addresses normalise to checksum format
    ["0x2bba0433d7d798981d08ec4ac93d3bd301f3b4bd", { type: "address", value: '0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd' }],
    ["  0x2bba0433d7d798981d08ec4ac93d3bd301f3b4bd  ", { type: "address", value: '0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd' }],
    ["0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd", { type: "address", value: '0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd' }],
    // Checksum addresses with invalid checksums are errors
    ["0xBADbadBAD7D798981d08EC4aC93d3bd301F3b4Bd", { type: "invalid-query", reason: 'address-checksum' }],
    // Anything with a __.__ is an ENS name
    ["ens.ens", { type: "ens-name", value: 'ens.ens' }],
    [" ens.ens ", { type: "ens-name", value: 'ens.ens' }],
    // Parsed names are normalised
    ["EnS.eNs", { type: "ens-name", value: 'ens.ens' }],
    // Invalid names are detected via normalisation
    // (Invalid because these are visually-similar but distinct characters.)
    ["ااا.ens", { type: "invalid-query", reason: 'ens-name' }],
  ];

  test.each(cases)("parseQuery(%j) == %s", (rawQuery, expected) => {
    expect(parseQuery(rawQuery)).toEqual(expected);
  });
});
