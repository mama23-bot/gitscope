import { BarChart3, GitCompare, Search, Trophy } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export function AnalyticsPage() {
  return (
    <ComingSoon
      icon={<BarChart3 className="size-5" />}
      title="Аналитика репозитория"
      description="Метрики проекта и визуализации, которые помогают понять, как команда работает с кодом."
      bullets={[
        "Total commits, contributors, active days и merge ratio",
        "Contribution heatmap и график активности по неделям",
        "Branch lifespan и лидерборд авторов",
        "Code hotspots: файлы, которые меняются чаще всего",
      ]}
    />
  );
}

export function SearchPage() {
  return (
    <ComingSoon
      icon={<Search className="size-5" />}
      title="Поиск по истории"
      description="Единый поиск по коммитам, авторам, сообщениям и изменениям в файлах."
      bullets={[
        "Поиск по сообщению, автору и хешу",
        "Поиск по содержимому diff",
        "Фильтры по ветке, дате и типу изменения",
        "Переход к коммиту прямо в графе",
      ]}
    />
  );
}

export function ComparePage() {
  return (
    <ComingSoon
      icon={<GitCompare className="size-5" />}
      title="Сравнение коммитов"
      description="Diff-viewer для любых двух точек истории: веток, тегов или отдельных коммитов."
      bullets={[
        "Сравнение веток и тегов",
        "Выбор произвольных коммитов",
        "Статистика по файлам и строкам",
        "Удобный просмотр переименований",
      ]}
    />
  );
}

export function ChallengesPage() {
  return (
    <ComingSoon
      icon={<Trophy className="size-5" />}
      title="Challenges"
      description="Задания без подсказок и режим Recovery: сломанный репозиторий, который нужно восстановить."
      bullets={[
        "Восстановить удалённый коммит через reflog",
        "Убрать секрет из последнего коммита",
        "Разрешить merge-конфликт",
        "Перенести коммит через cherry-pick",
      ]}
    />
  );
}
