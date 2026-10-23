import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Archive, LogOut, Plus, Settings, Tag, Trash2, User, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateTag,
  useDeleteProject,
  useDeleteTag,
  useMe,
  useProjects,
  useProjectTags,
  useSignOut,
  useUpdateProject,
} from '../lib/queries';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusDiamond } from '../components/ui/StatusDiamond';

const ICON_PRESETS = ['📁', '🚀', '⚡', '🎯', '🛠️', '💡', '📊', '📝', '📦', '✨'];
const COLOR_PRESETS = [
  '#6366f1',
  '#059669',
  '#d97706',
  '#dc2626',
  '#9333ea',
  '#0284c7',
  '#64748b',
];

export function SettingsView() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const signOut = useSignOut();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const createTagMutation = useCreateTag();
  const deleteTagMutation = useDeleteTag();

  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Selected project state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      const savedProjectId = localStorage.getItem('burrow-last-project');
      const found = projects.find((p) => p.id === savedProjectId) || projects[0];
      if (found) {
        setSelectedProjectId(found.id);
      }
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Project details form
  const [projectName, setProjectName] = useState('');
  const [projectIcon, setProjectIcon] = useState('📁');
  const [projectColor, setProjectColor] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProject) {
      setProjectName(selectedProject.name);
      setProjectIcon(selectedProject.icon || '📁');
      setProjectColor(selectedProject.color || null);
    }
  }, [selectedProject?.id]);

  // Project archive / delete confirm dialogs
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [confirmDeleteProjectOpen, setConfirmDeleteProjectOpen] = useState(false);

  // Tag management
  const { data: projectTags = [] } = useProjectTags(selectedProject?.id);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>('#6366f1');
  const [tagToDelete, setTagToDelete] = useState<{ id: string; name: string } | null>(null);

  const isViewer = me?.role === 'viewer';
  const isArchived = Boolean(selectedProject?.archivedAt);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !projectName.trim()) return;

    try {
      await updateProjectMutation.mutateAsync({
        id: selectedProject.id,
        name: projectName.trim(),
        icon: projectIcon,
        color: projectColor,
      });
      toast.success('Project settings saved');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update project');
    }
  };

  const handleToggleArchive = async () => {
    if (!selectedProject) return;
    const nextArchived = !isArchived;
    try {
      await updateProjectMutation.mutateAsync({
        id: selectedProject.id,
        archived: nextArchived,
      });
      toast.success(nextArchived ? 'Project archived' : 'Project unarchived');
      setConfirmArchiveOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update archive status');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    try {
      await deleteProjectMutation.mutateAsync({
        id: selectedProject.id,
        confirmName: selectedProject.name,
      });
      toast.success('Project deleted');
      setConfirmDeleteProjectOpen(false);
      localStorage.removeItem('burrow-last-project');
      navigate({ to: '/' });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete project');
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newTagName.trim()) return;

    try {
      await createTagMutation.mutateAsync({
        projectId: selectedProject.id,
        name: newTagName.trim(),
        color: newTagColor,
      });
      setNewTagName('');
      toast.success('Tag created');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create tag');
    }
  };

  const handleDeleteTag = async () => {
    if (!selectedProject || !tagToDelete) return;
    try {
      await deleteTagMutation.mutateAsync({
        tagId: tagToDelete.id,
        projectId: selectedProject.id,
      });
      toast.success('Tag deleted');
      setTagToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete tag');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Settings</h1>
          <p className="text-sm text-[var(--muted)]">
            Manage your profile, project preferences, and workflow tags.
          </p>
        </div>

        {/* Section 1: Profile Details */}
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[var(--hair)] pb-3">
            <User className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
              Profile & Account
            </h2>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar name={me?.user?.name || 'User'} size="lg" />
              <div>
                <div className="text-base font-semibold text-[var(--text)]">
                  {me?.user?.name || 'User'}
                </div>
                <div className="text-xs text-[var(--muted)]">{me?.user?.email}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--muted)]">Workspace Role:</span>
                  <Badge className="uppercase text-[10px] tracking-wider font-mono">
                    {me?.role || 'member'}
                  </Badge>
                </div>
              </div>
            </div>

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

        {/* Section 2: Project Settings */}
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--hair)] pb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
                Project Settings
              </h2>
            </div>

            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Configuring:</span>
                <Select
                  value={selectedProject?.id || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-2.5 py-1 text-xs font-medium min-h-[44px] sm:min-h-0"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.icon || '📁'} {p.name} {p.archivedAt ? '(Archived)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {projectsLoading ? (
            <div className="text-xs text-[var(--muted)] py-4">Loading project settings…</div>
          ) : !selectedProject ? (
            <div className="text-xs text-[var(--muted)] italic py-4">No projects available.</div>
          ) : (
            <form onSubmit={handleSaveProject} className="space-y-4">
              {/* Project Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text)]">Project Name</label>
                <Input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={isViewer}
                  className="w-full text-sm"
                  placeholder="e.g. Core App"
                />
              </div>

              {/* Icon Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text)]">Project Icon</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="text"
                    value={projectIcon}
                    onChange={(e) => setProjectIcon(e.target.value)}
                    disabled={isViewer}
                    className="w-20 text-center text-lg"
                    maxLength={4}
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {ICON_PRESETS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setProjectIcon(icon)}
                        disabled={isViewer}
                        className={`w-8 h-8 flex items-center justify-center text-base border transition ${
                          projectIcon === icon
                            ? 'border-[var(--accent)] bg-[var(--hi)]'
                            : 'border-[var(--line)] bg-[var(--surface2)] hover:border-[var(--muted)]'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text)]">Accent Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((color) => {
                    const isSelected = projectColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setProjectColor(isSelected ? null : color)}
                        disabled={isViewer}
                        className={`w-7 h-7 flex items-center justify-center border transition ${
                          isSelected ? 'border-[var(--text)] scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                  {projectColor && (
                    <button
                      type="button"
                      onClick={() => setProjectColor(null)}
                      disabled={isViewer}
                      className="text-xs text-[var(--muted)] hover:text-[var(--text)] underline ml-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Save Button */}
              {!isViewer && (
                <div className="pt-2 flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={updateProjectMutation.isPending || !projectName.trim()}
                    className="min-h-[44px] sm:min-h-0"
                  >
                    {updateProjectMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              )}

              {/* Danger Zone: Archive / Delete */}
              {!isViewer && (
                <div className="pt-6 border-t border-[var(--hair)] space-y-3">
                  <h3 className="text-xs font-semibold text-[var(--danger)] uppercase tracking-wider">
                    Danger Zone
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmArchiveOpen(true)}
                      className="flex items-center gap-2 border border-[var(--line)] min-h-[44px] sm:min-h-0 text-xs"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{isArchived ? 'Unarchive Project' : 'Archive Project'}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => setConfirmDeleteProjectOpen(true)}
                      className="flex items-center gap-2 min-h-[44px] sm:min-h-0 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Project…</span>
                    </Button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Section 3: Tag Management */}
        <div className="border border-[var(--line)] bg-[var(--surface)] p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[var(--hair)] pb-3">
            <Tag className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text)]">
              Tag Management
            </h2>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Tags scoped to <strong>{selectedProject?.name || 'current project'}</strong>. Use tags
            on kanban cards to group tasks and filter work.
          </p>

          {/* New Tag Form */}
          {!isViewer && selectedProject && (
            <form onSubmit={handleCreateTag} className="flex items-center gap-2 flex-wrap">
              <Input
                type="text"
                required
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name (e.g. bug, urgent)"
                className="flex-1 min-w-[200px] text-xs px-3 py-1.5 min-h-[44px] sm:min-h-0"
              />
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-6 h-6 flex items-center justify-center border transition ${
                      newTagColor === c ? 'border-[var(--text)] scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {newTagColor === c && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={createTagMutation.isPending || !newTagName.trim()}
                className="flex items-center gap-1.5 min-h-[44px] sm:min-h-0 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{createTagMutation.isPending ? 'Adding…' : 'Add Tag'}</span>
              </Button>
            </form>
          )}

          {/* Existing Tags List */}
          <div className="space-y-2 pt-2">
            {projectTags.length === 0 ? (
              <div className="text-xs text-[var(--muted)] italic py-2">
                No tags created for this project yet.
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {projectTags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 border border-[var(--line)] bg-[var(--surface2)] text-xs font-medium text-[var(--text)] select-none"
                  >
                    <StatusDiamond color={tag.color || '#6366f1'} size={8} />
                    <span>#{tag.name}</span>
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => setTagToDelete({ id: tag.id, name: tag.name })}
                        className="text-[var(--muted)] hover:text-[var(--danger)] transition ml-1"
                        title={`Delete tag #${tag.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Sign Out */}
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

      {/* Confirm Archive Project */}
      {selectedProject && (
        <ConfirmDialog
          open={confirmArchiveOpen}
          title={isArchived ? 'Unarchive Project' : 'Archive Project'}
          message={
            isArchived
              ? `Restore project "${selectedProject.name}" to active status?`
              : `Archive project "${selectedProject.name}"? It will be hidden from default views.`
          }
          confirmLabel={isArchived ? 'Unarchive' : 'Archive'}
          danger={!isArchived}
          busy={updateProjectMutation.isPending}
          onConfirm={handleToggleArchive}
          onCancel={() => setConfirmArchiveOpen(false)}
        />
      )}

      {/* Confirm Delete Project */}
      {selectedProject && (
        <ConfirmDialog
          open={confirmDeleteProjectOpen}
          title="Delete Project"
          message={`Are you sure you want to permanently delete "${selectedProject.name}" and all its notepads, boards, and cards? This action cannot be undone.`}
          confirmLabel="Delete Project"
          danger={true}
          busy={deleteProjectMutation.isPending}
          onConfirm={handleDeleteProject}
          onCancel={() => setConfirmDeleteProjectOpen(false)}
        />
      )}

      {/* Confirm Delete Tag */}
      {tagToDelete && (
        <ConfirmDialog
          open={!!tagToDelete}
          title="Delete Tag"
          message={`Are you sure you want to delete tag "#${tagToDelete.name}"? Cards with this tag will keep their content.`}
          confirmLabel="Delete Tag"
          danger={true}
          busy={deleteTagMutation.isPending}
          onConfirm={handleDeleteTag}
          onCancel={() => setTagToDelete(null)}
        />
      )}
    </div>
  );
}
