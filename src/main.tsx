import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import '@severn-trent/cwqm-design-system/styles.css';
import './app.css';
import { router } from './routes/router';
import { API_MODE } from './api/client';
import { ApiError } from './api/client';
import { applySavedTheme } from './lib/theme';

applySavedTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry "no access" or "bad request" - only transient failures.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

async function start() {
  if (API_MODE === 'mock') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
start();
