import assert from "node:assert/strict";
import test from "node:test";
import { decideNextStep, type FailureReporter } from "../src/nonprofit_agent_loop.js";

test("a failed volunteer reminder is captured once and paused for review", async () => {
  const calls: Parameters<FailureReporter>[] = [];
  const reporter: FailureReporter = async (...args) => {
    calls.push(args);
    return { event_id: "event-lesson-17" };
  };

  const decision = await decideNextStep(
    {
      runId: "reading-coaches",
      kind: "volunteer_reminder",
      recordId: "volunteer-42",
      attempt: 2,
      delivery: "failed",
      failureMessage: "Reminder provider rejected the recipient",
    },
    reporter,
  );

  assert.deepEqual(decision, {
    action: "pause_for_review",
    recordId: "volunteer-42",
    eventId: "event-lesson-17",
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0].fingerprint, ["nonprofit-agent", "volunteer_reminder"]);
  assert.equal(calls[0][0].context.attempt, 2);
  assert.match(calls[0][1], /^[a-f0-9]{64}$/);
});

test("a sent donor receipt continues without reporting a failure", async () => {
  const reporter: FailureReporter = async () => {
    throw new Error("reporter should not be called");
  };
  const decision = await decideNextStep(
    {
      runId: "school-supplies",
      kind: "donor_receipt",
      recordId: "receipt-101",
      attempt: 0,
      delivery: "sent",
    },
    reporter,
  );
  assert.deepEqual(decision, { action: "continue", recordId: "receipt-101" });
});
