import { z } from "zod";

import { log } from "../logging";
import { parseJSON } from "../types";
import { browser } from "../webextension";
import {
  FetchCrossOriginMessage,
  FetchCrossOriginMessageResponse,
  FetchFn,
} from "./types";

const Json = z.string().transform(parseJSON);

export const fetchCrossOrigin = FetchFn.implement(
  async (url, options): Promise<Response> => {
    let response: FetchCrossOriginMessageResponse;
    try {
      const result = await browser.runtime.sendMessage({
        type: "fetchCrossOrigin",
        options,
        url,
      } satisfies FetchCrossOriginMessage);
      response = FetchCrossOriginMessageResponse.parse(result);
      if (!response.success) throw response.error;
    } catch (e) {
      log.error(`fetchCrossOrigin message failed: ${e}`);
      return Response.error();
    }

    const bodyJson = Json.safeParse(response.data.body);

    return Response.json(
      bodyJson.success ? bodyJson.data : response.data.body,
      {
        status: response.data.status,
        statusText: response.data.statusText,
        headers: response.data.headers,
      },
    );
  },
);
