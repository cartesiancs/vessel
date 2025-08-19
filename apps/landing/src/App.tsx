import { createBrowserRouter, RouterProvider } from "react-router";
import LandingPage from "./pages/Main";
import RoadmapPage from "./pages/Roadmap";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/roadmap",
    element: <RoadmapPage />,
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
