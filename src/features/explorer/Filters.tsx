import { Search, X } from "lucide-react";
import { Button } from "@/components/ui";

export interface ExplorerFilters {
  search: string;
  author: string;
  branch: string;
}

export function Filters({
  filters,
  authors,
  branches,
  onChange,
}: {
  filters: ExplorerFilters;
  authors: string[];
  branches: string[];
  onChange: (filters: ExplorerFilters) => void;
}) {
  const hasFilters = Boolean(filters.search || filters.author || filters.branch);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" />
        <input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Сообщение, автор или хеш"
          className="h-7 w-56 rounded-md border border-line bg-canvas pl-7 pr-2 text-xs text-fg placeholder:text-fg-faint focus:border-accent/60 focus:outline-none"
        />
      </div>

      <select
        value={filters.author}
        onChange={(event) => onChange({ ...filters, author: event.target.value })}
        className="h-7 max-w-36 rounded-md border border-line bg-canvas px-1.5 text-xs text-fg-muted focus:border-accent/60 focus:outline-none"
      >
        <option value="">Все авторы</option>
        {authors.map((author) => (
          <option key={author} value={author}>
            {author}
          </option>
        ))}
      </select>

      <select
        value={filters.branch}
        onChange={(event) => onChange({ ...filters, branch: event.target.value })}
        className="h-7 max-w-36 rounded-md border border-line bg-canvas px-1.5 text-xs text-fg-muted focus:border-accent/60 focus:outline-none"
      >
        <option value="">Все ветки</option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
      </select>

      {hasFilters ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<X className="size-3.5" />}
          onClick={() => onChange({ search: "", author: "", branch: "" })}
        >
          Сбросить
        </Button>
      ) : null}
    </div>
  );
}
