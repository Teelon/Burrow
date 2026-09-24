import { useState, useRef, useEffect } from 'react';
import { Bell, Check } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useMarkNotificationsRead, useNotifications } from '../../lib/queries';
import { Avatar } from '../ui/Avatar';
import { StatusDiamond } from '../ui/StatusDiamond';

interface NotificationItem {
  id: string;
  type: 'mention' | 'assigned';
  actor: {
    id: string;
    name: string;
    image?: string | null;
  };
  notepadId?: string | null;
  cardId?: string | null;
  targetTitle?: string;
  readAt?: number | null;
  createdAt: number;
}

export function NotificationsBell({ projectId }: { projectId?: string }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useNotifications();
  const markReadMutation = useMarkNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.readAt) {
      markReadMutation.mutate([notif.id]);
    }
    setIsOpen(false);

    if (notif.notepadId && projectId) {
      navigate({
        to: '/p/$projectId/notepads/$notepadId',
        params: { projectId, notepadId: notif.notepadId },
      });
    }
  };

  const handleMarkAllRead = () => {
    markReadMutation.mutate(undefined);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-11 w-11 md:h-8 md:w-8 items-center justify-center text-muted hover:text-text hover:bg-hi transition"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 md:top-1.5 md:right-1.5 h-2 w-2 rotate-45 bg-accent" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-surface border border-line p-2 z-50 text-xs select-none">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-hair">
            <span className="font-semibold text-text">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium min-h-[44px] md:min-h-0"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto py-1 space-y-1">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted italic">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`relative p-2.5 cursor-pointer transition flex items-start gap-2.5 min-h-[44px] ${
                    !n.readAt
                      ? 'bg-accent/10 hover:bg-accent/20 text-text'
                      : 'hover:bg-hi text-muted'
                  }`}
                >
                  {!n.readAt && (
                    <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                  )}
                  <Avatar name={n.actor.name} src={n.actor.image} size="xs" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="leading-tight">
                      <strong>{n.actor.name}</strong>{' '}
                      {n.type === 'mention' ? 'mentioned you in' : 'assigned you to'}{' '}
                      <span className="font-medium text-text">{n.targetTitle || 'a task'}</span>
                    </div>
                    <div className="text-[10px] text-muted mt-1">
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {!n.readAt && <StatusDiamond color="var(--accent)" size={6} className="mt-1.5" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
