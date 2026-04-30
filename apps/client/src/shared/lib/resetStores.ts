import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard";
import { useIntegrationStore } from "@/entities/integrations";
import { useConfigStore } from "@/entities/configurations";

/**
 * Wipe in-memory zustand caches that are scoped to the active server.
 * Belt-and-braces guard alongside the hard reload — covers the brief window
 * before the browser unloads the document.
 */
export function resetServerScopedStores(): void {
  useDynamicDashboardStore.setState({
    dashboards: [],
    activeDashboardId: undefined,
    isLoading: false,
    hasLoaded: false,
    error: null,
  });

  useIntegrationStore.setState({
    isHaConnected: false,
    isRos2Connected: false,
    isSdrConnected: false,
    isLoading: false,
    error: null,
  });

  useConfigStore.setState({
    configurations: [],
    isLoading: false,
    error: null,
  });
}

/**
 * Replace current location with `/dashboard` and force a fresh document load.
 * The cache-buster query defeats Chrome's same-URL fast path that can keep
 * the document alive when assigning the same path the user is already on.
 */
export function hardNavigateToDashboard(): void {
  resetServerScopedStores();
  window.location.replace(`/dashboard?_=${Date.now()}`);
}
