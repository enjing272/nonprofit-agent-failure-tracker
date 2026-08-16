import { decideNextStep } from "./nonprofit_agent_loop.js";
import { captureAgentFailure } from "./infrai_errors.js";

const decision = await decideNextStep(
  {
    runId: "autumn-course-drive",
    kind: "campaign_report",
    recordId: "report-week-04",
    attempt: 1,
    delivery: "sent",
  },
  captureAgentFailure,
);

console.log(decision);
