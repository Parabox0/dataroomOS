"""Builds the fictional sample files for the demo room (Brightloaf, a made-up company).

Run with: python3 scripts/make-sample-pdfs.py
Needs: pip install weasyprint
Every name, company, number and contact in these files is invented for the demo.
"""
from pathlib import Path
from weasyprint import HTML

OUT = Path(__file__).resolve().parent.parent / "seed" / "files"
OUT.mkdir(parents=True, exist_ok=True)
import os
FONTS = Path(os.environ.get("INTER_TTF_DIR", Path(__file__).resolve().parent.parent / "public" / "fonts")).resolve().as_uri()

BASE_CSS = f"""
@font-face {{ font-family: Inter; src: url({FONTS}/Inter-Regular.ttf); font-weight: 400; }}
@font-face {{ font-family: Inter; src: url({FONTS}/Inter-Medium.ttf); font-weight: 500; }}
@font-face {{ font-family: Inter; src: url({FONTS}/Inter-SemiBold.ttf); font-weight: 600; }}
@font-face {{ font-family: Inter; src: url({FONTS}/Inter-Bold.ttf); font-weight: 700; }}
* {{ box-sizing: border-box; }}
body {{ font-family: Inter; color: #2a211b; margin: 0; }}
.fine {{ position: absolute; bottom: 14mm; left: 18mm; right: 18mm; font-size: 8pt; color: #8a7b70; display: flex; justify-content: space-between; }}
table {{ border-collapse: collapse; width: 100%; font-size: 10.5pt; }}
th {{ text-align: left; font-weight: 600; border-bottom: 1.5px solid #2a211b; padding: 6px 8px 6px 0; }}
td {{ border-bottom: 1px solid #e6dcd3; padding: 7px 8px 7px 0; }}
td.n, th.n {{ text-align: right; }}
"""

DOC_CSS = BASE_CSS + """
@page { size: Letter; margin: 0; }
.page { width: 8.5in; height: 11in; padding: 22mm 18mm; position: relative; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.brand { font-weight: 700; color: #b4532a; letter-spacing: -0.01em; font-size: 12pt; }
h1 { font-size: 24pt; letter-spacing: -0.02em; margin: 10mm 0 3mm; }
h2 { font-size: 14pt; margin: 9mm 0 3mm; }
p, li { font-size: 10.5pt; line-height: 1.55; }
.meta { color: #6d5f55; font-size: 10pt; }
"""

DECK_CSS = BASE_CSS + """
@page { size: 13.333in 7.5in; margin: 0; }
.slide { width: 13.333in; height: 7.5in; padding: 0.75in 0.9in; position: relative; page-break-after: always; background: #fbf6f1; }
.slide:last-child { page-break-after: auto; }
.slide.dark { background: #2a211b; color: #fbf6f1; }
.slide.dark .fine { color: #b9a99c; }
.kicker { font-size: 13pt; font-weight: 600; color: #b4532a; }
.slide h1 { font-size: 44pt; letter-spacing: -0.03em; line-height: 1.05; margin: 0.25in 0 0.2in; max-width: 10in; }
.slide h2 { font-size: 32pt; letter-spacing: -0.02em; line-height: 1.1; margin: 0.15in 0 0.3in; max-width: 10.5in; }
.slide p, .slide li { font-size: 17pt; line-height: 1.45; max-width: 10in; }
.big { display: flex; gap: 0.6in; margin-top: 0.35in; }
.big div { flex: 1; }
.big b { display: block; font-size: 40pt; letter-spacing: -0.03em; color: #b4532a; }
.big span { font-size: 14pt; color: #6d5f55; }
.slide.dark .big span { color: #d8c9bd; }
.slide table { font-size: 15pt; }
"""

FINE = '<div class="fine"><span>Brightloaf, Inc. Confidential. Fictional company made for the Dataroom OS demo.</span><span>{n}</span></div>'


def write(name, css, pages):
    body = "".join(p.replace("{FINE}", FINE.format(n=i + 1)) for i, p in enumerate(pages))
    HTML(string=f"<html><head><style>{css}</style></head><body>{body}</body></html>").write_pdf(OUT / name)
    print("wrote", name, len(pages), "pages")


