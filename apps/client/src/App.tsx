import { AuthPage } from "./pages/auth";

import { createBrowserRouter, RouterProvider } from "react-router";
import {
  DashboardSwipeLayout,
  DashboardSwipeRoutePlaceholder,
} from "./features/dashboard-swipe/DashboardSwipeLayout";
import { ServersPage } from "./pages/servers";
import { DevicePage } from "./pages/devices";
import { FlowPage } from "./pages/flow";
import { AuthInterceptor } from "./features/auth/AuthInterceptor";
import { NotFound } from "./pages/notfound";
import LandingPage from "./pages/landing";
import { UsersPage } from "./pages/users";
import { LogPage } from "./pages/log";
import { MapPage } from "./pages/map";
import { IntegrationPage } from "./pages/integration";
import { SetupPage } from "./pages/setup";
import { CodePage } from "./pages/code";
import { AuthenticatedLayout } from "./widgets/auth/AuthenticatedLayout";
import { TopBarWrapper } from "./widgets/auth/TopBarWrapper";
import { useDesktopSidecar } from "./hooks/useDesktopSidecar";
import { usePreventBackNavigation } from "./hooks/usePreventBackNavigation";
import { SettingsPage } from "./pages/settings";
import { NetworksPage } from "./pages/networks";
import { RecordingsPage } from "./pages/recordings";
import { DesktopSettingsPage } from "./pages/desktop-settings";

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
        path: "/servers",
        element: (
          <AuthInterceptor>
            <ServersPage />
          </AuthInterceptor>
        ),
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
        path: "/users",
        element: (
          <AuthInterceptor>
            <UsersPage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/log",
        element: (
          <AuthInterceptor>
            <LogPage />
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
        path: "/integration",
        element: (
          <AuthInterceptor>
            <IntegrationPage />
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
        path: "/code",
        element: (
          <AuthInterceptor>
            <CodePage />
          </AuthInterceptor>
        ),
      },
      {
        path: "/networks",
        element: (
          <AuthInterceptor>
            <NetworksPage />
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
