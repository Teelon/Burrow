import { useState, useRef, useEffect } from 'react'
import { Bell, Check } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useMarkNotificationsRead, useNotifications } from '../../lib/queries'

interface NotificationItem {
  id: string
  type: 'mention' | 'assigned'
  actor: {
    id: string
    name: string
    image?: string | null
  }
  notepadId?: string | null
  cardId?: string | null
  targetTitle?: string
  readAt?: number | null
  createdAt: number
}

export function NotificationsBell({ projectId }: { projectId?: string }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [] } = useNotifications()
  const markReadMutation = useMarkNotificationsRead()

  const unreadCount = notifications.filter((n) => !n.readAt).length

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.readAt) {
      markReadMutation.mutate([notif.id])
    }
    setIsOpen(false)

    if (notif.notepadId && projectId) {
      navigate({
        to: '/p/$projectId/notepads/$notepadId',
        params: { projectId, notepadId: notif.notepadId },
      })
    }
  }

  const handleMarkAllRead = () => {
    markReadMutation.mutate(undefined)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-neutral-950" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in select-none">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-neutral-100 dark:border-neutral-800">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto py-1 space-y-1">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 italic">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-2.5 rounded-xl cursor-pointer transition flex items-start gap-2.5 ${
                    !n.readAt
                      ? 'bg-primary/5 hover:bg-primary/10 text-neutral-900 dark:text-neutral-100'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                    {n.actor.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="leading-tight">
                      <strong>{n.actor.name}</strong>{' '}
                      {n.type === 'mention' ? 'mentioned you in' : 'assigned you to'}{' '}
                      <span className="font-medium text-neutral-900 dark:text-neutral-200">
                        {n.targetTitle || 'a task'}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {!n.readAt && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
