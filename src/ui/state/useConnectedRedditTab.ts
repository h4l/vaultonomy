import { useEffect, useState } from "react";

import { subscribeToRedditTabAvailability } from "./subscribeToRedditTabAvailability";

export function useConnectedRedditTab(): number | undefined {
  const [tabId, setTabId] = useState<number>();

  // Listen for the backend reporting it has a connection from a Reddit Tab
  useEffect(() => subscribeToRedditTabAvailability(setTabId));

  return tabId;
}
