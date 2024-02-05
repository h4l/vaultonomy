import { ReactNode, createContext, useEffect, useId, useRef } from "react";

import { assert } from "../assert";

export const ScreenReaderOnlyContext = createContext<boolean>(false);

export function ScreenReaderOnly({
  el = "span",
  children,
}: {
  el?: "span" | "div";
  children: ReactNode;
}) {
  const El = el as keyof JSX.IntrinsicElements;
  return (
    <El className="sr-only">
      <ScreenReaderOnlyContext.Provider value={true}>
        {children}
      </ScreenReaderOnlyContext.Provider>
    </El>
  );
}

export type Alert = { alertId: string; message: string };

/**
 * Trigger an alert message for screen reader users.
 *
 * Like an alert() dialog for screen readers, except that it doesn't need to be
 * dismissed or interacted with.
 *
 * The `alertId` param must be changed each time the alert is re-triggered if
 * the message has not changed. Otherwise screen readers may ignore the
 * (seemingly duplicate) alert.
 */
export function AriaLiveAlert({ alertId, message }: Alert): JSX.Element {
  const id = `live-alert${useId()}`;
  const containerRef = useRef<HTMLSpanElement | null>(null);

  const isCurrent = (container: HTMLSpanElement): boolean =>
    container.getAttribute("data-alertId") === alertId &&
    container.getAttribute("data-message") === message;
  const setCurrent = (container: HTMLSpanElement): void => {
    container.setAttribute("data-alertId", alertId);
    container.setAttribute("data-message", message);
  };

  const triggerAlert = (): void => {
    const container = containerRef.current;
    assert(container);

    if (isCurrent(container)) return;
    setCurrent(container);

    // In order to announce an alert to screen reader users, browsers need the
    // role="alert" el to be in the DOM before the message text is inserted into
    // it.
    // Apple's VoiceOver seems to be generally unreliable when reporting live
    // regions. It mostly works, but sometimes it just won't announce alerts
    // until VoiceOver is turned off and on again. 🤷‍♂️
    const alertEl = document.createElement("span");
    alertEl.role = "alert";
    container.innerHTML = "";
    container.appendChild(alertEl);

    setTimeout(() => {
      if (!isCurrent(container)) return;
      alertEl.innerText = message;
    });
    // Clear the alert after a short delay, so that screen readers users don't
    // encounter it while navigating the page later on.
    setTimeout(() => {
      if (!isCurrent(container)) return;
      container.innerHTML = "";
    }, 1000);
  };

  // Create a container element to hold the alert outside the react-managed DOM.
  // React's propensity to remove and re-render elements (e.g. in dev mode with
  // double useEffect triggers) seems to confuse the browser's alert announcing
  // mechanism, making it not consistently announce updates when rapidly
  // added/removed. Maintaining a global element works consistently.
  useEffect(() => {
    const existingContainerEl = document.getElementById(id);
    const containerEl = existingContainerEl ?? document.createElement("span");

    assert(containerRef.current === null);
    containerRef.current = containerEl;

    if (!existingContainerEl) {
      containerEl.id = id;
      containerEl.className = "sr-only";
      document.body.appendChild(containerEl);
    }

    containerEl.setAttribute("data-active", "true");
    triggerAlert();

    return () => {
      containerRef.current = null;
      containerEl.setAttribute("data-active", "false");
      // Keep the element in the DOM for a short time, so that we re-use it if
      // we get re-rendered.
      setTimeout(() => {
        if (containerEl.getAttribute("data-active") === "true") return;
        containerEl.remove();
      }, 100);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    triggerAlert();
  }, [message, alertId]);

  return <></>;
}
