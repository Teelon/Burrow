import { useEffect } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'
import { InviteAccept } from './pages/InviteAccept'
import { ProjectHome } from './pages/ProjectHome'
import { MembersSettings } from './pages/MembersSettings'
import { useMe, useProjects } from './lib/queries'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

function IndexRedirect() {
  const navigate = useNavigate()
  const { data: me, isLoading: meLoading } = useMe()
  const { data: projects = [], isLoading: projectsLoading } = useProjects()

  useEffect(() => {
    if (meLoading || projectsLoading) return
    if (!me) {
      navigate({ to: '/login' })
      return
    }

    const savedProjectId = localStorage.getItem('burrow-last-project')
    const activeProject =
      projects.find((p) => p.id === savedProjectId) ||
      (me.lastProjectId && projects.find((p) => p.id === me.lastProjectId)) ||
      projects[0]

    if (activeProject) {
      navigate({ to: `/p/${activeProject.id}` })
    }
  }, [me, meLoading, projects, projectsLoading, navigate])

  return (
    <div className="flex h-screen items-center justify-center p-8 text-sm text-neutral-400">
      Loading Burrow…
    </div>
  )
}

import { NotepadEditor } from './editor/NotepadEditor'

function NotepadView() {
  const { notepadId } = useParams({ strict: false }) as { notepadId?: string }
  if (!notepadId) return <div>Select a notepad</div>
  return <NotepadEditor notepadId={notepadId} />
}

import { BoardView } from './components/boards/BoardView'

function BoardWrapper() {
  const { projectId, boardId } = useParams({ strict: false }) as {
    projectId?: string
    boardId?: string
  }
  if (!projectId || !boardId) {
    return <div className="p-8 text-sm text-neutral-400">Board not found</div>
  }
  return <BoardView boardId={boardId} projectId={projectId} />
}


function SettingsPlaceholder() {
  const { data: me } = useMe()
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Settings</h2>
      <p className="text-sm text-neutral-500">
        Signed in as: {me?.user?.name} ({me?.user?.email}) - Role: {me?.role}
      </p>
    </div>
  )
}

// Routes without shell
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  component: InviteAccept,
})

// Routes within app shell
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
})

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  component: IndexRedirect,
})

const projectHomeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId',
  component: ProjectHome,
})

const notepadRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId/notepads/$notepadId',
  component: NotepadView,
})

const boardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId/boards/$boardId',
  component: BoardWrapper,
})

import { TrashView } from './pages/TrashView'

const trashRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId/trash',
  component: TrashView,
})

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings',
  component: SettingsPlaceholder,
})

const membersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/members',
  component: MembersSettings,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  inviteRoute,
  shellRoute.addChildren([
    indexRoute,
    projectHomeRoute,
    notepadRoute,
    boardRoute,
    trashRoute,
    settingsRoute,
    membersRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