deck = [
    """<div class="slide dark"><div class="kicker">Seed round, November 2026</div>
    <h1>Brightloaf runs the back office of the neighborhood bakery.</h1>
    <p>Online ordering, inventory and next-day demand forecasts for independent bakeries. Built in Miami.</p>{FINE}</div>""",
    """<div class="slide"><div class="kicker">The problem</div>
    <h2>Independent bakeries throw away about one in eight loaves they bake.</h2>
    <ul><li>Owners guess tomorrow's demand at 4 a.m. with a notebook.</li>
    <li>Pre-orders arrive by text, Instagram DM and phone, and get lost.</li>
    <li>Chains have forecasting software. The bakery on your corner does not.</li></ul>
    <p style="font-size:11pt;color:#8a7b70">Waste figure from Brightloaf's survey of 64 customer bakeries, spring 2026.</p>{FINE}</div>""",
    """<div class="slide"><div class="kicker">The product</div>
    <h2>One screen tells the baker what to bake tomorrow.</h2>
    <ul><li><b>Orders:</b> a branded ordering page that collects pre-orders in one place.</li>
    <li><b>Inventory:</b> flour, butter and packaging tracked against recipes.</li>
    <li><b>Forecast:</b> next-day quantities per product from past sales, weather and local events.</li></ul>{FINE}</div>""",
    """<div class="slide"><div class="kicker">Traction</div>
    <h2>212 bakeries pay for Brightloaf today.</h2>
    <div class="big"><div><b>$486k</b><span>ARR, October 2026</span></div>
    <div><b>9%</b><span>average monthly revenue growth, last 6 months</span></div>
    <div><b>118%</b><span>net revenue retention</span></div></div>
    <p style="margin-top:0.4in">Customers using forecasts cut waste by 31% on average in their first 90 days.</p>{FINE}</div>""",
    """<div class="slide"><div class="kicker">Business model</div>
    <h2>Simple monthly plans, priced per location.</h2>
    <table><tr><th>Plan</th><th class="n">Price per location</th><th>Who buys it</th></tr>
    <tr><td>Starter</td><td class="n">$99 / month</td><td>Single shop, ordering only</td></tr>
    <tr><td>Bakery</td><td class="n">$189 / month</td><td>Ordering, inventory and forecasts</td></tr>
    <tr><td>Group</td><td class="n">$149 / month</td><td>Five or more locations, volume price</td></tr></table>
    <p style="margin-top:0.3in">Average revenue per customer is $191 a month. Gross margin is 81%.</p>{FINE}</div>""",
    """<div class="slide"><div class="kicker">Market</div>
    <h2>About 21,000 independent retail bakeries in the US.</h2>
    <p>At $2,300 a year per location, the US core market is roughly $48M a year, before cafés, coffee shops and Latin America, where we already have 9 customers in Bogota and Mexico City.</p>
    <p style="font-size:11pt;color:#8a7b70">Bakery count from Brightloaf's own analysis of public business listings, 2026.</p>{FINE}</div>""",
    """<div class="slide"><div class="kicker">Go to market</div>
    <h2>Bakers trust other bakers.</h2>
    <ul><li>42% of new customers in 2026 came from referrals by existing customers.</li>
    <li>Flour distributor partnership with Molino Verde gives us 1,800 bakery accounts.</li>
    <li>Payback period on paid acquisition is 7 months.</li></ul>{FINE}</div>""",
    """<div class="slide"><div class="kicker">Team</div>
    <h2>A baker's daughter and a forecasting engineer.</h2>
    <ul><li><b>Ana Ruiz, CEO.</b> Grew up working in her family's bakery in Hialeah. Previously operations lead at a restaurant software company.</li>
    <li><b>Theo Park, CTO.</b> Built demand forecasting models for a grocery delivery company for six years.</li>
    <li>Nine full-time employees across engineering, support and sales.</li></ul>{FINE}</div>""",
    """<div class="slide dark"><div class="kicker">The round</div>
    <h2>Raising $2.5M on a SAFE at a $14M post-money valuation cap.</h2>
    <div class="big"><div><b>55%</b><span>engineering: forecasts and integrations</span></div>
    <div><b>30%</b><span>go to market: distributor partnerships</span></div>
    <div><b>15%</b><span>operations and support</span></div></div>
    <p style="margin-top:0.4in">The round extends runway to 26 months and gets Brightloaf to $1.5M ARR.</p>{FINE}</div>""",
    """<div class="slide"><div class="kicker">Thank you</div>
    <h1>Every bakery deserves the tools the chains have.</h1>
    <p>Ana Ruiz, CEO. ana@brightloaf.example</p>{FINE}</div>""",
]
write("brightloaf-pitch-deck.pdf", DECK_CSS, deck)

