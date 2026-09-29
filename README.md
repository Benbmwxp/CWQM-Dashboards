# CWQM Dashboards

Severn Trent CWQM dashboards with group-based access, built on `@severn-trent/cwqm-design-system`.

Six dashboards are fully working, in light and dark themes:

| Menu | Page | Path |
|---|---|---|
| Data Streams | Data Streams Analysis | `/data-streams` |
| Concern Codes | Instances (Concern Codes Data) | `/concern-codes` |
| Concern Codes | Site analysis | `/concern-codes/site-analysis` |
| Operability | All sites | `/operability` |
| Operability | Trend analysis | `/operability/trend` |
| Operability | Missing data | `/operability/missing-data` |

Menu sections with several pages show tabs at the top. Until the backend exists, a mock API runs inside the browser (Mock Service Worker) and answers the same endpoints the real backend will provide, including access checks.

## Run it

Needs Node 20 or later.

```bash
npm ci
npm run dev          # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with the mock API |
| `npm test` | Unit tests (access rules and analytics) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Type check, then production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Try the groups

In mock mode, use **Viewing as** at the bottom of the sidebar to switch person.

| Person | Groups | Sees |
|---|---|---|
| Priya Shah | CWQM Admins | Every page and widget, all sites |
| Tom Evans | Operations Analysts | All six dashboards in full, all sites |
| Aisha Khan | Site Team - LittleAston | LittleAston only: Data Streams (KPIs, chart, key metrics), Trend analysis (charts, latest values, readings), Missing data (no site ranking), Concern code instances (KPIs, table) |
| David Clarke | Management | Summaries across all sites: Data Streams KPIs and insights, All sites (summary and averages, no heatmap), Missing data (totals and site ranking), Site analysis (KPIs and insight) |
| Sam Patel | Site Team - LittleAston + Management | The union of both groups |

Try Aisha with `/operability/trend?site=buxton` or `/data-streams?site=buxton`: the API refuses (403) and the page says so. Hiding things in the UI is never the only protection.

## How access works

1. The app calls `GET /api/me`. The server looks up the user's groups and returns their **resolved access**: which pages, which widgets on each page, and which sites.
2. The sidebar shows only permitted pages. Each page renders only permitted widgets, and the layout closes up around the gaps.
3. Every data endpoint checks the same access again and returns 403 if the request is outside it.

A person in several groups gets the union: any widget or site allowed by at least one group.

Groups, people and the rules live in `src/mocks/db/access.ts` for now. In production they move to the backend database, and group membership comes from Microsoft Entra ID.

**Add a group:** add an entry to `GROUPS` with the pages, widget ids and sites it allows.

| Page id | Widget ids |
|---|---|
| `data-streams` | `kpis`, `chart`, `key-metrics`, `comparison`, `insights` |
| `operability` | `heatmap`, `summary`, `parameter-averages` |
| `operability-trend` | `trends`, `latest-values`, `breakdown`, `readings` |
| `missing-data` | `kpis`, `daily-charts`, `site-averages`, `parameter-availability`, `missing-readings` |
| `concern-codes` | `kpis`, `instances`, `refine`, `insight` |
| `concern-codes-analysis` | `kpis`, `charts`, `ec-codes`, `latest`, `insight` |

## Where the data comes from (mock)

`src/mocks/quality.ts` simulates 15-minute telemetry for 16 monitoring points (8 sites, upstream and downstream) and 8 parameters. Every reading is good, missing, a flatline or an impossible value, with health profiles that reproduce the patterns in the designs: Tideswell offline, poor ammonia sensors at Goscote, LittleAston and Shenstone, flatlining ammonia at Buxton, and a live missing-data incident downstream at Buxton. Operability, missing data and concern codes are all calculated from the same readings, so every dashboard agrees with the others. `src/mocks/qualityHandlers.ts` serves it.

## Operability and Concern Codes: what works

- **All sites:** heatmap with the operability colour scale (worst sites first), site search, show/hide values, parameter and date filters, band summary donut, parameter averages, CSV export.
- **Trend analysis:** upstream and downstream dual-axis charts (operability, missing and bad data), latest 24 hours against the day before, a quality breakdown for every parameter, newest missing and bad readings with a download of up to 500.
- **Missing data:** expected, available and missing totals, available readings per day per parameter for each location, all-sites ranking (worst first), availability by parameter, newest missing readings.
- **Concern code instances:** filters, quick filters (7/30/90 days), server-side search, sorting and paging (so millions of rows are fine), Filter & Refine (priority, data stream, value range, time), details dialog, key insight, CSV export of the filtered results.
- **Site analysis:** totals with change against the previous period, upstream/downstream instance charts per parameter or a single combined chart, E&C code table with donut, latest instances, key insight.

Every filter is in the URL, so Share copies the exact view.

## Data Streams: what works

- Filters: site search, parameter, stream pair and dates, applied with **Apply**. Time-range presets (1D–180D) apply instantly.
- Every setting is in the URL, so **Share** copies an exact link to the current view, and back/forward work.
- KPI tiles and Key Metrics: averages, change against the previous period of the same length, correlation (R) and data quality, with daily sparklines.
- Dual-axis chart: line or area, drag-to-zoom navigator, tooltips, numbered pins on the three most unusual readings, CSV download of the plotted data.
- Stream comparison: absolute, or each average as a % of its stream's usual scale.
- Insights: quality breakdown, detected events by severity, a plain-English reading of the correlation and lag, and a recommended next step.
- Anomalies dialog: every flagged reading with a reason. **Zoom to this day** switches the view to 15-minute detail for that day.
- Light and dark themes (moon/sun button), loading, error and "no access" states.

The server never sends raw volumes: a 180-day view covers about 35,000 readings, and the chart receives at most 180 averaged points. The line under the filters shows how many readings were aggregated.

## Project structure

```
src/
  api/contract.ts      API contract - request and response types for every endpoint
  api/client.ts        fetch wrapper; mock or live mode; where the SSO token goes
  api/queries.ts       TanStack Query hooks (caching, cancelling, keeping data while refetching)
  auth/                mock sign-in and the useAccess() hook
  config/pages.ts      every page the app knows, in menu order
  layout/              app shell, sidebar with access-filtered menu, header actions
  routes/router.tsx    routes (TanStack Router)
  components/          shared: filters, section tabs, server-sorted table, pagination, widget states
  pages/data-streams/  Data Streams Analysis and its five widgets
  pages/operability/   All sites, Trend analysis, Missing data
  pages/concern-codes/ Instances, Site analysis
  mocks/               the mock backend: handlers, groups, data generators, analytics (+ tests)
