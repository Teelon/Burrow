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
  Tag,
  User,
} from 'lucide-react';
import type { SlashContext } from '../../shared/slash';

export interface SuggestionDialogState {
  type: 'notepad' | 'task' | 'template' | null;
  blockToReplace?: any;
}

export function getCustomSlashItems(
  editor: BlockNoteEditor<any, any, any>,
  context: SlashContext,
  projectId: string,
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
      onItemClick: async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}/boards`);
          if (res.ok) {
            const boards = (await res.json()) as Array<{ id: string; name: string }>;
            if (boards.length > 0) {
              const b = boards[0]!;
              editor.insertInlineContent([
                {
                  type: 'mention',
                  props: {
                    kind: 'card',
                    id: b.id,
                    label: b.name,
                  },
                },
              ]);
            }
          }
        } catch (err) {
          console.error('Failed to link board', err);
        }
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
  onAttachTag?: (tagId: string) => void,
): Promise<DefaultReactSuggestionItem[]> {
  const cleanQ = query.trim();
  try {
    const res = await fetch(
      `/api/suggest?type=tag&projectId=${projectId}&q=${encodeURIComponent(cleanQ)}`,
    );
    if (!res.ok) return [];
    const tags = (await res.json()) as Array<{
      id: string;
      label: string;
      color?: string;
    }>;

    return tags.map((tag) => ({
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
              kind: 'card', // rendered as tag chip
              id: tag.id,
              label: `#${tag.label}`,
            },
          },
        ]);
      },
    }));
  } catch (err) {
    console.error('Failed to suggest tags', err);
    return [];
  }
}
