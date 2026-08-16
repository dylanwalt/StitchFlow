import type { SubjectCode } from "./types";

export type AnalysisPriority = "high" | "medium" | "supporting";

export interface StudyInsight {
  id: string;
  scope: string;
  priority: AnalysisPriority;
  focus: string;
  examinerTrap: string;
  questionPrompts: string[];
  sourceLabel: string;
  sourceUrl: string;
}

export interface SubjectStudyAnalysis {
  subjectCode: SubjectCode;
  title: string;
  summary: string;
  sourceNote: string;
  sourceUrl: string;
  insights: StudyInsight[];
}

const ASSA_PAST_PAPERS_URL = "https://www.actuarialsociety.org.za/document-category/past-paper/";
const F102_2025_PAPER_URL = "https://www.actuarialsociety.org.za/wp-content/uploads/2025/12/F102-Examination-Paper-S2-2025.pdf";
const F108_2026_REPORT_URL = "https://www.actuarialsociety.org.za/wp-content/uploads/2026/07/F108-June-2026-Examiners-Report.pdf";
const F101_2024_REPORT_URL = "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/F101-JUNE-2024-EXAMINERS-REPORT-1.pdf";
const F104_2023_REPORT_URL = "https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/F104-NOVEMBER-2023-EXAMINERS-REPORT-1.pdf";

