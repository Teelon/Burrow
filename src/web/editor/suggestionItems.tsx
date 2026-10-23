import * as chrono from 'chrono-node';
import type { DefaultReactSuggestionItem } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import {
  Calendar,
  CheckSquare,
  FileText,
  Kanban,
  Layout,
  LayoutTemplate,
  Plus,
  Tag,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SlashContext } from '../../shared/slash';

export interface SuggestionDialogState {
  type: 'notepad' | 'task' | 'template' | 'board' | null;
  blockToReplace?: any;
}

export function getCustomSlashItems(
  editor: BlockNoteEditor<any, any, any>,
  context: SlashContext,
  _projectId: string,
  onOpenDialog: (state: SuggestionDialogState) => void,
): DefaultReactSuggestionItem[] {
  const items: DefaultReactSuggestionItem[] = [];

  // /notepad
  items.push({
    title: 'Notepad',
    subtext: 'Link or create a nested notepad',
    aliases: ['note', 'doc', 'page', 'link'],
    group: 'Burrow References',
    icon: <FileText className="w-4 h-4 text-purple-500" />,
    onItemClick: () => {
      onOpenDialog({ type: 'notepad' });
    },
  });

  // /template
  items.push({
    title: 'Template',
    subtext: 'Start from a product spec, meeting notes, sprint plan…',
    aliases: ['starter', 'starter template', 'preset'],
    group: 'Burrow References',
    icon: <LayoutTemplate className="w-4 h-4 text-primary" />,
    onItemClick: () => {
      onOpenDialog({ type: 'template' });
    },
  });

  // /task
  items.push({
    title: 'Task Card',
    subtext: 'Create a Kanban task and link it',
    aliases: ['task', 'card', 'ticket'],
    group: 'Burrow References',
    icon: <Kanban className="w-4 h-4 text-emerald-500" />,
    onItemClick: () => {
      onOpenDialog({ type: 'task' });
    },
  });

  // /board
  if (context === 'notepad') {
    items.push({
      title: 'Board',
      subtext: 'Link to a Kanban board',
      aliases: ['board', 'kanban'],
      group: 'Burrow References',
      icon: <Layout className="w-4 h-4 text-blue-500" />,
      onItemClick: () => {
        onOpenDialog({ type: 'board' });
      },
    });
  }

  // /today & /tomorrow
  items.push({
    title: 'Today',
    subtext: 'Insert current date mention',
    aliases: ['date', 'today', 'now'],
    group: 'Dates',
    icon: <Calendar className="w-4 h-4 text-[var(--muted)]" />,
    onItemClick: () => {
      const now = new Date();
      editor.insertInlineContent([
        {
          type: 'mention',
          props: {
            kind: 'date',
            label: 'Today',
            isoDate: now.toISOString().slice(0, 10),
          },
        },
      ]);
    },
  });

  items.push({
    title: 'Tomorrow',
    subtext: 'Insert tomorrow date mention',
    aliases: ['date', 'tomorrow'],
    group: 'Dates',
    icon: <Calendar className="w-4 h-4 text-[var(--muted)]" />,
    onItemClick: () => {
      const tomorrow = new Date(Date.now() + 86400000);
      editor.insertInlineContent([
        {
          type: 'mention',
          props: {
            kind: 'date',
            label: 'Tomorrow',
            isoDate: tomorrow.toISOString().slice(0, 10),
          },
        },
      ]);
    },
  });

  return items;
}

/**
 * Suggestions for `@` menu: People, Notepads, Cards, Dates.
 */
