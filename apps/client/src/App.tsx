import { AuthPage } from "@/pages/auth";

import { createBrowserRouter, RouterProvider } from "react-router";
import {
  DashboardSwipeLayout,
  DashboardSwipeRoutePlaceholder,
} from "@/features/dashboard-swipe";
import { DevicePage } from "@/pages/devices";
import { FlowPage } from "@/pages/flow";
import { AuthInterceptor } from "@/features/auth";
import { NotFound } from "@/pages/notfound";
import LandingPage from "@/pages/landing";
import { MapPage } from "@/pages/map";
import { SetupPage } from "@/pages/setup";
import { CodePage } from "@/pages/code";
import { AuthenticatedLayout, TopBarWrapper } from "@/widgets/auth";
import { useDesktopSidecar } from "@/shared/lib/hooks/useDesktopSidecar";
import { usePreventBackNavigation } from "@/shared/lib/hooks/usePreventBackNavigation";
import {
  SettingsPage,
  AccountSettingsPage,
  ServicesSettingsPage,
  UsersSettingsPage,
  NetworksSettingsPage,
  IntegrationSettingsPage,
  LogSettingsPage,
  ConfigSettingsPage,
} from "@/pages/settings";
import { RecordingsPage } from "@/pages/recordings";
import { DesktopSettingsPage } from "@/pages/desktop-settings";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/auth",
    element: (
      <TopBarWrapper hide={true}>
        <AuthPage />
      </TopBarWrapper>
    ),
  },
  {
    element: <AuthenticatedLayout />,
    children: [
      {
        element: (
          <AuthInterceptor>
            <DashboardSwipeLayout />
          </AuthInterceptor>
        ),
        children: [
          {
            path: "/dashboard",
            element: <DashboardSwipeRoutePlaceholder />,
          },
          {
            path: "/dynamic-dashboard/new",
            element: <DashboardSwipeRoutePlaceholder />,
          },
          {
            path: "/dynamic-dashboard/:dashboardId",
            element: <DashboardSwipeRoutePlaceholder />,
          },
          {
            path: "/dynamic-dashboard",
            element: <DashboardSwipeRoutePlaceholder />,
          },
        ],
      },
      {
        path: "/devices",
        element: (
          <AuthInterceptor>
            <DevicePage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/flow",
        element: (
          <AuthInterceptor>
            <FlowPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/map",
        element: (
          <AuthInterceptor>
            <MapPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/setup",
        element: (
          <AuthInterceptor>
            <SetupPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings",
        element: (
          <AuthInterceptor>
            <SettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings/account",
        element: (
          <AuthInterceptor>
            <AccountSettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings/services",
        element: (
          <AuthInterceptor>
            <ServicesSettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings/users",
        element: (
          <AuthInterceptor>
            <UsersSettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings/networks",
        element: (
          <AuthInterceptor>
            <NetworksSettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings/integration",
        element: (
          <AuthInterceptor>
            <IntegrationSettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings/log",
        element: (
          <AuthInterceptor>
            <LogSettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/settings/config",
        element: (
          <AuthInterceptor>
            <ConfigSettingsPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/code",
        element: (
          <AuthInterceptor>
            <CodePage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/recordings",
        element: (
          <AuthInterceptor>
            <RecordingsPage />
          </AuthInterceptor>
        ),
      },
    ],
  },
  {
    path: "*",
    element: (
      <TopBarWrapper>
        <NotFound />
      </TopBarWrapper>
    ),
  },
]);

const isDesktopSettingsWindow = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "desktop_settings") return true;
    if (params.get("desktop_settings") === "1") return true;
    if (window.location.hash.includes("desktop_settings")) return true;
    return false;
  } catch {
    return false;
  }
};

function App() {
  useDesktopSidecar();
  usePreventBackNavigation();

  if (isDesktopSettingsWindow()) {
    return <DesktopSettingsPage />;
  }

  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