fin = [
    """<div class="page"><div class="brand">Brightloaf</div><h1>Financial summary</h1>
    <div class="meta">Prepared October 31, 2026. All figures in US dollars, unaudited.</div>
    <h2>Where we are today</h2>
    <table><tr><th>Measure</th><th class="n">October 2026</th></tr>
    <tr><td>Annual recurring revenue (ARR)</td><td class="n">$486,000</td></tr>
    <tr><td>Monthly recurring revenue (MRR)</td><td class="n">$40,500</td></tr>
    <tr><td>Paying bakeries</td><td class="n">212</td></tr>
    <tr><td>Gross margin</td><td class="n">81%</td></tr>
    <tr><td>Net monthly burn</td><td class="n">$92,000</td></tr>
    <tr><td>Cash in bank</td><td class="n">$1,104,000</td></tr>
    <tr><td>Runway at current burn</td><td class="n">12 months</td></tr></table>
    <p>Our net monthly burn is $92,000, so current cash covers about 12 months. Cash includes a $250,000 SAFE from Kiln Fund signed on October 3, 2026, on the same terms as this round.</p>
    <h2>Retention</h2>
    <p>Net revenue retention is 118% over the last twelve months, driven by bakeries adding locations and moving from Starter to Bakery. Logo churn averages 1.6% a month, mostly seasonal shops that close for summer.</p>{FINE}</div>""",
    """<div class="page"><div class="brand">Brightloaf</div><h1>Three year plan</h1>
    <table><tr><th>Line</th><th class="n">2025 actual</th><th class="n">2026 forecast</th><th class="n">2027 plan</th></tr>
    <tr><td>Revenue</td><td class="n">$168,000</td><td class="n">$402,000</td><td class="n">$1,050,000</td></tr>
    <tr><td>Cost of revenue</td><td class="n">$38,000</td><td class="n">$76,000</td><td class="n">$189,000</td></tr>
    <tr><td>Gross profit</td><td class="n">$130,000</td><td class="n">$326,000</td><td class="n">$861,000</td></tr>
    <tr><td>Engineering</td><td class="n">$410,000</td><td class="n">$720,000</td><td class="n">$1,240,000</td></tr>
    <tr><td>Sales and marketing</td><td class="n">$120,000</td><td class="n">$310,000</td><td class="n">$640,000</td></tr>
    <tr><td>General and admin</td><td class="n">$95,000</td><td class="n">$160,000</td><td class="n">$230,000</td></tr>
    <tr><td><b>Net income</b></td><td class="n"><b>($495,000)</b></td><td class="n"><b>($864,000)</b></td><td class="n"><b>($1,249,000)</b></td></tr>
    <tr><td>Ending headcount</td><td class="n">6</td><td class="n">9</td><td class="n">17</td></tr></table>
    <h2>Key assumptions</h2>
    <ul><li>New bakeries per month grow from 18 to 34 by December 2027.</li>
    <li>Average revenue per bakery rises from $191 to $214 a month as forecasts move into the Bakery plan.</li>
    <li>The $2.5M seed closes in Q1 2027. With it, runway is 26 months.</li></ul>{FINE}</div>""",
    """<div class="page"><div class="brand">Brightloaf</div><h1>Unit economics</h1>
    <table><tr><th>Measure</th><th class="n">Value</th></tr>
    <tr><td>Customer acquisition cost (blended)</td><td class="n">$1,120</td></tr>
    <tr><td>Payback period</td><td class="n">7 months</td></tr>
    <tr><td>Lifetime value at 1.6% monthly churn</td><td class="n">$9,670</td></tr>
    <tr><td>LTV to CAC</td><td class="n">8.6x</td></tr></table>
    <p>Customer acquisition cost is falling because 42% of new customers came from referrals in 2026. The Molino Verde distributor partnership started in September and has produced 23 trials so far.</p>{FINE}</div>""",
]
write("brightloaf-financial-summary.pdf", DOC_CSS, fin)

