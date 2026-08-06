"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCreateFeedback } from "@/hooks/use-feedback";

export function FeedbackWidget({ pageId }: { pageId: string }) {
  const createFeedback = useCreateFeedback();
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleChoice(value: "yes" | "no") {
    setChoice(value);
    if (value === "yes") {
      createFeedback(pageId, true, null);
      setSubmitted(true);
    }
  }

  function handleSubmitComment() {
    createFeedback(pageId, false, comment.trim() || null);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className="mx-auto mt-8 flex max-w-reading-column items-center justify-center gap-2 p-6">
        <Check className="size-4 text-success" />
        <span className="text-body-sm text-muted-foreground">Terima kasih atas masukan Anda</span>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-8 max-w-reading-column p-8 text-center">
      <h3 className="text-h4 font-semibold text-foreground">Apakah halaman ini membantu?</h3>
      <div className="mt-4 flex items-center justify-center gap-3">
        <Button
          variant={choice === "yes" ? undefined : "secondary"}
          className={choice === "yes" ? "bg-primary-muted text-primary-muted-foreground hover:bg-primary-muted" : undefined}
          onClick={() => handleChoice("yes")}
          disabled={choice === "no"}
        >
          <ThumbsUp className="size-3.5" />
          Ya
        </Button>
        <Button
          variant="secondary"
          className={cn(choice === "no" && "bg-primary-muted text-primary-muted-foreground hover:bg-primary-muted", choice === "yes" && "opacity-40")}
          onClick={() => handleChoice("no")}
          disabled={choice === "yes"}
        >
          <ThumbsDown className="size-3.5" />
          Tidak
        </Button>
      </div>
      {choice === "no" && (
        <div className="mt-4 flex flex-col gap-2 text-left">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Apa yang bisa diperbaiki?"
            className="min-h-20"
          />
          <Button variant="secondary" onClick={handleSubmitComment} className="self-end">
            Kirim
          </Button>
        </div>
      )}
    </Card>
  );
}
