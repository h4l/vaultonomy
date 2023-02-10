import { jest } from "@jest/globals";

import {
  DEFAULT_PAGE_DATA_URL,
  PageData,
  fetchPageData,
  parsePageJSONData,
} from "../page-data";

function pageData(): PageData {
  return { user: { session: { accessToken: "abc-123" } } };
}

const html = `\
<!DOCTYPE html><html lang="en-US">
<head><title>Hi</title></head>
<body><h1>Hi</h1>
<script id="data">window.___r = ${JSON.stringify(pageData())};</script>
<script></script>
</html>`;

test("parsePageJSONData() extracts JSON from #data element", () => {
  expect(parsePageJSONData(html)).toStrictEqual(pageData());
});

test("fetchPageData()", async () => {
  const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: async () => html,
  } as Response);
  await expect(fetchPageData()).resolves.toStrictEqual(pageData());
  expect(fetch).toBeCalledTimes(1);
  expect(fetch).toBeCalledWith(DEFAULT_PAGE_DATA_URL);
});
