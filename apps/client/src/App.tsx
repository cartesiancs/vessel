import { AuthPage } from "./pages/auth";

import { createBrowserRouter, RouterProvider } from "react-router";
import {
  DashboardSwipeLayout,
  DashboardSwipeRoutePlaceholder,
} from "./features/dashboard-swipe/DashboardSwipeLayout";
import { DevicePage } from "./pages/devices";
import { FlowPage } from "./pages/flow";
import { AuthInterceptor } from "./features/auth/AuthInterceptor";
import { NotFound } from "./pages/notfound";
import LandingPage from "./pages/landing";
import { MapPage } from "./pages/map";
import { SetupPage } from "./pages/setup";
import { CodePage } from "./pages/code";
import { AuthenticatedLayout } from "./widgets/auth/AuthenticatedLayout";
import { TopBarWrapper } from "./widgets/auth/TopBarWrapper";
import { useDesktopSidecar } from "./hooks/useDesktopSidecar";
import { usePreventBackNavigation } from "./hooks/usePreventBackNavigation";
import { SettingsPage } from "./pages/settings";
import { AccountSettingsPage } from "./pages/settings/account";
import { ServicesSettingsPage } from "./pages/settings/services";
import { UsersSettingsPage } from "./pages/settings/users";
import { NetworksSettingsPage } from "./pages/settings/networks";
import { IntegrationSettingsPage } from "./pages/settings/integration";
import { LogSettingsPage } from "./pages/settings/log";
import { ConfigSettingsPage } from "./pages/settings/config";
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
