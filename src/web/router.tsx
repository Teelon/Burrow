import { useEffect, useState } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import { InviteAccept } from './pages/InviteAccept';
import { ProjectHome } from './pages/ProjectHome';
import { MembersSettings } from './pages/MembersSettings';
import { MyTasksView } from './pages/MyTasksView';
import { useMe, useProjects, useSignOut } from './lib/queries';
import { Button } from './components/ui/Button';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  errorComponent: ({ error, reset }) => (
    <div className="flex h-screen flex-col items-center justify-center p-8 text-center bg-[var(--bg)] text-[var(--text)]">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
      <p className="text-xs text-[var(--muted)] max-w-md mb-6">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
      <button
        onClick={() => {
          reset();
          window.location.reload();
        }}
        className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-ink)] text-xs font-semibold hover:opacity-90 transition cursor-pointer"
      >
        Reload Page
      </button>
    </div>
  ),
});

function IndexRedirect() {
  const navigate = useNavigate();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  useEffect(() => {
    if (meLoading || projectsLoading) return;
    if (!me) {
      navigate({ to: '/login' });
      return;
    }

    const savedProjectId = localStorage.getItem('burrow-last-project');
    const activeProject =
      projects.find((p) => p.id === savedProjectId) ||
      (me.lastProjectId && projects.find((p) => p.id === me.lastProjectId)) ||
      projects[0];

    if (activeProject) {
      navigate({ to: `/p/${activeProject.id}` });
    }
  }, [me, meLoading, projects, projectsLoading, navigate]);

  return (
    <div className="flex h-screen items-center justify-center p-8 text-sm text-[var(--muted)]">
      Loading Burrow…
    </div>
  );
}

import { NotepadEditor } from './editor/NotepadEditor';

function NotepadView() {
  const { notepadId } = useParams({ strict: false }) as { notepadId?: string };
  if (!notepadId) return <div className="p-8 text-sm text-[var(--muted)]">Select a notepad</div>;
  return (
    <div className="flex-1 overflow-y-auto w-full">
      <NotepadEditor notepadId={notepadId} />
    </div>
  );
}

import { BoardView } from './components/boards/BoardView';

function BoardWrapper() {
  const { projectId, boardId } = useParams({ strict: false }) as {
    projectId?: string;
    boardId?: string;
  };
  if (!projectId || !boardId) {
    return <div className="p-8 text-sm text-[var(--muted)]">Board not found</div>;
  }
  return <BoardView boardId={boardId} projectId={projectId} />;
}

function SettingsPlaceholder() {
  const { data: me } = useMe();
  const signOut = useSignOut();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>
      <div className="border border-[var(--line)] bg-[var(--surface)] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Account Details</h3>
        <p className="text-sm text-[var(--muted)]">
          Signed in as: <strong className="text-[var(--text)]">{me?.user?.name || 'User'}</strong> ({me?.user?.email}) &mdash; Role: <span className="uppercase text-xs font-mono">{me?.role}</span>
        </p>
        <div className="pt-2">
          <Button
            variant="danger"
            onClick={() => setConfirmSignOut(true)}
            className="flex items-center gap-2 min-h-[44px] sm:min-h-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="Log out"
        message="Are you sure you want to log out of your account?"
        confirmLabel="Log out"
        danger={false}
        busy={signOut.isPending}
        onConfirm={async () => {
          try {
            await signOut.mutateAsync();
          } catch (err: any) {
            toast.error(err?.message || 'Failed to sign out');
            setConfirmSignOut(false);
          }
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </div>
  );
}

// Routes without shell
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  component: InviteAccept,
});

// Routes within app shell
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  component: IndexRedirect,
});

const projectHomeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId',
  component: ProjectHome,
});

const notepadRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId/notepads/$notepadId',
  component: NotepadView,
});

const boardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId/boards/$boardId',
  component: BoardWrapper,
});

import { TrashView } from './pages/TrashView';

const trashRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/p/$projectId/trash',
  component: TrashView,
});

const myTasksRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/my-tasks',
  component: MyTasksView,
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings',
  component: SettingsPlaceholder,
});

const membersRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/settings/members',
  component: MembersSettings,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  inviteRoute,
  shellRoute.addChildren([
    indexRoute,
    projectHomeRoute,
    notepadRoute,
    boardRoute,
    myTasksRoute,
    trashRoute,
    settingsRoute,
    membersRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
