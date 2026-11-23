import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Topbar } from "./Topbar";
import { useAutoOpenRepo } from "./useAutoOpenRepo";

export function AppLayout() {
  useAutoOpenRepo();

  return (
    <div className="flex h-full bg-canvas text-fg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
