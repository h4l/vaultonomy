import { RefObject, useEffect } from "react";

import { assert } from "../../assert";

// Note: this assumes only a single such hook is in use — multiple instances
// would conflict when enabling/disabling.
export function useEnableScrollSnapWhileElementOnScreen(
  elRef: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    const className = "snap-y";
    const html = document.querySelector("html");
    assert(html);

    const enableSnapping = (enabled: boolean) => {
      if (enabled) html.classList.add(className);
      else html.classList.remove(className);
    };

    const el = elRef.current;
    assert(el, "elRef is populated before mount");

    // Chrome seems to cause smooth scrolling to jump if snapping is disabled
    // while scrolling. It also snaps quite aggressively if snapping is enabled
    // while idle but close to a snap point.
    //
    // To work around these behaviours, we only disable snapping at a scrollend
    // event, and enable snapping while actively scrolling.
    let snapEnablementAtScrollEnd: boolean | undefined = undefined;
    const onScrollEnd = () => {
      if (snapEnablementAtScrollEnd !== undefined) {
        enableSnapping(snapEnablementAtScrollEnd);
        snapEnablementAtScrollEnd = undefined;
      }
    };
    document.addEventListener("scrollend", onScrollEnd);

    const observer = new IntersectionObserver((entries) => {
      assert(entries.length === 1);
      const { target, isIntersecting } = entries[0];
      assert(target === el);

      if (isIntersecting) {
        enableSnapping(true);
      } else {
        snapEnablementAtScrollEnd = false;
      }
    });
    observer.observe(el);

    return () => {
      document.removeEventListener("scrollend", onScrollEnd);
      observer.unobserve(el);
    };
  }, []);
}