cap = [
    """<div class="page"><div class="brand">Brightloaf</div><h1>Capitalization table</h1>
    <div class="meta">As of August 1, 2026. Fully diluted.</div>
    <table style="margin-top:8mm"><tr><th>Holder</th><th>Security</th><th class="n">Shares</th><th class="n">Ownership</th></tr>
    <tr><td>Ana Ruiz</td><td>Common</td><td class="n">4,200,000</td><td class="n">42.0%</td></tr>
    <tr><td>Theo Park</td><td>Common</td><td class="n">3,800,000</td><td class="n">38.0%</td></tr>
    <tr><td>Seabreak Angels (pre-seed SAFE)</td><td>SAFE, as converted</td><td class="n">850,000</td><td class="n">8.5%</td></tr>
    <tr><td>Employee option pool</td><td>Options, granted and unissued</td><td class="n">1,150,000</td><td class="n">11.5%</td></tr>
    <tr><td><b>Total</b></td><td></td><td class="n"><b>10,000,000</b></td><td class="n"><b>100%</b></td></tr></table>
    <h2>Notes</h2>
    <ul><li>Founder shares vest over four years with a one year cliff, starting March 2024.</li>
    <li>The pre-seed SAFE of $400,000 converts at a $5M post-money cap.</li>
    <li>The option pool will be refreshed to 12% at the seed close.</li></ul>{FINE}</div>""",
]
write("brightloaf-cap-table.pdf", DOC_CSS, cap)

inc = [
    """<div class="page"><div class="brand">Brightloaf</div><h1>Company formation summary</h1>
    <div class="meta">Summary of the certificate of incorporation and bylaws.</div>
    <table style="margin-top:8mm"><tr><th>Item</th><th>Detail</th></tr>
    <tr><td>Legal name</td><td>Brightloaf, Inc.</td></tr>
    <tr><td>State</td><td>Delaware C corporation, incorporated March 4, 2024</td></tr>
    <tr><td>Registered agent</td><td>Coastline Registered Agents (fictional)</td></tr>
    <tr><td>Employer ID (EIN)</td><td>00-0000123</td></tr>
    <tr><td>Authorized shares</td><td>15,000,000 common, par value $0.00001</td></tr>
    <tr><td>Board</td><td>Ana Ruiz (chair), Theo Park</td></tr>
    <tr><td>Principal office</td><td>Miami, Florida</td></tr></table>
    <h2>Officer contacts</h2>
    <p>Ana Ruiz, Chief Executive Officer: ana@brightloaf.example, (305) 555-0142.<br/>
    Theo Park, Chief Technology Officer and Secretary: theo@brightloaf.example, (305) 555-0178.</p>
    <p>Personal identifier on file for the CEO: SSN 000-12-3456 (sample only).</p>{FINE}</div>""",
    """<div class="page"><div class="brand">Brightloaf</div><h1>Intellectual property</h1>
    <p>All founders and employees have signed confidential information and invention assignment agreements, except two contractors engaged in 2024 whose agreements are being collected. Brightloaf owns the brightloaf.example domain and has filed a US trademark application for the Brightloaf name.</p>
    <h2>Bank</h2>
    <p>Operating account at Harborline Bank (fictional), account number 000111222333, routing on file.</p>{FINE}</div>""",
]
write("brightloaf-formation-summary.pdf", DOC_CSS, inc)

