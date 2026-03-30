import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Utility component that resets scroll position on navigation.
 * - PUSH/REPLACE (new page): Scroll to top (0,0).
 * - POP (back/forward): Preserve scroll position (standard browser behavior).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    // Only scroll to top on new navigation entries, not on back/forward
    if (navType !== "POP") {
      window.scrollTo(0, 0);
    }
  }, [pathname, navType]);

  return null;
}
