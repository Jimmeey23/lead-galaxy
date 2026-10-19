# Lead conversion rule

Version: `member-eligible-sale-v1`

A lead is Converted only if at least one Sales row meets all of these conditions:

1. Nonempty Member ID exactly matches the lead's Member ID. Email is not a fallback.
2. Payment Status is Succeeded, Sec. Is Voided is not TRUE, and Payment Value is positive.
3. Payment Date is on a calendar date strictly after the lead's Created At date. The lead source currently provides date-only creation values; same-day purchases therefore do not qualify.
4. The purchase is not Retail or a Money Credits product.
5. The membership/product name does not contain 2 For 1, Intro Pack, Copper & Cloves Single Class Package, or Copper + Cloves Credit. Matching ignores case and normalizes whitespace, punctuation, hyphens, `&`, and `+`.

Name/category checks use Cleaned Category, Cleaned Product, Payment Item and Sec. Membership Name. At implementation, Sec. Membership Name is blank (`-`) throughout the current source, so Payment Item and Cleaned Product supply the product identity. Money-credit products are excluded; use of money credits as payment tender does not itself exclude an otherwise eligible membership purchase.

The earliest qualifying sale determines Converted At and days to conversion. Source conversion labels and dates are retained as raw evidence only. The flag, display status, date, KPI, filters, exports and drilldowns all consume the same calculated result. Conversion status is not manually editable.

A successfully read Sales source with no qualifying match produces Not Converted. Source/schema failures leave conversion Unverified and expose an enrichment warning. Cached data is versioned to avoid retaining earlier conversion rules after deployment.

This rule governs conversion eligibility. Existing total purchases, lifetime sales value and attendance measures retain their separate scopes; an unconverted lead may legitimately have purchases or revenue from excluded products or dates.

Validation:

- `node scripts/test-conversion.cjs`
- `npm run typecheck`
- Independent source reconciliation on 19 October 2026: 2,701 conversions / 25,463 leads (10.61%) all time; 2 / 99 (2.02%) for leads created 13–19 October 2026. These are snapshot results, not fixed targets.
- Converted drilldown: 2,701 rows, agreeing with the KPI; manual status override rejected with HTTP 400 before contacting Momence.
