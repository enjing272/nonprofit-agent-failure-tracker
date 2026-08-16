import { createServer } from "node:http";
import { z } from "zod";
import { captureAgentFailure, InfraiError } from "./infrai_errors.js";
import { decideNextStep, type NonprofitTask } from "./nonprofit_agent_loop.js";

const taskSchema = z
  .object({
    runId: z.string().min(1),
    kind: z.enum(["donor_receipt", "volunteer_reminder", "campaign_report"]),
    recordId: z.string().min(1),
    attempt: z.number().int().nonnegative(),
    delivery: z.enum(["sent", "failed"]),
    failureMessage: z.string().min(1).optional(),
  })
  .strict();

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/agent/tasks") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const parsed = taskSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      sendJson(response, 400, { error: "Invalid task body", issues: parsed.error.issues });
      return;
    }
    const task = parsed.data as NonprofitTask;
    const decision = await decideNextStep(task, captureAgentFailure);
    sendJson(response, 200, decision);
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be JSON" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.message, code: error.code });
      return;
    }
    sendJson(response, 502, { error: "Failure reporting could not complete" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Nonprofit agent service listening on http://localhost:${port}`));
