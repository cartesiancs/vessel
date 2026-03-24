import { Footer } from "@/features/footer";
import { AppSidebar } from "@/features/sidebar";
import { WebRTCProvider } from "@/features/rtc/WebRTCProvider";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { DashboardMainPanel } from "@/pages/dashboard";
import {
  DynamicDashboardMainPanel,
  NewDynamicDashboardPanel,
} from "@/pages/dynamic-dashboard";
import type { DynamicDashboard } from "@/entities/dynamic-dashboard/store";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

/** Child route element so nested paths match without rendering extra UI. */
export function DashboardSwipeRoutePlaceholder() {
  return null;
}

function lastPanelIndex(dashboards: DynamicDashboard[]): number {
  return dashboards.length + 1;
}

function panelIndexFromPath(
  pathname: string,
  dashboards: DynamicDashboard[],
): number {
  const n = dashboards.length;
  const lastIdx = lastPanelIndex(dashboards);

  if (pathname === "/dashboard") {
    return 0;
  }
  if (pathname === "/dynamic-dashboard/new") {
    return lastIdx;
  }
  if (pathname === "/dynamic-dashboard") {
    return n > 0 ? 1 : lastIdx;
  }
  const prefix = "/dynamic-dashboard/";
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    if (rest === "new") {
      return lastIdx;
    }
    const i = dashboards.findIndex((d) => d.id === rest);
    if (i >= 0) {
      return 1 + i;
    }
  }
  return 0;
}

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

  const panelIndex = useMemo(
    () => panelIndexFromPath(location.pathname, dashboards),
    [location.pathname, dashboards],
  );

  const maxPanelIndex = lastPanelIndex(dashboards);

  useEffect(() => {
    if (!hasLoaded && !isLoading) {
      loadDashboards();
    }
  }, [hasLoaded, isLoading, loadDashboards]);

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
    el.scrollTo({ left: target, behavior: "smooth" });

    const t = window.setTimeout(() => {
      syncingRef.current = false;
    }, 420);
    return () => window.clearTimeout(t);
  }, [panelIndex, containerWidth, location.pathname]);

  const resolveScrollToUrl = useCallback(() => {
    const el = scrollRef.current;
    if (!el || containerWidth < 1 || syncingRef.current) return;

    const idx = Math.round(el.scrollLeft / containerWidth);
    const clamped = Math.max(0, Math.min(maxPanelIndex, idx));

    if (clamped === 0 && location.pathname !== "/dashboard") {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (clamped === maxPanelIndex) {
      if (location.pathname !== "/dynamic-dashboard/new") {
        navigate("/dynamic-dashboard/new", { replace: true });
      }
      return;
    }
    if (clamped >= 1 && clamped <= dashboards.length) {
      const id = dashboards[clamped - 1]?.id;
      if (id && location.pathname !== `/dynamic-dashboard/${id}`) {
        navigate(`/dynamic-dashboard/${id}`, { replace: true });
      }
    }
  }, [
    containerWidth,
    dashboards,
    location.pathname,
    maxPanelIndex,
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
      }, 120);
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
          <div
            ref={scrollRef}
            className='grid min-h-0 w-full max-w-full flex-1 basis-0 grid-flow-col auto-cols-[100%] grid-rows-[minmax(0,1fr)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth overscroll-x-contain'
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <section
              className='box-border flex min-h-0 max-w-full min-w-0 snap-center snap-always flex-col overflow-hidden'
              aria-label='Main dashboard'
            >
              <DashboardMainPanel />
            </section>
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
