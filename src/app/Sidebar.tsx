import {
  BarChart3,
  BookOpen,
  GitBranch,
  GitCompare,
  GitMerge,
  GraduationCap,
  Layers,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Terminal,
  Trophy,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { LEVELS } from "@/content/lessons";
import type { LessonLevel } from "@/content/types";
import { cn } from "@/lib/cn";

type IconComponent = ComponentType<{ className?: string }>;

const LEVEL_ICONS: Record<LessonLevel, IconComponent> = {
  fundamentals: BookOpen,
  branching: GitBranch,
  conflicts: GitMerge,
  rebase: Layers,
  recovery: RotateCcw,
  advanced: Sparkles,
};

function NavItem({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string;
  icon: IconComponent;
  label: string;
  badge?: string;
}) {
  const location = useLocation();
  const [pathname, search] = to.split("?");
  const active =
    location.pathname === pathname && (search ? location.search === `?${search}` : true);

  return (
    <Link
      to={to}
      className={cn(
        "group flex h-8 items-center gap-2 rounded-md px-2 text-[12.5px] transition-colors",
        active ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-raised hover:text-fg",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-accent" : "text-fg-faint group-hover:text-fg-muted",
        )}
      />
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="ml-auto rounded bg-raised px-1 text-[10px] text-fg-faint">{badge}</span>
      ) : null}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="flex w-[228px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-12 items-center gap-2 px-4">
        <Logo size={22} />
        <span className="text-[13px] font-semibold tracking-[0.16em] text-fg">GITSCOPE</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <Section title="Workspace">
          <NavItem to="/explorer" icon={GitBranch} label="Repository Explorer" />
          <NavItem to="/analytics" icon={BarChart3} label="Analytics" badge="скоро" />
          <NavItem to="/search" icon={Search} label="Search" badge="скоро" />
          <NavItem to="/compare" icon={GitCompare} label="Compare" badge="скоро" />
        </Section>

        <Section title="Learn Git">
          {LEVELS.map((level) => (
            <NavItem
              key={level.id}
              to={`/learn?level=${level.id}`}
              icon={LEVEL_ICONS[level.id]}
              label={level.title}
            />
          ))}
        </Section>

        <Section title="Practice">
          <NavItem to="/playground" icon={Terminal} label="Playground" />
          <NavItem to="/challenges" icon={Trophy} label="Challenges" badge="скоро" />
          <NavItem to="/progress" icon={GraduationCap} label="Progress" />
        </Section>
      </nav>

      <div className="border-t border-line p-2">
        <NavItem to="/settings" icon={Settings} label="Настройки" />
      </div>
    </aside>
  );
}