export async function getAtMenuSuggestions(
  query: string,
  projectId: string,
  editor: BlockNoteEditor<any, any, any>,
): Promise<DefaultReactSuggestionItem[]> {
  const items: DefaultReactSuggestionItem[] = [];
  const cleanQ = query.trim();

  // 1. Natural date suggestions
  const parsedDate = chrono.parseDate(cleanQ);
  if (parsedDate) {
    const formatted = parsedDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    items.push({
      title: formatted,
      subtext: `Natural date: "${cleanQ}"`,
      group: 'Dates',
      icon: <Calendar className="w-4 h-4 text-amber-500" />,
      onItemClick: () => {
        editor.insertInlineContent([
          {
            type: 'mention',
            props: {
              kind: 'date',
              label: formatted,
              isoDate: parsedDate.toISOString().slice(0, 10),
            },
          },
        ]);
      },
    });
  } else if (!cleanQ || 'today'.includes(cleanQ.toLowerCase())) {
    items.push({
      title: 'Today',
      subtext: new Date().toLocaleDateString(),
      group: 'Dates',
      icon: <Calendar className="w-4 h-4 text-amber-500" />,
      onItemClick: () => {
        editor.insertInlineContent([
          {
            type: 'mention',
            props: {
              kind: 'date',
              label: 'Today',
              isoDate: new Date().toISOString().slice(0, 10),
            },
          },
        ]);
      },
    });
  }

  // 2. Fetch People
  try {
    const userRes = await fetch(`/api/suggest?type=user&q=${encodeURIComponent(cleanQ)}`);
    if (userRes.ok) {
      const users = (await userRes.json()) as Array<{
        id: string;
        label: string;
        description?: string;
      }>;
      for (const u of users) {
        items.push({
          title: u.label,
          subtext: u.description || 'Workspace member',
          group: 'People',
          icon: <User className="w-4 h-4 text-blue-500" />,
          onItemClick: () => {
            editor.insertInlineContent([
              {
                type: 'mention',
                props: {
                  kind: 'user',
                  id: u.id,
                  label: u.label,
                },
              },
            ]);
          },
        });
      }
    }
  } catch (err) {
    console.error('Failed to suggest users', err);
  }

  // 3. Fetch Notepads
  try {
    const npRes = await fetch(
      `/api/suggest?type=notepad&projectId=${projectId}&q=${encodeURIComponent(cleanQ)}`,
    );
    if (npRes.ok) {
      const notepads = (await npRes.json()) as Array<{
        id: string;
        label: string;
        icon?: string;
      }>;
      for (const np of notepads) {
        items.push({
          title: np.label || 'Untitled',
          subtext: 'Project notepad',
          group: 'Notepads',
          icon: <FileText className="w-4 h-4 text-purple-500" />,
          onItemClick: () => {
            editor.insertInlineContent([
              {
                type: 'mention',
                props: {
                  kind: 'notepad',
                  id: np.id,
                  label: np.label || 'Untitled',
                },
              },
            ]);
          },
        });
      }
    }
  } catch (err) {
    console.error('Failed to suggest notepads', err);
  }

  // 4. Fetch Cards
  try {
    const cardRes = await fetch(
      `/api/suggest?type=card&projectId=${projectId}&q=${encodeURIComponent(cleanQ)}`,
    );
    if (cardRes.ok) {
      const cards = (await cardRes.json()) as Array<{
        id: string;
        label: string;
        description?: string;
      }>;
      for (const c of cards) {
        items.push({
          title: c.label || 'Untitled',
          subtext: c.description ? `Board: ${c.description}` : 'Card',
          group: 'Task Cards',
          icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
          onItemClick: () => {
            editor.insertInlineContent([
              {
                type: 'mention',
                props: {
                  kind: 'card',
                  id: c.id,
                  label: c.label || 'Untitled',
                },
              },
            ]);
          },
        });
      }
    }
  } catch (err) {
    console.error('Failed to suggest cards', err);
  }

  return items;
}

/**
 * Suggestions for `#` menu: Project Tags.
 */
export async function getHashMenuSuggestions(
  query: string,
  projectId: string,
  _notepadId: string,
  editor: BlockNoteEditor<any, any, any>,
  onAttachTag?: (tagId: string) => void | Promise<void>,
): Promise<DefaultReactSuggestionItem[]> {
  const cleanQ = query.trim().replace(/^#/, '');
  try {
    const res = await fetch(
      `/api/suggest?type=tag&projectId=${projectId}&q=${encodeURIComponent(cleanQ)}`,
    );
    let tags: Array<{
      id: string;
      label: string;
      color?: string;
    }> = [];
    if (res.ok) {
      tags = (await res.json()) as Array<{
        id: string;
        label: string;
        color?: string;
      }>;
    }

    const items: DefaultReactSuggestionItem[] = tags.map((tag) => ({
      title: tag.label,
      group: 'Tags',
      icon: <Tag className="w-4 h-4" style={{ color: tag.color || '#64748b' }} />,
      onItemClick: () => {
        if (onAttachTag) {
          onAttachTag(tag.id);
        }
        editor.insertInlineContent([
          {
            type: 'mention',
            props: {
              kind: 'tag',
              id: tag.id,
              label: `#${tag.label}`,
            },
          },
        ]);
      },
    }));

    const exactMatch = tags.some((t) => t.label.toLowerCase() === cleanQ.toLowerCase());
    if (cleanQ.length > 0 && !exactMatch) {
      items.push({
        title: `Create #${cleanQ}`,
        group: 'Tags',
        icon: <Plus className="w-4 h-4 text-emerald-500" />,
        onItemClick: async () => {
          try {
            const createRes = await fetch(`/api/projects/${projectId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: cleanQ }),
            });
            if (!createRes.ok) {
              const errJson = (await createRes.json().catch(() => ({}))) as {
                error?: { message?: string };
                message?: string;
              };
              throw new Error(errJson.error?.message || errJson.message || 'Failed to create tag');
            }
            const newTag = (await createRes.json()) as { id: string; name: string };
            if (onAttachTag) {
              await onAttachTag(newTag.id);
            }
            editor.insertInlineContent([
              {
                type: 'mention',
                props: {
                  kind: 'tag',
                  id: newTag.id,
                  label: `#${newTag.name}`,
                },
              },
            ]);
          } catch (err: any) {
            toast.error(err?.message || 'Failed to create tag');
          }
        },
      });
    }

    return items;
  } catch (err) {
    console.error('Failed to suggest tags', err);
    return [];
  }
}
