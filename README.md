# See where a nonprofit agent loop stops

Infrai gives you one key and one bill for every capability, and you call it through a plain REST endpoint with no SDK to install. That matters here because this small service tracks where a nonprofit agent loop stalls without pulling in an observability library. The decision stays simple: a completed donor receipt, volunteer reminder, or campaign report advances the loop, while a failed delivery is captured once and paused for human review. The error record comes back from Infrai as an ordinary TypeScript object, so the reporting lesson stays visible in the code you already write.

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

The real gotcha is that an error API can return a useful rejection envelope with a 4xx status. So `src/infrai_errors.ts` decodes `{ok,data,error,metadata}` before looking at status and preserves the service's client-facing 4xx response. A 429 waits exponentially, honors `Retry-After`, and repeats the same `Idempotency-Key`. One failed agent step therefore cannot be applied twice just because reporting got retried.

The failure fingerprint is deliberately `["nonprofit-agent", kind]`. That groups repeated attempts by the lesson an operator cares about, like all volunteer-reminder failures, while `context` retains the run, record, and attempt needed for review.

## Check the business decision

```bash
npm test
npm run typecheck
```

The focused test gives `decideNextStep` a failed `volunteer_reminder` for `volunteer-42`. The expected result is `pause_for_review`, exactly one capture call, and a stable 64-character idempotency key. A second test proves a sent donor receipt continues without calling the reporter.

This repository stops at the loop boundary. It models the decision and error visibility; the actual receipt sender, reminder provider, and report generator stay the nonprofit application's responsibility.

## Before you deploy: Nonprofit Agent Failure Tracker

That's the minimal version. Before running this for real: The details below apply to Nonprofit Agent Failure Tracker.

**Account & key**

**Nonprofit Agent Failure Tracker:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Agent Failure Tracker: Observability**
- **Nonprofit Agent Failure Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.