vendor/                design system package (.tgz) until it is on your registry
```

## Connecting the real backend

The front end doesn't need to change beyond these steps.

1. **Implement the endpoints** in `src/api/contract.ts` with exactly those shapes:

   | Endpoint | Returns |
   |---|---|
   | `GET /api/me` | User, groups and resolved access |
   | `GET /api/sites` | Sites the user may see |
   | `GET /api/data-streams/pairs` | Available stream pairs |
   | `GET /api/data-streams/series?site&pair&from&to&maxPoints` | Aggregated points for the chart |
   | `GET /api/data-streams/summary?site&pair&from&to` | Averages, changes, correlation, quality, daily figures, events |
   | `GET /api/points`, `GET /api/parameters` | Monitoring points the user may see; parameter names |
   | `GET /api/operability/matrix?parameter&from&to` | Operability % per point and parameter (all permitted sites) |
   | `GET /api/operability/trend?site&parameter&from&to` | Trend buckets and latest values per location |
   | `GET /api/operability/breakdown?site&parameter&from&to` | Operability, missing, bad, flatline, impossible % |
   | `GET /api/quality/readings?site&parameter&from&to&flow&codes&limit` | Newest missing and bad readings |
   | `GET /api/missing/summary?site&parameter&from&to` | Totals, daily availability, availability by parameter |
   | `GET /api/missing/site-averages?parameter&from&to` | Availability per point, worst first |
   | `GET /api/concern-codes/instances?…` | Filtered, sorted, paged instances |
   | `GET /api/concern-codes/summary?site&parameter&code&from&to` | Totals, changes, buckets, per-point counts |

2. **Port the logic** from `src/mocks/analytics.ts` and `src/mocks/qualityHandlers.ts` (aggregation, correlation, lag, anomalies, operability and quality maths) into the backend or its SQL views. A daily rollup table per point, parameter and day (expected, missing, flatline, impossible) covers most of the quality endpoints. The unit tests in `src/mocks/*.test.ts` show the expected behaviour.
3. **Enforce access on the server** the same way `src/mocks/handlers.ts` does: page, widget and site checks on every data request.
4. **Add SSO**: sign in with Microsoft Entra ID (MSAL) and send the access token from `authHeaders()` in `src/api/client.ts`.
5. **Switch mode**: set `VITE_API_MODE=live` in `.env`. In development, `/api` is proxied to `http://localhost:8080` (see `vite.config.ts`); otherwise set `VITE_API_BASE_URL`.
6. **Remove the mock-only parts**: the "Viewing as" switcher and the `x-mock-user` header.

## Design system

The design system comes from `vendor/severn-trent-cwqm-design-system-0.1.0.tgz`. Once it's published to your private registry, replace it with a normal version:

```bash
npm install @severn-trent/cwqm-design-system@^0.1.0
```

## Known limitations

- Overview, CWQM, Compliance, Equipment, Reports, Alerts and Settings show "not built yet".
- The design system's Pagination draws every page number, so this app uses its own compact pagination for large results; worth moving into the design system.
- The change arrows on stream averages are coloured as "higher is better". For raw readings like temperature, a rise isn't good or bad; this needs a neutral option in the design system's `DeltaIndicator`.
- The design system's 11 accessibility findings (mostly contrast on solid tiles) also appear here until they are fixed in the package.
- Dates in the date pickers follow the browser's language settings.
