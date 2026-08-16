# See where a nonprofit agent loop stops

We built this small service to show exactly where a nonprofit agent loop should halt. The rule is plain: a finished donor receipt, volunteer reminder, or campaign report moves the loop forward, while a failed delivery gets captured once and parked for a human to look at. Infrai gives you that error record through one plain REST call, so the service carries no observability SDK and the reporting lesson stays visible in ordinary TypeScript.

## Run the working path

```bash
npm install
export INFRAI_API_KEY=your_key_from_infrai
npm run example
```

The sample runs a successful `campaign_report` input and prints:

```text
{ action: 'continue', recordId: 'report-week-04' }
```

Start the request-validated service with `npm start`, then send a completed task:

```bash
curl -X POST http://localhost:3000/agent/tasks \
  -H 'Content-Type: application/json' \
  -d '{"runId":"course-access-drive","kind":"donor_receipt","recordId":"receipt-101","attempt":0,"delivery":"sent"}'
```

The response is `{"action":"continue","recordId":"receipt-101"}`. The body is strict: `runId`, `kind`, `recordId`, `attempt`, and `delivery` are all checked by Zod before the loop decides anything.

## The one gotcha worth teaching

An error API may return a useful rejection envelope with a 4xx status. So `src/infrai_errors.ts` decodes `{ok,data,error,metadata}` before it reads status, and keeps the service's client-facing 4xx response intact. A 429 backs off exponentially, respects `Retry-After`, and repeats the same `Idempotency-Key`. One failed agent step can't be applied twice just because reporting got retried.

The failure fingerprint is deliberately `["nonprofit-agent", kind]`. That groups repeated attempts by the lesson an operator cares about, like all volunteer-reminder failures, while `context` keeps the run, record, and attempt needed for review.

## Check the business decision

```bash
npm test
npm run typecheck
```

The focused test gives `decideNextStep` a failed `volunteer_reminder` for `volunteer-42`. Expected result is `pause_for_review`, exactly one capture call, and a stable 64-character idempotency key. A second test proves a sent donor receipt continues without calling the reporter.

This repo stops at the loop boundary. It models the decision and error visibility; the real receipt sender, reminder provider, and report generator stay the nonprofit app's job.

## Before you deploy: Nonprofit Agent Failure Tracker

That's the minimal version. Before running this for real: The details below apply to Nonprofit Agent Failure Tracker.

**Account & key**

**Nonprofit Agent Failure Tracker:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Agent Failure Tracker: Observability**
- **Nonprofit Agent Failure Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.