import { Link } from "react-router-dom";
import { Button, EmptyState } from "@/components/ui";

export function NotFoundPage() {
  return (
    <EmptyState
      title="Страница не найдена"
      description="Такого раздела в GitScope пока нет."
      action={
        <Link to="/explorer">
          <Button>В Repository Explorer</Button>
        </Link>
      }
    />
  );
}