export const studyAnalysis: Record<SubjectCode, SubjectStudyAnalysis> = {
  F102: {
    subjectCode: "F102",
    title: "F102 exam lens",
    summary: "Use the paper as a signal for how broad principles are turned into applied, scenario-led questions.",
    sourceNote: "Curated from the ASSA past-paper index and the F102 November 2025 paper. Add the course-note page numbers when they are available.",
    sourceUrl: ASSA_PAST_PAPERS_URL,
    insights: [
      {
        id: "f102-with-profits",
        scope: "Chapters 1–3",
        priority: "high",
        focus: "With-profits product risks, asset shares, and how benefits are set at maturity or death.",
        examinerTrap: "Do not describe the product generically. Tie each risk or bonus decision to the policyholder, the insurer, or the asset-share mechanism.",
        questionPrompts: ["F102 N2025 Q1: outline policyholder risks", "F102 N2025 Q1: calculate and use an asset share"],
        sourceLabel: "F102 N2025 · Q1",
        sourceUrl: F102_2025_PAPER_URL,
      },
      {
        id: "f102-unit-linked",
        scope: "Chapters 4, 16–17",
        priority: "high",
        focus: "Unit-linked product design, charges, guarantees, fund choices, outsourcing, and operational risk.",
        examinerTrap: "Separate client needs, insurer risks, and risk mitigations; naming a risk without explaining its direction or control is not enough.",
        questionPrompts: ["F102 N2025 Q2: assess proposed product changes", "F102 N2025 Q3: explain minimum premiums and unit pricing"],
        sourceLabel: "F102 N2025 · Q2–3",
        sourceUrl: F102_2025_PAPER_URL,
      },
      {
        id: "f102-valuation",
        scope: "Chapters 18–19, 32",
        priority: "high",
        focus: "Data checks, cash-flow projections, assumptions, prudence, market shocks, and solvency.",
        examinerTrap: "Show the chain from data to assumptions to liabilities to solvency. Avoid listing generic risks without applying the scenario.",
        questionPrompts: ["F102 N2025 Q4: describe data checks and reserves", "F102 N2025 Q5: set assumptions and prudential margins"],
        sourceLabel: "F102 N2025 · Q4–5",
        sourceUrl: F102_2025_PAPER_URL,
      },
      {
        id: "f102-annuities",
        scope: "Chapters 21–22",
        priority: "high",
        focus: "Inflation-linked annuities, investment matching, key risks, and guaranteed annuity option pricing.",
        examinerTrap: "Distinguish an investment strategy that matches liabilities from an option-pricing method that values a guarantee.",
        questionPrompts: ["F102 N2025 Q6: match assets to an increasing annuity", "F102 N2025 Q6: estimate the cost of a GAO"],
        sourceLabel: "F102 N2025 · Q6",
        sourceUrl: F102_2025_PAPER_URL,
      },
      {
        id: "f102-reinsurance",
        scope: "Chapters 23–24, 33",
        priority: "medium",
        focus: "Retention limits, group income protection, free-cover limits, and claim-inception pricing.",
        examinerTrap: "Use the facts of the group scheme. Generic individual-life reinsurance answers can miss why the group arrangement changes the risk.",
        questionPrompts: ["F102 N2025 Q7: list and explain retention factors", "F102 N2025 Q7: explain the claim-inception approach"],
        sourceLabel: "F102 N2025 · Q7",
        sourceUrl: F102_2025_PAPER_URL,
      },
      {
        id: "f102-experience",
        scope: "Chapters 25–31, 34–36",
        priority: "high",
        focus: "Experience monitoring, expense analysis, underwriting changes, digital servicing, and product risks.",
        examinerTrap: "Answer the monitoring question asked, then explain why each experience item matters; do not substitute a catalogue of generic risks.",
        questionPrompts: ["F102 N2025 Q8: choose experience items to monitor", "F102 N2025 Q8: plan an expense experience analysis"],
        sourceLabel: "F102 N2025 · Q8",
        sourceUrl: F102_2025_PAPER_URL,
      },
    ],
  },
  F108: {
    subjectCode: "F108",
    title: "F108 exam lens",
    summary: "F108 combines the former F101 and F104 material, so practise both health/benefit applications and retirement/funding reasoning.",
    sourceNote: "Curated from ASSA’s F108 June 2026 examiner report, with the F101 June 2024 and F104 November 2023 reports retained as transition evidence.",
    sourceUrl: ASSA_PAST_PAPERS_URL,
    insights: [
      {
        id: "f108-social-security",
        scope: "Chapters 2–5",
        priority: "high",
        focus: "Social security, employer roles, taxation/EET, regulation, and financial reporting.",
        examinerTrap: "State the context and the party affected. Broad comments about a report or employer can miss the specific social-security or fund question.",
        questionPrompts: ["F108 J2026 report · Q1: use EET and reporting specifics", "F104 N2023 report · Q5: apply bookwork to a two-country scenario"],
        sourceLabel: "F108 J2026 · Q1; F104 N2023 · Q5",
        sourceUrl: F108_2026_REPORT_URL,
      },
      {
        id: "f108-rating",
        scope: "Chapters 6–7",
        priority: "high",
        focus: "Community rating, risk rating, adverse selection, and mitigation in voluntary or compulsory settings.",
        examinerTrap: "Compare both rating approaches and apply the scenario; listing adverse selection without a mitigation strategy leaves marks behind.",
        questionPrompts: ["F108 J2026 report · Q2: compare community and risk rating", "F108 J2026 report · Q2: propose an adverse-selection mitigation"],
        sourceLabel: "F108 J2026 · Q2",
        sourceUrl: F108_2026_REPORT_URL,
      },
      {
        id: "f108-health-products",
        scope: "Chapters 8–15",
        priority: "high",
        focus: "Critical-illness definitions, data availability, group versus individual cover, morbidity, utilisation, and reserving.",
        examinerTrap: "Keep treatment cover, lump-sum cover, and group cover distinct. Show workings and apply any monthly, utilisation, or adjustment information given.",
        questionPrompts: ["F108 J2026 report · Q4–5: define conditions and reserve group cover", "F101 J2024 report: practise health-and-care application questions"],
        sourceLabel: "F108 J2026 · Q4–5; F101 J2024",
        sourceUrl: F108_2026_REPORT_URL,
      },
      {
        id: "f108-investments",
        scope: "Chapters 16–17",
        priority: "medium",
        focus: "Investment strategy, matching, risk, and how asset choices affect benefit security or surplus.",
        examinerTrap: "Explain why an asset is suitable for the liability; naming asset classes without linking them to term, risk, or cash flow is too thin.",
        questionPrompts: ["F104 N2023 report · Q3: establish an ALM process", "F108 J2026 report · Q3: relate liability term to investment strategy"],
        sourceLabel: "F108 J2026 · Q3; F104 N2023 · Q3",
        sourceUrl: F108_2026_REPORT_URL,
      },
      {
        id: "f108-funding",
        scope: "Chapters 18–23",
        priority: "high",
        focus: "Funding methods, valuations, surplus, retirement risks, behavioural biases, and investment-default review.",
        examinerTrap: "Read the command word and scenario carefully: constraints are not distribution methods, and a list of risks needs a mitigation or consequence.",
        questionPrompts: ["F108 J2026 report · Q3: explain surplus and contribution-rate relationships", "F108 J2026 report · Q7: review a default investment choice"],
        sourceLabel: "F108 J2026 · Q3, Q7",
        sourceUrl: F108_2026_REPORT_URL,
      },
    ],
  },
};

export const legacyF108Sources = [
  { label: "F101 June 2024 examiner report", url: F101_2024_REPORT_URL },
  { label: "F104 November 2023 examiner report", url: F104_2023_REPORT_URL },
];
