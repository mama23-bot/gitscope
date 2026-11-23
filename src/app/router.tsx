import { createHashRouter, Navigate } from "react-router-dom";
import { ExplorerPage } from "@/features/explorer/ExplorerPage";
import { LearnPage } from "@/features/learn/LearnPage";
import { LessonPage } from "@/features/learn/LessonPage";
import {
  AnalyticsPage,
  ChallengesPage,
  ComparePage,
  SearchPage,
} from "@/features/placeholders/PlaceholderPages";
import { NotFoundPage } from "@/features/placeholders/NotFoundPage";
import { PlaygroundPage } from "@/features/playground/PlaygroundPage";
import { ProgressPage } from "@/features/progress/ProgressPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AppLayout } from "./AppLayout";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/explorer" replace /> },
      { path: "explorer", element: <ExplorerPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "search", element: <SearchPage /> },
      { path: "compare", element: <ComparePage /> },
      { path: "learn", element: <LearnPage /> },
      { path: "learn/:lessonId", element: <LessonPage /> },
      { path: "playground", element: <PlaygroundPage /> },
      { path: "challenges", element: <ChallengesPage /> },
      { path: "progress", element: <ProgressPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
