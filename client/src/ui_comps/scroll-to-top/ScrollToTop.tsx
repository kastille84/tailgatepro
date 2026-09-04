import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scrolls the window to the top on every route change. React Router does not
 *  do this automatically for client-side navigations. Render once, inside
 *  <BrowserRouter>. */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};
