import { PropsWithChildren } from "react";
import { AuthPage } from "./pages/auth";

import { createBrowserRouter, RouterProvider } from "react-router";
import { DashboardPage } from "./pages/dashboard";
import { ServersPage } from "./pages/servers";
import { KeyPage } from "./pages/key";
import { DevicePage } from "./pages/devices";
import { TopBar } from "./features/topbar";
import { PageWrapper } from "./app/pageWrapper/page-wrapper";
import { FlowPage } from "./pages/flow";
import { AuthInterceptor } from "./features/auth/AuthInterceptor";
import { NotFound } from "./pages/notfound";
import LandingPage from "./pages/landing";
import { UsersPage } from "./pages/users";
import { LogPage } from "./pages/log";
import { MapPage } from "./pages/map";
import { isElectron } from "./lib/electron";

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
    path: "/dashboard",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <DashboardPage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
  },
  {
    path: "/servers",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <ServersPage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
  },
  {
    path: "/key",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <KeyPage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
  },
  {
    path: "/devices",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <DevicePage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
  },
  {
    path: "/flow",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <FlowPage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
  },
  {
    path: "/users",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <UsersPage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
  },
  {
    path: "/log",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <LogPage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
  },
  {
    path: "/map",
    element: (
      <TopBarWrapper>
        <AuthInterceptor>
          <MapPage />
        </AuthInterceptor>
      </TopBarWrapper>
    ),
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

interface TopBarWrapType extends PropsWithChildren {
  hide?: boolean;
}

function TopBarWrapper(props: TopBarWrapType) {
  if (isElectron()) {
    return (
      <>
        <PageWrapper>
          <TopBar hide={props.hide} />
          {props.children}
        </PageWrapper>
      </>
    );
  } else {
    return <PageWrapper>{props.children}</PageWrapper>;
  }
}

export default App;
