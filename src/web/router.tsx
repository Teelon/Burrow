import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { useHealth } from './lib/queries'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

function HomePage() {
  const health = useHealth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Burrow</h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Dig in. Nest your notes.
      </p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        API health:{' '}
        {health.isPending ? 'checking…' : health.isError ? 'unreachable' : 'ok'}
      </p>
    </div>
  )
}

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
