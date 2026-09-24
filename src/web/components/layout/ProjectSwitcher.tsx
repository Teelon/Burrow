import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronDown, FolderPlus, Plus } from 'lucide-react'
import { useProjects, useCreateProject } from '../../lib/queries'

interface ProjectSwitcherProps {
  currentProjectId?: string
}

export function ProjectSwitcher({ currentProjectId }: ProjectSwitcherProps) {
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects()
  const createProject = useCreateProject()

  const [isOpen, setIsOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectIcon, setNewProjectIcon] = useState('📁')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || projects[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (projectId: string) => {
    localStorage.setItem('burrow-last-project', projectId)
    setIsOpen(false)
    navigate({ to: `/p/${projectId}` })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    const res = await createProject.mutateAsync({
      name: newProjectName.trim(),
      icon: newProjectIcon,
    })
    setNewProjectName('')
    setShowCreateModal(false)
    handleSelect(res.id)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">
            {currentProject?.icon || '📁'}
          </span>
          <span className="truncate text-neutral-800 dark:text-neutral-200">
            {currentProject?.name || 'Select Project'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1.5 z-50">
          <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Projects
          </div>
          <div className="max-h-60 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left transition"
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{p.icon || '📁'}</span>
                  <span className="truncate text-neutral-700 dark:text-neutral-300">
                    {p.name}
                  </span>
                </div>
                {p.id === currentProject?.id && (
                  <Check className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false)
                setShowCreateModal(true)
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left transition"
            >
              <Plus className="w-4 h-4" />
              <span>New project</span>
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-primary" /> Create Project
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Icon & Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProjectIcon}
                    onChange={(e) => setNewProjectIcon(e.target.value)}
                    className="w-12 text-center text-lg border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800"
                    maxLength={2}
                  />
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name"
                    autoFocus
                    className="flex-1 px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-sm rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || createProject.isPending}
                  className="px-4 py-1.5 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-50"
                >
                  {createProject.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
