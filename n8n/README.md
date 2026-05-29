# n8n Workflow

`atlantico-preventivi-workflow.json` is the deployed prototype workflow.

Production webhook path:

```text
/webhook/atlantico-preventivi-prototype-20260529
```

The workflow currently:

- receives quote data from the prototype approval button
- recalculates line items, VAT, totals, and review flags
- returns a JSON quote payload when called from a server/client that can read the response

It does not send email or create Google Docs yet. That is the next implementation layer once Google credentials, Docs template IDs, and Gmail sending rules are finalized.
