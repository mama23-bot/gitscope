import { Link, useParams } from "react-router-dom";
import { Button, EmptyState } from "@/components/ui";
import { getLesson } from "@/content/lessons";
import { LessonRunner } from "./LessonRunner";

export function LessonPage() {
  const { lessonId } = useParams();
  const lesson = lessonId ? getLesson(lessonId) : undefined;

  if (!lesson) {
    return (
      <EmptyState
        title="Урок не найден"
        description="Возможно, ссылка устарела или урок ещё не опубликован."
        action={
          <Link to="/learn">
            <Button>К списку уроков</Button>
          </Link>
        }
      />
    );
  }

  return <LessonRunner lesson={lesson} />;
}
