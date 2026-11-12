// What investors or buyers usually expect to find. A room starts from one of these lists.
// "match" holds words that, when found in a file's name or first page, tick the item off.
export type Template = { title: string; detail: string; match: string; folder: string };

export const RAISE: Template[] = [
  { title: "Pitch deck", detail: "The story of the company in about ten slides.", match: "pitch deck|deck", folder: "Company" },
  { title: "Financial summary", detail: "Revenue, costs, cash and runway, by month.", match: "financial summary|financials|p&l|income statement", folder: "Financials" },
  { title: "Cap table", detail: "Who owns what, including option pool and SAFEs.", match: "cap table|capitalization", folder: "Financials" },
  { title: "Formation documents", detail: "Certificate of incorporation, bylaws, EIN letter.", match: "formation|incorporation|bylaws", folder: "Legal" },
  { title: "Signed SAFEs and notes", detail: "Every SAFE or convertible note already signed.", match: "safe agreement|simple agreement for future equity|convertible note", folder: "Legal" },
  { title: "IP assignment agreements", detail: "Founders and staff assign their work to the company.", match: "ip assignment|invention assignment|piia", folder: "Legal" },
  { title: "Board minutes and consents", detail: "Approvals for stock, options and past rounds.", match: "board minutes|board consent|written consent", folder: "Legal" },
  { title: "Customer contracts", detail: "Your largest customer agreements.", match: "customer contract|master services|order form", folder: "Customers" },
  { title: "Product roadmap", detail: "What you plan to build in the next year.", match: "roadmap", folder: "Product" },
  { title: "Team and hiring plan", detail: "Who is on the team and who you will hire with this round.", match: "team plan|hiring plan|headcount", folder: "Team" },
];

export const SELL: Template[] = [
  { title: "Teaser and overview", detail: "A short description of the business for buyers.", match: "teaser|overview|cim", folder: "Company" },
  { title: "Three years of financials", detail: "Income statements, balance sheets and cash flow.", match: "financial|p&l|balance sheet", folder: "Financials" },
  { title: "Tax returns", detail: "Federal and state returns for recent years.", match: "tax return", folder: "Financials" },
  { title: "Cap table", detail: "Every owner and every right to buy shares.", match: "cap table|capitalization", folder: "Financials" },
  { title: "Formation documents", detail: "Certificate of incorporation, bylaws, good standing.", match: "formation|incorporation|bylaws", folder: "Legal" },
  { title: "Material contracts", detail: "Customer, supplier and lease agreements.", match: "contract|agreement|lease", folder: "Legal" },
  { title: "IP and licenses", detail: "Trademarks, patents, and software licenses you rely on.", match: "trademark|patent|license|ip assignment", folder: "Legal" },
  { title: "Employee list and agreements", detail: "Roles, pay bands and offer letters.", match: "employee|team plan|offer letter", folder: "Team" },
  { title: "Customer list", detail: "Top customers with revenue by customer.", match: "customer", folder: "Customers" },
];

export function templateFor(purpose: string): Template[] {
  return purpose === "sell" ? SELL : RAISE;
}

/** Does this file fit a checklist item? Looks at the file name, title and the first page. */
export function fits(match: string | null, haystack: string): boolean {
  if (!match) return false;
  const h = haystack.toLowerCase();
  return match.split("|").some((m) => m && h.includes(m.toLowerCase()));
}
