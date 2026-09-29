import { createRootRoute, createRoute, createRouter, Navigate, useParams } from '@tanstack/react-router';
import { AppLayout } from '../layout/AppLayout';
import { FullPageMessage } from '../layout/FullPageMessage';
import { PAGES } from '../config/pages';
import { useAccess } from '../auth/useAccess';
import { DataStreamsPage, validateDataStreamsSearch } from '../pages/data-streams/DataStreamsPage';
import { OperabilityAllSitesPage, validateAllSitesSearch } from '../pages/operability/AllSitesPage';
import { OperabilityTrendPage, validateTrendSearch } from '../pages/operability/TrendPage';
import { MissingDataPage, validateMissingSearch } from '../pages/operability/MissingDataPage';
import { ConcernInstancesPage, validateInstancesSearch } from '../pages/concern-codes/InstancesPage';
import { ConcernSiteAnalysisPage, validateAnalysisSearch } from '../pages/concern-codes/SiteAnalysisPage';

const rootRoute = createRootRoute({
  component: AppLayout,
  notFoundComponent: () => <FullPageMessage title="Page not found" text="Check the address, or pick a page from the menu." />,
});

/** "/" sends people to the first built page they can use. */
function Home() {
  const { canPage } = useAccess();
  const first = PAGES.find((p) => p.built && canPage(p.id)) ?? PAGES.find((p) => canPage(p.id));
  return first ? <Navigate to={first.path} replace /> : <FullPageMessage title="No dashboards yet" text="Your account isn't in any dashboard group. Ask your CWQM administrator for access." />;
}

function OtherPage() {
  const { page } = useParams({ from: '/$page' });
  const { canPage } = useAccess();
  const def = PAGES.find((p) => p.path === `/${page}`);
  if (!def) return <FullPageMessage title="Page not found" />;
  if (!canPage(def.id)) return <FullPageMessage title="No access" text={`Your groups don't include ${def.label}.`} />;
  return <FullPageMessage title={def.label} text="This dashboard hasn't been built yet. Data Streams is the first one." />;
}

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const dataStreamsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/data-streams', validateSearch: validateDataStreamsSearch, component: DataStreamsPage });
const operabilityRoute = createRoute({ getParentRoute: () => rootRoute, path: '/operability', validateSearch: validateAllSitesSearch, component: OperabilityAllSitesPage });
const trendRoute = createRoute({ getParentRoute: () => rootRoute, path: '/operability/trend', validateSearch: validateTrendSearch, component: OperabilityTrendPage });
const missingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/operability/missing-data', validateSearch: validateMissingSearch, component: MissingDataPage });
const instancesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/concern-codes', validateSearch: validateInstancesSearch, component: ConcernInstancesPage });
const analysisRoute = createRoute({ getParentRoute: () => rootRoute, path: '/concern-codes/site-analysis', validateSearch: validateAnalysisSearch, component: ConcernSiteAnalysisPage });
const otherRoute = createRoute({ getParentRoute: () => rootRoute, path: '/$page', component: OtherPage });

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, dataStreamsRoute, operabilityRoute, trendRoute, missingRoute, instancesRoute, analysisRoute, otherRoute]),
});

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