cust = [
    """<div class="page"><div class="brand">Brightloaf</div><h1>Top customer contracts</h1>
    <div class="meta">The five largest customers by annual contract value, October 2026.</div>
    <table style="margin-top:8mm"><tr><th>Customer</th><th class="n">Locations</th><th class="n">Annual value</th><th>Renews</th></tr>
    <tr><td>Pan de Sol Bakery Group</td><td class="n">14</td><td class="n">$38,400</td><td>March 2027</td></tr>
    <tr><td>Crumb &amp; Co.</td><td class="n">8</td><td class="n">$22,800</td><td>January 2027</td></tr>
    <tr><td>Sugarline Patisserie</td><td class="n">6</td><td class="n">$15,600</td><td>June 2027</td></tr>
    <tr><td>Northside Bread Collective</td><td class="n">5</td><td class="n">$12,000</td><td>December 2026</td></tr>
    <tr><td>La Mesa Ovens</td><td class="n">4</td><td class="n">$9,600</td><td>August 2027</td></tr></table>
    <p>The top five customers are 20% of ARR. No single customer is more than 8% of ARR. Pan de Sol is the largest customer and signed a two year agreement in March 2025.</p>
    <h2>Customer contacts for reference calls</h2>
    <p>Marisol Vega, Pan de Sol: marisol@pandesol.example, (305) 555-0119.<br/>
    Dev Patel, Crumb &amp; Co.: dev@crumbco.example, (786) 555-0163.</p>{FINE}</div>""",
    """<div class="page"><div class="brand">Brightloaf</div><h1>Standard terms</h1>
    <ul><li>Monthly or annual billing. Annual plans get two months free.</li>
    <li>Either side can cancel a monthly plan with 30 days notice.</li>
    <li>Brightloaf keeps order data for 24 months and deletes it on request.</li>
    <li>No customer has a most favored nation clause or exclusivity.</li></ul>{FINE}</div>""",
]
write("brightloaf-customer-contracts.pdf", DOC_CSS, cust)

road = [
    """<div class="page"><div class="brand">Brightloaf</div><h1>Product roadmap</h1>
    <div class="meta">Next 12 months, as of November 2026.</div>
    <table style="margin-top:8mm"><tr><th>When</th><th>What</th><th>Why it matters</th></tr>
    <tr><td>Q4 2026</td><td>Point of sale sync with the two most used bakery register systems</td><td>Removes the last manual step in forecasting</td></tr>
    <tr><td>Q1 2027</td><td>Ingredient reorder suggestions sent to distributors</td><td>Ties inventory to the Molino Verde partnership</td></tr>
    <tr><td>Q2 2027</td><td>Spanish language app and Latin America payments</td><td>Opens Colombia and Mexico properly</td></tr>
    <tr><td>Q3 2027</td><td>Multi location dashboard for bakery groups</td><td>Needed to win groups with 10 or more shops</td></tr></table>
    <h2>Forecast accuracy</h2>
    <p>Forecasts are within 10% of actual sales on 84% of product days, measured across all customers in September 2026.</p>{FINE}</div>""",
]
write("brightloaf-product-roadmap.pdf", DOC_CSS, road)

team = [
    """<div class="page"><div class="brand">Brightloaf</div><h1>Team and hiring plan</h1>
    <table style="margin-top:8mm"><tr><th>Team</th><th class="n">Today</th><th class="n">End of 2027</th></tr>
    <tr><td>Engineering</td><td class="n">5</td><td class="n">9</td></tr>
    <tr><td>Customer success</td><td class="n">2</td><td class="n">4</td></tr>
    <tr><td>Sales and partnerships</td><td class="n">1</td><td class="n">3</td></tr>
    <tr><td>Founders</td><td class="n">2</td><td class="n">2</td></tr></table>
    <h2>First three hires after the round</h2>
    <ol><li>Senior machine learning engineer, forecasting</li><li>Partnerships lead for distributors</li><li>Bilingual customer success manager</li></ol>
    <p>Founder salaries are $120,000 each and will stay flat through 2027.</p>{FINE}</div>""",
]
write("brightloaf-team-plan.pdf", DOC_CSS, team)
