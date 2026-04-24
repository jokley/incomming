import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Athletes } from "./components/Athletes";
import { Hotels } from "./components/Hotels";
import { Assignments } from "./components/Assignments";
import { Events } from "./components/Events";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "athletes", Component: Athletes },
      { path: "hotels", Component: Hotels },
      { path: "assignments", Component: Assignments },
      { path: "events", Component: Events },
    ],
  },
]);
