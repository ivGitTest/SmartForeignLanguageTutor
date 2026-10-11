import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@workspace/replit-auth-web';
import {
  getGetPrototypeConfigQueryKey,
  setBaseUrl,
  useGetPrototypeConfig,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginScreen } from '@/components/login-screen';
import { ConfigErrorScreen, ForbiddenScreen } from '@/components/gate-screens';
import { AppShell } from '@/components/app-shell';
import { WorkspaceProvider } from '@/hooks/use-workspace';
import Workspace from '@/pages/workspace';
import SettingsPage from '@/pages/settings';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
setBaseUrl(BASE);

const queryClient = new QueryClient();

function Loading() {
  return (
    <div className="min-h-[100dvh] p-8 max-w-3xl mx-auto grid gap-4 content-center" data-testid="state-auth-loading">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40" />
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ConfigGate({ userId }: { userId: string }) {
  const q = useGetPrototypeConfig({
    query: { enabled: true, retry: false, staleTime: Infinity, refetchOnWindowFocus: false, queryKey: getGetPrototypeConfigQueryKey() },
  });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) {
    const status =
      typeof q.error === 'object' && q.error !== null && typeof (q.error as { status?: unknown }).status === 'number'
        ? ((q.error as { status: number }).status)
        : null;
    const retry = () => void q.refetch();
    if (status === 403) return <ForbiddenScreen userId={userId} onRetry={retry} />;
    return <ConfigErrorScreen userId={userId} status={status} onRetry={retry} />;
  }
  return (
    <WorkspaceProvider config={q.data} userId={userId}>
      <AppShell>
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/" component={Workspace} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </AppShell>
    </WorkspaceProvider>
  );
}

function AuthGate() {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <Loading />;
  if (!isAuthenticated || !user) return <LoginScreen />;
  return <ConfigGate key={user.id} userId={user.id} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={BASE}>
          <AuthGate />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
