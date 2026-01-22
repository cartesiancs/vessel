import { createBrowserRouter, RouterProvider } from "react-router";
import LandingPage from "./pages/Main";
import RoadmapPage from "./pages/Roadmap";
import UsecasePage from "./pages/UseCase";
import { PrivacyPage } from "./pages/Privacy";
import PricingPage from "./pages/Pricing";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import CheckoutSuccessPage from "./pages/CheckoutSuccess";
import { Toaster } from "sonner";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/roadmap",
    element: <RoadmapPage />,
  },
  {
    path: "/usecase",
    element: <UsecasePage />,
  },
  {
    path: "/privacy",
    element: <PrivacyPage />,
  },
  {
    path: "/pricing",
    element: <PricingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/dashboard",
    element: <DashboardPage />,
  },
  {
    path: "/checkout/success",
    element: <CheckoutSuccessPage />,
  },
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

export default App;
