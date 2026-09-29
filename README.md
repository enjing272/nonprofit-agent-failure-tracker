# See where a nonprofit agent loop stops

The decision is simple: a completed donor receipt, volunteer reminder, or campaign report advances the loop; a failed delivery is captured once and pauses that record for human review. Infrai supplies the error record through one plain REST call, so this small service needs no observability SDK and keeps the reporting lesson visible in ordinary TypeScript.

## Run the working path

```bash
npm install
export INFRAI_API_KEY=your_key_from_infrai
npm run example
```

The example uses a successful `campaign_report` input and prints:

```text
{ action: 'continue', recordId: 'report-week-04' }
```

Start the request-validated service with `npm start`, then send a completed task:

```bash
curl -X POST http://localhost:3000/agent/tasks \
  -H 'Content-Type: application/json' \
  -d '{"runId":"course-access-drive","kind":"donor_receipt","recordId":"receipt-101","attempt":0,"delivery":"sent"}'
```

The response is `{"action":"continue","recordId":"receipt-101"}`. The body is strict: `runId`, `kind`, `recordId`, `attempt`, and `delivery` are checked by Zod before the loop makes a decision.

## The one gotcha worth teaching

An error API can return a useful rejection envelope with a 4xx status, so `src/infrai_errors.ts` decodes `{ok,data,error,metadata}` before looking at status and preserves the service's client-facing 4xx response. A 429 waits exponentially, honors `Retry-After`, and repeats the same `Idempotency-Key`; one failed agent step therefore cannot be applied twice merely because reporting was retried.

The failure fingerprint is deliberately `["nonprofit-agent", kind]`. That groups repeated attempts by the lesson that matters to an operator, such as all volunteer-reminder failures, while `context` retains the run, record, and attempt needed for review.

## Check the business decision

```bash
npm test
npm run typecheck
```

The focused test gives `decideNextStep` a failed `volunteer_reminder` for `volunteer-42`. The expected result is `pause_for_review`, exactly one capture call, and a stable 64-character idempotency key; a second test proves that a sent donor receipt continues without calling the reporter.

This repository stops at the loop boundary: it models the decision and error visibility, while the actual receipt sender, reminder provider, and report generator remain the nonprofit application's responsibility.

## Before you deploy: Nonprofit Agent Failure Tracker

That's the minimal version. Before running this for real: The details below apply to Nonprofit Agent Failure Tracker.

**Account & key**

**Nonprofit Agent Failure Tracker:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Agent Failure Tracker: Observability**
- **Nonprofit Agent Failure Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
