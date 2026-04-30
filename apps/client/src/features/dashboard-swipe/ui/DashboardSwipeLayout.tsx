import { Footer } from "@/features/footer";
import { AppSidebar } from "@/features/sidebar";
import { WebRTCProvider } from "@/features/rtc/WebRTCProvider";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  DashboardMainPanel,
  type DashboardMainPanelContentView,
} from "@/pages/dashboard";
import {
  DynamicDashboardMainPanel,
  NewDynamicDashboardPanel,
} from "@/pages/dynamic-dashboard";
import type { DynamicDashboard } from "@/entities/dynamic-dashboard/store";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { useIntegrationStore } from "@/entities/integrations/store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { DashboardSwipeHeader } from "./DashboardSwipeHeader";

/** Child route element so nested paths match without rendering extra UI. */
export function DashboardSwipeRoutePlaceholder() {
  return null;
}

function maxPanelIndex(
  integrationCount: number,
  dashboards: DynamicDashboard[],
): number {
  return integrationCount + dashboards.length + 1;
}

function panelIndexFromPath(
  pathname: string,
  search: string,
  dashboards: DynamicDashboard[],
  activeIntegrations: DashboardMainPanelContentView[],
): number {
  const n = dashboards.length;
  const k = activeIntegrations.length;
  const lastIdx = maxPanelIndex(k, dashboards);

  if (pathname === "/dashboard") {
    const view = new URLSearchParams(search).get("view") || "main";
    if (view === "main") {
      return 0;
    }
    const i = activeIntegrations.indexOf(view as DashboardMainPanelContentView);
    if (i >= 0) {
      return 1 + i;
    }
    return 0;
  }
  if (pathname === "/dynamic-dashboard/new") {
    return lastIdx;
  }
  if (pathname === "/dynamic-dashboard") {
    return n > 0 ? k + 1 : lastIdx;
  }
  const prefix = "/dynamic-dashboard/";
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    if (rest === "new") {
      return lastIdx;
    }
    const i = dashboards.findIndex((d) => d.id === rest);
    if (i >= 0) {
      return k + 1 + i;
    }
  }
  return 0;
}

const INTEGRATION_VIEW_IDS: DashboardMainPanelContentView[] = [
  "ha",
  "ros2",
  "sdr",
];

