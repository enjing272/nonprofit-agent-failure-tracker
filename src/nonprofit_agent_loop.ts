import { createHash } from "node:crypto";
import type { CaptureException, CapturedError } from "./infrai_errors.js";

export type NonprofitTask = {
  runId: string;
  kind: "donor_receipt" | "volunteer_reminder" | "campaign_report";
  recordId: string;
  attempt: number;
  delivery: "sent" | "failed";
  failureMessage?: string;
};

export type FailureReporter = (
  payload: CaptureException,
  idempotencyKey: string,
) => Promise<CapturedError>;

export type LoopDecision =
  | { action: "continue"; recordId: string }
  | { action: "pause_for_review"; recordId: string; eventId?: string };

function captureKey(task: NonprofitTask): string {
  return createHash("sha256")
    .update(`${task.runId}:${task.kind}:${task.recordId}:${task.attempt}`)
    .digest("hex");
}

export async function decideNextStep(
  task: NonprofitTask,
  reportFailure: FailureReporter,
): Promise<LoopDecision> {
  if (task.delivery === "sent") {
    return { action: "continue", recordId: task.recordId };
  }

  const result = await reportFailure(
    {
      title: `${task.kind} agent step failed`,
      message: task.failureMessage ?? "Delivery did not complete",
      level: "error",
      fingerprint: ["nonprofit-agent", task.kind],
      exception: task.failureMessage ?? "Delivery did not complete",
      context: {
        run_id: task.runId,
        record_id: task.recordId,
        task_kind: task.kind,
        attempt: task.attempt,
      },
    },
    captureKey(task),
  );

  return {
    action: "pause_for_review",
    recordId: task.recordId,
    eventId: result.event_id,
  };
}
