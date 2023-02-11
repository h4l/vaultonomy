import { jest } from "@jest/globals";

import {
  DEFAULT_PAGE_DATA_URL,
  InPageRedditUser,
  fetchPageData,
  parsePageJSONData,
} from "../page-data";

function pageDataLoggedIn(): Record<string, unknown> {
  return {
    other: { stuff: true },
    user: {
      other: { stuff: true },
      account: {
        other: { stuff: true },
        id: "t2_abc",
        isGold: true,
        accountIcon: "https://example.com/img",
        displayText: "exampleuser",
      },
    },
    session: {
      accessToken: "abc-123",
    },
  };
}
function pageDataLoggedOut(): Record<string, unknown>[] {
  return [
    {
      other: { stuff: true },
      user: {
        account: null,
      },
      session: {
        accessToken: "abc-123",
      },
    },
    {
      other: { stuff: true },
      user: {
        account: null,
        session: {},
      },
    },
    {
      other: { stuff: true },
      user: {
        account: null,
        session: null,
      },
    },
  ];
}

const html = (pageData: Record<string, unknown>) => `\
<!DOCTYPE html><html lang="en-US">
<head><title>Hi</title></head>
<body><h1>Hi</h1>
<script id="data">window.___r = ${JSON.stringify(pageData)};</script>
<script></script>
</html>`;

describe("parsePageJSONData()", () => {
  test("extracts JSON from #data element", () => {
    const data = pageDataLoggedIn();
    expect(parsePageJSONData(html(data))).toStrictEqual(data);
  });
});

describe("fetchPageData()", () => {
  test("provides data for logged-in user", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => html(pageDataLoggedIn()),
    } as Response);

    const expected: InPageRedditUser = {
      userID: "t2_abc",
      hasPremium: true,
      accountIconURL: "https://example.com/img",
      username: "exampleuser",
      authToken: "abc-123",
    };
    await expect(fetchPageData()).resolves.toStrictEqual(expected);
    expect(fetch).toBeCalledTimes(1);
    expect(fetch).nthCalledWith(1, DEFAULT_PAGE_DATA_URL);
  });

  test.each(pageDataLoggedOut().map((pageData) => [html(pageData)]))(
    "provides data for logged-out user",
    async (htmlWithLoggedOutUser: string) => {
      jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => htmlWithLoggedOutUser,
      } as Response);

      await expect(fetchPageData()).resolves.toBeUndefined();
    }
  );

  test.each`
    desc                                       | html                                                | message
    ${"data element is not present"}           | ${""}                                               | ${"page contains no #data element"}
    ${"data element contains unexpected data"} | ${`<script id="data">sdfds</script>`}               | ${"#data element's content is not structured as expected"}
    ${"data element contains invalid JSON"}    | ${`<script id="data">window.___r = {"foo</script>`} | ${"data element's content is not valid JSON"}
    ${"JSON data has unexpected structure"}    | ${html({ user: { account: { displayText: 42 } } })} | ${"page #data JSON value is not structured as expected"}
  `(
    "throws error when $desc",
    async (options: { html: string; message: string }) => {
      jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => options.html,
      } as Response);

      await expect(fetchPageData()).rejects.toThrow(options.message);
    }
  );
});