export function DashboardSwipeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const dashboards = useDynamicDashboardStore((s) => s.dashboards);
  const setActiveDashboard = useDynamicDashboardStore(
    (s) => s.setActiveDashboard,
  );
  const loadDashboards = useDynamicDashboardStore((s) => s.loadDashboards);
  const hasLoaded = useDynamicDashboardStore((s) => s.hasLoaded);
  const isLoading = useDynamicDashboardStore((s) => s.isLoading);

  const { isHaConnected, isRos2Connected, isSdrConnected, fetchStatus } =
    useIntegrationStore();

  const activeIntegrations = useMemo(() => {
    const flags = [isHaConnected, isRos2Connected, isSdrConnected];
    return INTEGRATION_VIEW_IDS.filter((_, i) => flags[i]);
  }, [isHaConnected, isRos2Connected, isSdrConnected]);

  const k = activeIntegrations.length;
  const n = dashboards.length;
  const lastIdx = maxPanelIndex(k, dashboards);

  const panelIndex = useMemo(
    () =>
      panelIndexFromPath(
        location.pathname,
        location.search,
        dashboards,
        activeIntegrations,
      ),
    [location.pathname, location.search, dashboards, activeIntegrations],
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!hasLoaded && !isLoading) {
      loadDashboards();
    }
  }, [hasLoaded, isLoading, loadDashboards]);

  useEffect(() => {
    if (location.pathname !== "/dashboard") {
      return;
    }
    const view = new URLSearchParams(location.search).get("view") || "main";
    if (view === "main") {
      return;
    }
    const validIntegration = activeIntegrations.includes(
      view as DashboardMainPanelContentView,
    );
    if (!validIntegration) {
      navigate({ pathname: "/dashboard", search: "view=main" }, { replace: true });
    }
  }, [
    location.pathname,
    location.search,
    activeIntegrations,
    navigate,
  ]);

  useEffect(() => {
    if (!hasLoaded || isLoading) {
      return;
    }
    const m = location.pathname.match(/^\/dynamic-dashboard\/([^/]+)$/);
    if (!m || m[1] === "new") {
      return;
    }
    const exists = dashboards.some((d) => d.id === m[1]);
    if (!exists) {
      if (dashboards.length > 0) {
        navigate(`/dynamic-dashboard/${dashboards[0].id}`, { replace: true });
      } else {
        navigate("/dynamic-dashboard/new", { replace: true });
      }
    }
  }, [dashboards, hasLoaded, isLoading, location.pathname, navigate]);

  useEffect(() => {
    const m = location.pathname.match(/^\/dynamic-dashboard\/([^/]+)$/);
    if (m && m[1] !== "new") {
      setActiveDashboard(m[1]);
    }
  }, [location.pathname, setActiveDashboard]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) {
        setContainerWidth(w);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || containerWidth < 1) return;

    syncingRef.current = true;
    const target = panelIndex * containerWidth;
    el.scrollTo({ left: target, behavior: "auto" });

    const t = window.requestAnimationFrame(() => {
      syncingRef.current = false;
    });
    return () => window.cancelAnimationFrame(t);
  }, [panelIndex, containerWidth, location.pathname, location.search]);

  const resolveScrollToUrl = useCallback(() => {
    const el = scrollRef.current;
    if (!el || containerWidth < 1 || syncingRef.current) return;

    const idx = Math.round(el.scrollLeft / containerWidth);
    const clamped = Math.max(0, Math.min(lastIdx, idx));

    if (clamped === 0) {
      const viewParam = new URLSearchParams(location.search).get("view");
      const isMainView = viewParam === "main" || viewParam === null;
      if (location.pathname !== "/dashboard" || !isMainView) {
        navigate({ pathname: "/dashboard", search: "view=main" }, { replace: true });
      }
      return;
    }

    if (clamped >= 1 && clamped <= k) {
      const view = activeIntegrations[clamped - 1];
      const params = new URLSearchParams(location.search);
      if (
        location.pathname !== "/dashboard" ||
        params.get("view") !== view
      ) {
        navigate(
          { pathname: "/dashboard", search: `view=${view}` },
          { replace: true },
        );
      }
      return;
    }

    if (clamped === lastIdx) {
      if (location.pathname !== "/dynamic-dashboard/new") {
        navigate("/dynamic-dashboard/new", { replace: true });
      }
      return;
    }

    if (clamped >= k + 1 && clamped <= k + n) {
      const id = dashboards[clamped - k - 1]?.id;
      if (id && location.pathname !== `/dynamic-dashboard/${id}`) {
        navigate(`/dynamic-dashboard/${id}`, { replace: true });
      }
    }
  }, [
    activeIntegrations,
    containerWidth,
    dashboards,
    k,
    lastIdx,
    location.pathname,
    location.search,
    n,
    navigate,
  ]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      if (syncingRef.current) return;
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
      scrollEndTimerRef.current = setTimeout(() => {
        resolveScrollToUrl();
      }, 40);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, [resolveScrollToUrl]);

  return (
    <WebRTCProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className='flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden'>
          <DashboardSwipeHeader />
          <div
            ref={scrollRef}
            className='grid min-h-0 w-full max-w-full flex-1 basis-0 grid-flow-col auto-cols-[100%] grid-rows-[minmax(0,1fr)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scroll-behavior:auto]'
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <section
              className='box-border flex min-h-0 max-w-full min-w-0 snap-center snap-always flex-col overflow-hidden'
              aria-label='Main dashboard'
            >
              <DashboardMainPanel contentView='main' />
            </section>
            {activeIntegrations.map((view) => (
              <section
                key={view}
                className='box-border flex min-h-0 max-w-full min-w-0 snap-center snap-always flex-col overflow-hidden'
                aria-label={`Dashboard ${view}`}
              >
                <DashboardMainPanel contentView={view} />
              </section>
            ))}
            {dashboards.map((d) => (
              <section
                key={d.id}
                className='box-border flex min-h-0 max-w-full min-w-0 snap-center snap-always flex-col overflow-hidden'
                aria-label={`Dynamic dashboard ${d.name}`}
              >
                <DynamicDashboardMainPanel dashboardId={d.id} />
              </section>
            ))}
            <section
              className='box-border flex min-h-0 max-w-full min-w-0 snap-center snap-always flex-col overflow-hidden'
              aria-label='New dynamic dashboard'
            >
              <NewDynamicDashboardPanel />
            </section>
          </div>
          <Outlet />
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    </WebRTCProvider>
  );
}
