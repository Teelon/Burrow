import { useState, useRef, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useProjects, useCreateProject } from '../../lib/queries';
import { Avatar } from '../ui/Avatar';
import { ModalShell } from '../ui/ModalShell';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface ProjectSwitcherProps {
  currentProjectId?: string;
}

export function ProjectSwitcher({ currentProjectId }: ProjectSwitcherProps) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectIcon, setNewProjectIcon] = useState('📁');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (projectId: string) => {
    localStorage.setItem('burrow-last-project', projectId);
    setIsOpen(false);
    navigate({ to: `/p/${projectId}` });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const res = await createProject.mutateAsync({
      name: newProjectName.trim(),
      icon: newProjectIcon,
    });
    setNewProjectName('');
    setShowCreateModal(false);
    handleSelect(res.id);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-text hover:bg-hi transition min-h-[44px] md:min-h-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={currentProject?.name || 'Select Project'} size="xs" />
          <span className="truncate text-text">{currentProject?.name || 'Select Project'}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-line py-1.5 z-50">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted uppercase tracking-wider">
            Projects
          </div>
          <div className="max-h-60 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-hi text-left transition min-h-[44px] md:min-h-0"
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{p.icon || '📁'}</span>
                  <span className="truncate text-text">{p.name}</span>
                </div>
                {p.id === currentProject?.id && <Check className="w-4 h-4 text-accent shrink-0" />}
              </button>
            ))}
          </div>

          <div className="border-t border-hair mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                setShowCreateModal(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-text hover:bg-hi text-left transition min-h-[44px] md:min-h-0"
            >
              <Plus className="w-4 h-4" />
              <span>New project</span>
            </button>
          </div>
        </div>
      )}

      <ModalShell
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Project"
        className="sm:max-w-sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Icon & Name</label>
            <div className="flex gap-2">
              <Input
                value={newProjectIcon}
                onChange={(e) => setNewProjectIcon(e.target.value)}
                maxLength={2}
                aria-label="Project icon"
                className="w-12 shrink-0 text-center text-lg"
              />
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name"
                autoFocus
                aria-label="Project name"
                className="min-w-0 flex-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!newProjectName.trim() || createProject.isPending}
            >
              {createProject.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
