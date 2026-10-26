import type { Lead } from "./types";

export type PatternFinding = {
  id: string; title: string; severity: "high" | "medium"; count: number; share: number;
  explanation: string; action: string;
  owners: {name:string;affected:number;population:number;rate:number}[];
  evidence: { leadId: string; name: string; associate: string; detail: string }[];
};
const textKey = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Review signals, not accusations: every finding carries the observed evidence. */
export function inspectLeadPatterns(leads: Lead[], today: string): PatternFinding[] {
  const definitions: [string, string, PatternFinding["severity"], string, string][] = [
    ["sold-without-sale", "Membership Sold without eligible sale", "high", "Stage says Membership Sold, but the current conversion rule has no eligible sale evidence. Introductory or excluded purchases may explain this.", "Review the sale and stage; distinguish Won from eligible paid conversion."],
    ["paid-stage-lag", "Eligible purchase not reflected in stage", "high", "Eligible paid conversion is verified, but the stage has not been set to Membership Sold.", "Check ownership and reconcile the stage with the verified purchase."],
    ["closed-after-sale", "Closed or negative stage despite conversion", "high", "A converted lead remains in a lost, disqualified, unresponsive or not-interested stage. This is a review signal, not proof the latest stage is wrong.", "Review the latest conversation and purchase timeline before correcting the stage."],
    ["trial-stage-mismatch", "Trial Completed stage without attendance evidence", "high", "The stage claims a completed trial but no qualifying checked-in visit was found for the same Member ID on or after creation.", "Check Member ID, visit date and attendance sync before editing the stage."],
    ["attended-stage-lag", "Attendance recorded while stage remains early", "medium", "A qualifying visit is verified, but the stage remains New Enquiry, Initial Contact or Trial Scheduled.", "Update the stage after confirming the current member journey."],
    ["shared-comments", "Repeated comments across different leads", "medium", "The same normalized comment of at least 35 characters appears on three or more distinct leads. Shared templates may be legitimate; personalization needs review.", "Review the quoted text and member-specific outcome; do not assume misconduct or delete records automatically."],
    ["template-comments", "Similar comment templates across leads", "medium", "Long notes become identical after removing the relevant member name and numbers. This suggests template reuse, not necessarily an incorrect conversation record.", "Check whether the member response, outcome and next action were personalized."],
    ["repeated-steps", "Repeated wording across follow-up steps", "medium", "At least two follow-up slots for one lead contain the same normalized comment of at least 20 characters.", "Confirm each step records a distinct contact attempt, outcome and next action."],
    ["date-sequence", "Follow-up dates need correction", "high", "A recorded date is before lead creation, in the future, or earlier than a preceding recorded step.", "Verify the date against the contact record; keep planned next contact separate from completed follow-up."],
    ["missing-date", "Follow-up comment without a date", "medium", "A follow-up has a comment but no date; it counts as recorded activity but cannot establish cadence completion.", "Add the actual contact date after checking the record."],
    ["weak-comments", "Follow-up notes lack an actionable outcome", "medium", "A dated follow-up has no comment, a very short generic note, or an unfilled template placeholder.", "Document member response, outcome and the next agreed action."],
    ["comment-attendance", "Comment and attendance evidence disagree", "medium", "A note says the trial/class was completed but no qualifying checked-in visit exists. Missing attendance data can also explain this.", "Review the dated note alongside Check-ins and the Member ID."],
    ["recovery", "Attended but not yet converted", "medium", "A qualifying checked-in visit exists without an eligible post-creation purchase or Membership Sold stage.", "Review the member's stated barrier and arrange a relevant next touchpoint; scores are not purchase probabilities."],
  ];
  const cases = new Map<string, Map<string, {lead: Lead; details: string[]}>>();
  const add = (kind: string, lead: Lead, detail: string) => {
    if (!cases.has(kind)) cases.set(kind, new Map());
    const previous = cases.get(kind)!.get(lead.id);
    if (previous) { if (previous.details.length < 3) previous.details.push(detail); }
    else cases.get(kind)!.set(lead.id, {lead, details: [detail]});
  };
  const templates = new Map<string, {lead:Lead;index:number;comment:string}[]>();
  const ownerPopulation = new Map<string,number>();
  for (const lead of leads) ownerPopulation.set(lead.associate,(ownerPopulation.get(lead.associate) ?? 0)+1);
  const shared = new Map<string, {lead: Lead; index: number; comment: string}[]>();
  for (const lead of leads) {
    const stage = textKey(lead.stageName);
    const verified = lead.conversionStatus !== "Unverified";
    if (lead.won && !lead.converted && verified) add("sold-without-sale", lead, `Stage: ${lead.stageName}; eligible conversion: Not Converted`);
    if (lead.converted && !lead.won) add("paid-stage-lag", lead, `Stage: ${lead.stageName}; eligible purchase: ${lead.convertedAt}`);
    if (lead.converted && /not interested|lost|disqualified|unresponsive/.test(stage)) add("closed-after-sale", lead, `Stage: ${lead.stageName}; purchase: ${lead.convertedAt}`);
    if (/trial completed/.test(stage) && !lead.tried && lead.trialStatus !== "Unverified") add("trial-stage-mismatch", lead, `Stage: ${lead.stageName}; attendance: ${lead.trialStatus}`);
    if (lead.tried && /^(new enquiry|initial contact|trial scheduled)$/.test(stage)) add("attended-stage-lag", lead, `Stage: ${lead.stageName}; first qualifying visit: ${lead.trialCompletedAt}`);
    if (lead.tried && !lead.converted && !lead.won) add("recovery", lead, `Checked-in visit: ${lead.trialCompletedAt}; no eligible purchase; owner: ${lead.associate}`);
    let previous: string | null = null;
    const local = new Map<string, number>();
    const ownNames = textKey(lead.fullName).split(" ").filter((token)=>token.length>=3);
    lead.followUps.forEach((fu, index) => {
      const key = textKey(fu.comment);
      if (fu.date && (fu.date > today || (lead.createdAt && fu.date < lead.createdAt) || (previous && fu.date < previous))) add("date-sequence", lead, `FU${index+1}: ${fu.date}; created: ${lead.createdAt}; prior recorded step: ${previous ?? "none"}`);
      if (fu.date) previous = fu.date;
      if (fu.comment && !fu.date) add("missing-date", lead, `FU${index+1}: “${fu.comment.slice(0,160)}”`);
      if (fu.date && (!key || key.length < 8 || /^(done|called|follow up|sent message|test)$/.test(key) || /\{\{?\w+\}?\}|\[(?:name|member|client|date)\]/i.test(fu.comment))) add("weak-comments", lead, `FU${index+1} (${fu.date}): “${fu.comment.slice(0,160) || "No outcome recorded"}”`);
      if (key.length >= 20 && local.has(key)) add("repeated-steps", lead, `FU${local.get(key)!+1} and FU${index+1}: “${fu.comment.slice(0,160)}”`);
      if (key) local.set(key,index);
      const templateKey = key.split(" ").filter((token)=>!ownNames.includes(token)).join(" ").replace(/\d+/g,"#");
      if (templateKey.length>=50) { const items=templates.get(templateKey) ?? []; items.push({lead,index,comment:fu.comment}); templates.set(templateKey,items); }
      if (key.length >= 35) {
        const items = shared.get(key) ?? []; items.push({lead,index,comment:fu.comment}); shared.set(key,items);
      }
      if (/\b(?:trial|class|session) (?:completed|attended)\b/.test(key) && !/not (?:completed|attended)|did not|didnt/.test(key) && !lead.tried && lead.trialStatus !== "Unverified") add("comment-attendance", lead, `FU${index+1} (${fu.date ?? "undated"}): “${fu.comment.slice(0,160)}”; no qualifying attendance`);
    });
  }
  for (const items of shared.values()) {
    const distinct = new Set(items.map((item)=>item.lead.id)).size;
    if (distinct < 3) continue;
    for (const item of items) add("shared-comments",item.lead,`FU${item.index+1}; shared across ${distinct} leads: “${item.comment.slice(0,160)}”`);
  }
  for (const items of templates.values()) {
    const distinct = new Set(items.map((item)=>item.lead.id)).size;
    if (distinct<3 || new Set(items.map((item)=>textKey(item.comment))).size<2) continue;
    for (const item of items) add("template-comments",item.lead,`FU${item.index+1}; similar wording across ${distinct} leads: “${item.comment.slice(0,160)}”`);
  }
  return definitions.flatMap(([id,title,severity,explanation,action])=> {
    const values = [...(cases.get(id)?.values() ?? [])];
    const ownerCounts=new Map<string,number>();
    for (const {lead} of values) ownerCounts.set(lead.associate,(ownerCounts.get(lead.associate) ?? 0)+1);
    const owners=[...ownerCounts].map(([name,affected])=>({name,affected,population:ownerPopulation.get(name) ?? 0,rate:affected/(ownerPopulation.get(name) || 1)*100})).sort((a,b)=>b.affected-a.affected);
    return values.length ? [{id,title,severity,explanation,action,count:values.length,share: leads.length ? values.length/leads.length*100 : 0,
      owners, evidence:values.slice(0,100).map(({lead,details})=>({leadId:lead.id,name:lead.fullName,associate:lead.associate,detail:details.join(" · ")}))}] : [];
  });
}
