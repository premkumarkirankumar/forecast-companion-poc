import { MONTHS } from "../../data/hub";

const PROGRAM_LABELS = {
  connected: "Connected",
  tre: "TRE",
  csc: "CSC",
};

function fmtMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function fmtPct(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function clamp(value) {
  const x = Number(value || 0);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function moneyFromContractor(item) {
  const direct = Number(item?.yearTargetTotal ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return (
    Number(item?.ratePerHour ?? 0) *
    Number(item?.hoursPerWeek ?? 0) *
    Number(item?.weeksPerYear ?? 0)
  );
}

function moneyFromSow(item) {
  return Number(item?.yearTargetTotal ?? item?.yearTotal ?? 0);
}

function moneyFromTool(item) {
  return Number(item?.total ?? item?.yearTargetTotal ?? item?.yearTotal ?? 0);
}

function roleFlags(roleText) {
  const role = String(roleText || "").toLowerCase();
  const hasDeveloper =
    role.includes("developer") ||
    role.includes("dev ") ||
    role.startsWith("dev") ||
    role.includes("engineer") ||
    role.includes("sde") ||
    role.includes("frontend") ||
    role.includes("backend") ||
    role.includes("full stack") ||
    role.includes("fullstack");
  const hasQa =
    role.includes("qa") ||
    role.includes("qe") ||
    role.includes("quality") ||
    role.includes("test") ||
    role.includes("sdet") ||
    role.includes("validation");
  return { hasDeveloper, hasQa };
}

function summarizeProgram(programKey, state) {
  const internal = Array.isArray(state?.internalLaborItems) ? state.internalLaborItems : [];
  const tools = Array.isArray(state?.tnsItems) ? state.tnsItems : [];
  const contractors = Array.isArray(state?.contractors) ? state.contractors : [];
  const sows = Array.isArray(state?.sows) ? state.sows : [];
  const budgetByMonth =
    state?.budgetByMonth && typeof state.budgetByMonth === "object"
      ? state.budgetByMonth
      : {};

  const internalCount = internal.length;
  const avgRun = internalCount
    ? internal.reduce((sum, item) => sum + clamp(item?.runPct), 0) / internalCount
    : 0;
  const avgGrowth = internalCount
    ? internal.reduce((sum, item) => sum + clamp(item?.growthPct), 0) / internalCount
    : 0;

  let internalDeveloperCount = 0;
  let internalQaCount = 0;
  for (const item of internal) {
    const flags = roleFlags(item?.role);
    if (flags.hasDeveloper) internalDeveloperCount += 1;
    if (flags.hasQa) internalQaCount += 1;
  }

  let contractorDeveloperCount = 0;
  let contractorQaCount = 0;
  for (const item of contractors) {
    const flags = roleFlags(item?.role);
    if (flags.hasDeveloper) contractorDeveloperCount += 1;
    if (flags.hasQa) contractorQaCount += 1;
  }

  const toolsTotal = tools.reduce((sum, item) => sum + moneyFromTool(item), 0);
  const contractorsTotal = contractors.reduce((sum, item) => sum + moneyFromContractor(item), 0);
  const sowTotal = sows.reduce((sum, item) => sum + moneyFromSow(item), 0);
  const externalTotal = contractorsTotal + sowTotal;
  const trackedSpend = toolsTotal + externalTotal;
  const budgetTotal = MONTHS.reduce((sum, month) => sum + Number(budgetByMonth?.[month] ?? 0), 0);
  const variance = trackedSpend - budgetTotal;
  const totalDevelopers =
    internalDeveloperCount +
    contractorDeveloperCount +
    sows.reduce((sum, item) => sum + Math.max(0, Number(item?.totalDevelopers ?? 0)), 0);
  const totalQa =
    internalQaCount +
    contractorQaCount +
    sows.reduce((sum, item) => sum + Math.max(0, Number(item?.totalQa ?? 0)), 0);
  const ratioLabel =
    totalDevelopers === 0 && totalQa === 0
      ? "0 : 0"
      : totalQa === 0
        ? `${totalDevelopers.toFixed(1)} : 0`
        : `${(totalDevelopers / totalQa).toFixed(1)} : 1`;
  const toolNames = tools
    .slice()
    .sort((a, b) => moneyFromTool(b) - moneyFromTool(a))
    .slice(0, 5)
    .map((item) => ({
      name: String(item?.name || "Unnamed tool"),
      total: moneyFromTool(item),
    }));

  return {
    programKey,
    name: PROGRAM_LABELS[programKey] || programKey,
    internalCount,
    avgRun,
    avgGrowth,
    toolsCount: tools.length,
    toolsTotal,
    contractorsCount: contractors.length,
    contractorsTotal,
    sowsCount: sows.length,
    sowTotal,
    externalTotal,
    trackedSpend,
    budgetTotal,
    variance,
    totalDevelopers,
    totalQa,
    ratioLabel,
    topTools: toolNames,
    externalReliance: trackedSpend > 0 ? (externalTotal / trackedSpend) * 100 : 0,
  };
}

function buildStrategicSummary(programs) {
  const totalTracked = programs.reduce((sum, p) => sum + p.trackedSpend, 0);
  const totalTools = programs.reduce((sum, p) => sum + p.toolsTotal, 0);
  const totalExternal = programs.reduce((sum, p) => sum + p.externalTotal, 0);
  const totalInternal = programs.reduce((sum, p) => sum + p.internalCount, 0);
  const totalDevelopers = programs.reduce((sum, p) => sum + p.totalDevelopers, 0);
  const totalQa = programs.reduce((sum, p) => sum + p.totalQa, 0);

  const topProgram = programs.slice().sort((a, b) => b.trackedSpend - a.trackedSpend)[0];
  const highestExternal = programs
    .slice()
    .sort((a, b) => b.externalReliance - a.externalReliance)[0];
  const ratio =
    totalDevelopers === 0 && totalQa === 0
      ? "0 : 0"
      : totalQa === 0
        ? `${totalDevelopers.toFixed(1)} : 0`
        : `${(totalDevelopers / totalQa).toFixed(1)} : 1`;

  return {
    totalTracked,
    totalTools,
    totalExternal,
    totalInternal,
    totalDevelopers,
    totalQa,
    ratio,
    topProgram,
    highestExternal,
  };
}

function buildReportHtml(allStates) {
  const generatedAt = new Date();
  const programs = ["connected", "tre", "csc"].map((key) =>
    summarizeProgram(key, allStates?.[key] || {})
  );
  const strategic = buildStrategicSummary(programs);

  const programSections = programs
    .map(
      (program) => `
        <section class="page-break">
          <div class="section-title">${escapeHtml(program.name)} program snapshot</div>
          <div class="grid two">
            <div class="card">
              <div class="label">Tracked spend</div>
              <div class="value">${fmtMoney(program.trackedSpend)}</div>
              <div class="sub">Tools + external tracked across the saved state</div>
            </div>
            <div class="card">
              <div class="label">Budget vs tracked</div>
              <div class="value">${fmtMoney(program.variance)}</div>
              <div class="sub">Budget ${fmtMoney(program.budgetTotal)} • Variance ${
                program.variance >= 0 ? "over" : "under"
              } plan</div>
            </div>
          </div>
          <div class="grid four">
            <div class="card compact">
              <div class="label">Internal FTE</div>
              <div class="value">${program.internalCount}</div>
              <div class="sub">Run ${fmtPct(program.avgRun)} • Growth ${fmtPct(
                program.avgGrowth
              )}</div>
            </div>
            <div class="card compact">
              <div class="label">Tool spend</div>
              <div class="value">${fmtMoney(program.toolsTotal)}</div>
              <div class="sub">${program.toolsCount} tracked tools</div>
            </div>
            <div class="card compact">
              <div class="label">External spend</div>
              <div class="value">${fmtMoney(program.externalTotal)}</div>
              <div class="sub">${program.contractorsCount} contractors • ${program.sowsCount} SOWs</div>
            </div>
            <div class="card compact">
              <div class="label">Dev-to-QA</div>
              <div class="value">${escapeHtml(program.ratioLabel)}</div>
              <div class="sub">${program.totalDevelopers} developers • ${program.totalQa} QA</div>
            </div>
          </div>
          <div class="card table-card">
            <div class="table-heading">Leadership review points</div>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Review note</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>External reliance</td>
                  <td>${fmtPct(program.externalReliance)}</td>
                  <td>${
                    program.externalReliance >= 75
                      ? "Delivery is materially weighted toward external execution."
                      : program.externalReliance >= 50
                        ? "External delivery remains meaningful and should be monitored."
                        : "Internal and external balance remains comparatively stable."
                  }</td>
                </tr>
                <tr>
                  <td>Budget variance</td>
                  <td>${fmtMoney(program.variance)}</td>
                  <td>${
                    program.variance > 0
                      ? "Tracked spend is running above the current plan."
                      : program.variance < 0
                        ? "Tracked spend is currently below the saved budget."
                        : "Tracked spend is aligned to the saved budget."
                  }</td>
                </tr>
                <tr>
                  <td>Top tools</td>
                  <td>${program.topTools.length}</td>
                  <td>${
                    program.topTools.length
                      ? escapeHtml(
                          program.topTools
                            .map((tool) => `${tool.name} (${fmtMoney(tool.total)})`)
                            .join(" • ")
                        )
                      : "No tools are currently tracked in this program."
                  }</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Forecast leadership report</title>
        <style>
          @page { size: landscape; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #172033;
            background: #f8fafc;
          }
          .page {
            padding: 24px 28px;
          }
          .hero {
            background: linear-gradient(135deg, #101828, #21324a 62%, #dde8f5);
            color: #fff;
            border-radius: 22px;
            padding: 28px 30px;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
          }
          .eyebrow {
            font-size: 12px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            opacity: 0.8;
            font-weight: 700;
          }
          .title {
            margin-top: 10px;
            font-size: 36px;
            font-weight: 800;
            line-height: 1.05;
          }
          .subtitle {
            margin-top: 12px;
            font-size: 15px;
            line-height: 1.6;
            max-width: 900px;
            color: rgba(255,255,255,0.86);
          }
          .meta {
            margin-top: 18px;
            display: flex;
            gap: 18px;
            flex-wrap: wrap;
            font-size: 13px;
            color: rgba(255,255,255,0.84);
          }
          .grid {
            display: grid;
            gap: 16px;
            margin-top: 20px;
          }
          .grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .card {
            border: 1px solid #dbe4ee;
            background: #fff;
            border-radius: 20px;
            padding: 18px 20px;
            box-shadow: 0 6px 24px rgba(15, 23, 42, 0.05);
          }
          .card.compact { min-height: 122px; }
          .label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: #667085;
            font-weight: 700;
          }
          .value {
            margin-top: 8px;
            font-size: 26px;
            font-weight: 800;
            color: #0f172a;
          }
          .sub {
            margin-top: 6px;
            font-size: 14px;
            line-height: 1.5;
            color: #475467;
          }
          .section-title {
            margin-top: 24px;
            font-size: 22px;
            font-weight: 800;
            color: #101828;
          }
          .lead {
            margin-top: 8px;
            font-size: 15px;
            line-height: 1.6;
            color: #475467;
          }
          .pill-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 12px;
          }
          .pill {
            border-radius: 999px;
            padding: 8px 12px;
            background: #eef5ff;
            color: #1d4ed8;
            font-size: 12px;
            font-weight: 700;
          }
          .pill.orange { background: #fff4eb; color: #c2410c; }
          .pill.green { background: #ecfdf3; color: #027a48; }
          .table-card {
            margin-top: 18px;
            padding: 0;
            overflow: hidden;
          }
          .table-heading {
            padding: 16px 20px;
            border-bottom: 1px solid #e4e7ec;
            font-size: 15px;
            font-weight: 800;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th, td {
            padding: 12px 14px;
            text-align: left;
            vertical-align: top;
            border-bottom: 1px solid #eef2f6;
          }
          th {
            color: #667085;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.14em;
          }
          .page-break {
            break-before: page;
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <section class="hero">
            <div class="eyebrow">Forecast leadership report</div>
            <div class="title">Portfolio report for decision review</div>
            <div class="subtitle">
              This report consolidates the latest saved forecast data across Connected, TRE, and CSC.
              It combines executive-level spend, workforce, delivery, and variance metrics so leaders can
              review priorities, pressure points, and portfolio posture in one place.
            </div>
            <div class="meta">
              <span>Generated ${escapeHtml(generatedAt.toLocaleString())}</span>
              <span>${programs.length} programs in scope</span>
              <span>${fmtMoney(strategic.totalTracked)} tracked spend</span>
            </div>
          </section>

          <section>
            <div class="section-title">Portfolio overview</div>
            <div class="lead">
              Leadership view of tracked spend, budget posture, workforce balance, and the most material
              execution dependencies across the saved portfolio.
            </div>
            <div class="grid four">
              <div class="card compact">
                <div class="label">Tracked spend</div>
                <div class="value">${fmtMoney(strategic.totalTracked)}</div>
                <div class="sub">Combined Tools & Services plus External tracked spend</div>
              </div>
              <div class="card compact">
                <div class="label">Tool investment</div>
                <div class="value">${fmtMoney(strategic.totalTools)}</div>
                <div class="sub">Portfolio-wide recurring tools and services</div>
              </div>
              <div class="card compact">
                <div class="label">External spend</div>
                <div class="value">${fmtMoney(strategic.totalExternal)}</div>
                <div class="sub">Contractors and SOW commitments</div>
              </div>
              <div class="card compact">
                <div class="label">Internal staffing</div>
                <div class="value">${strategic.totalInternal}</div>
                <div class="sub">Named FTE entries tracked in the portfolio</div>
              </div>
            </div>
            <div class="grid two">
              <div class="card">
                <div class="label">Strategic assessment</div>
                <div class="value" style="font-size:22px;">${escapeHtml(
                  strategic.topProgram?.name || "Portfolio"
                )} carries the heaviest tracked spend</div>
                <div class="sub">
                  ${escapeHtml(
                    strategic.topProgram
                      ? `${strategic.topProgram.name} currently leads tracked spend at ${fmtMoney(
                          strategic.topProgram.trackedSpend
                        )}.`
                      : "No program data is currently available."
                  )}
                </div>
                <div class="pill-row">
                  <span class="pill">Dev-to-QA ${escapeHtml(strategic.ratio)}</span>
                  <span class="pill orange">Highest external reliance ${
                    strategic.highestExternal
                      ? escapeHtml(strategic.highestExternal.name)
                      : "N/A"
                  }</span>
                  <span class="pill green">Leadership-ready summary</span>
                </div>
              </div>
              <div class="card">
                <div class="label">Workforce and delivery</div>
                <div class="value" style="font-size:22px;">${strategic.totalDevelopers} developers • ${
    strategic.totalQa
  } QA</div>
                <div class="sub">
                  Blended workforce signal including Internal, Contractors, and declared SOW delivery
                  capacity. Use this to review delivery depth and current QA coverage.
                </div>
              </div>
            </div>
          </section>

          ${programSections}
        </div>
      </body>
    </html>
  `;
}

export function generatePortfolioReport(allStates) {
  const html = buildReportHtml(allStates);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `forecast-leadership-report-${stamp}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
