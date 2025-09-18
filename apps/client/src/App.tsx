import { AuthPage } from "./pages/auth";

import { createBrowserRouter, RouterProvider } from "react-router";
import { DashboardPage } from "./pages/dashboard";
import { ServersPage } from "./pages/servers";
import { KeyPage } from "./pages/key";
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
        path: "/dashboard",
        element: (
          <AuthInterceptor>
            <DashboardPage />
          </AuthInterceptor>
        ),
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
        path: "/key",
        element: (
          <AuthInterceptor>
            <KeyPage />
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
        path: "/code",
        element: (
          <AuthInterceptor>
            <CodePage />
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

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
