# Lead conversion rule

Version: `member-eligible-sale-v3`

A lead is Converted only if at least one Sales row meets all of these conditions:

1. Nonempty Member ID exactly matches the lead's Member ID. Email is not a fallback.
2. Payment Status is Succeeded, Sec. Is Voided is not TRUE, and Payment Value is positive.
3. Payment Date is on a calendar date on or after the lead's Created At date. Same-day purchases qualify.
4. The purchase is not Retail or a Money Credits product.
5. The membership/product name does not contain 2 For 1, Intro Pack, Copper & Cloves Single Class Package, or Copper + Cloves Credit. Matching ignores case and normalizes whitespace, punctuation, hyphens, `&`, and `+`.

Name/category checks use Cleaned Category, Cleaned Product, Payment Item and Sec. Membership Name. At implementation, Sec. Membership Name is blank (`-`) throughout the current source, so Payment Item and Cleaned Product supply the product identity. Money-credit products are excluded; use of money credits as payment tender does not itself exclude an otherwise eligible membership purchase.

The earliest qualifying sale determines Converted At and days to conversion. Source conversion labels and dates are retained as raw evidence only. The flag, display status, date, KPI, filters, exports and drilldowns all consume the same calculated result. Conversion status is not manually editable.

A successfully read Sales source with no qualifying match produces Not Converted. Source/schema failures leave conversion Unverified and expose an enrichment warning. Cached data is versioned to avoid retaining earlier conversion rules after deployment.

This rule governs conversion eligibility. Existing total purchases, lifetime sales value and attendance measures retain their separate scopes; an unconverted lead may legitimately have purchases or revenue from excluded products or dates.

Validation:

- `node scripts/test-conversion.cjs`
- `npm run typecheck`
- Source reconciliation must use the current rule version, which includes same-day purchases. Previous strictly-later-day snapshot counts are superseded.
- Conversion and trial statuses are derived and cannot be manually overridden.

## Trial completion and Won

Trial Completed requires an exact Member ID match with a Check-ins row where Checked In is TRUE and Date (IST) is on or after lead creation. Product names, complimentary status, email matches and source trial labels do not establish attendance. The first qualifying date is saved as Trial Completed At. A Check-ins source failure produces Unverified attendance, not a confirmed Not Tried result.

Won is a separate stage-based measure: Stage Name equals Membership Sold, ignoring case and repeated whitespace. A Won lead can remain unconverted if its purchases do not meet the eligible-sales rule. Current source Status is retained in rawStatus for provenance.

Pattern intelligence uses transparent review rules for stage/evidence conflicts, repeated and templated comments, date sequencing, incomplete outcomes and attendance/comment conflicts. Findings include counts, affected IDs, owner-normalized rates and up to 100 evidence examples per finding. They do not prove that a copied template or stage is incorrect.
