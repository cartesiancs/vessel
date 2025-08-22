import { createBrowserRouter, RouterProvider } from "react-router";
import LandingPage from "./pages/Main";
import RoadmapPage from "./pages/Roadmap";
import UsecasePage from "./pages/UseCase";

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
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
