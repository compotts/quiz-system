import { createContext, useContext } from "react";

export const SiteStatusContext = createContext(null);

export function useSiteStatus() {
  return useContext(SiteStatusContext);
}
