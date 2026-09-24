import {
  BOARD_LINK_BLOCK,
  CARD_LINK_BLOCK,
  MENTION_INLINE,
  NOTEPAD_LINK_BLOCK,
  type LinkTargetType,
  type MentionKind,
  type MentionProps,
} from './blocks';

export interface ExtractedMention {
  kind: MentionKind;
  id: string | null;
  label: string;
  isoDate: string | null;
}

export interface ExtractedLink {
  targetType: LinkTargetType;
  targetId: string;
}

export interface ExtractResult {
  /** Plain text of all blocks (used for the FTS index). */
  text: string;
  /** Mention chips in document order, deduplicated by kind + id/date/label. */
  mentions: ExtractedMention[];
  /** Deduplicated reference targets found in mentions and link blocks. */
  links: ExtractedLink[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseDoc(content: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readMentionProps(props: unknown): MentionProps | null {
  if (!isRecord(props)) return null;
  const kind = props.kind;
  if (kind !== 'user' && kind !== 'notepad' && kind !== 'card' && kind !== 'date') return null;
  return {
    kind,
    id: typeof props.id === 'string' ? props.id : undefined,
    label: typeof props.label === 'string' ? props.label : '',
    isoDate: typeof props.isoDate === 'string' ? props.isoDate : undefined,
  };
}

function readLinkId(props: unknown, key: string): string | null {
  if (!isRecord(props)) return null;
  const value = props[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

interface WalkState {
  text: string[];
  mentions: Map<string, ExtractedMention>;
  links: Map<string, ExtractedLink>;
}

function addLink(state: WalkState, targetType: LinkTargetType, targetId: string) {
  state.links.set(`${targetType}:${targetId}`, { targetType, targetId });
}

function walkInline(content: unknown, state: WalkState) {
  if (!Array.isArray(content)) return;
  for (const item of content) {
    if (typeof item === 'string') {
      state.text.push(item);
      continue;
    }
    if (!isRecord(item)) continue;
    if (item.type === MENTION_INLINE) {
      const props = readMentionProps(item.props);
      if (!props) continue;
      state.text.push(props.label);
      const key = `${props.kind}:${props.id ?? props.isoDate ?? props.label}`;
      if (!state.mentions.has(key)) {
        state.mentions.set(key, {
          kind: props.kind,
          id: props.id ?? null,
          label: props.label,
          isoDate: props.isoDate ?? null,
        });
      }
      if (
        props.id &&
        (props.kind === 'user' || props.kind === 'notepad' || props.kind === 'card')
      ) {
        addLink(state, props.kind, props.id);
      }
      continue;
    }
    if (typeof item.text === 'string') {
      state.text.push(item.text);
      continue;
    }
    // Inline containers (e.g. link-styled runs) nest content arrays.
    if (Array.isArray(item.content)) walkInline(item.content, state);
  }
}

function walkBlocks(blocks: unknown[], state: WalkState) {
  for (const raw of blocks) {
    if (!isRecord(raw)) continue;
    walkInline(raw.content, state);
    if (raw.type === NOTEPAD_LINK_BLOCK) {
      const id = readLinkId(raw.props, 'notepadId');
      if (id) addLink(state, 'notepad', id);
    } else if (raw.type === CARD_LINK_BLOCK) {
      const id = readLinkId(raw.props, 'cardId');
      if (id) addLink(state, 'card', id);
    } else if (raw.type === BOARD_LINK_BLOCK) {
      const id = readLinkId(raw.props, 'boardId');
      if (id) addLink(state, 'board', id);
    }
    if (Array.isArray(raw.children)) walkBlocks(raw.children, state);
    state.text.push('\n');
  }
}

/** Extract plain text, mentions and reference links from BlockNote JSON. */
export function extractFromContent(content: string): ExtractResult {
  const state: WalkState = { text: [], mentions: new Map(), links: new Map() };
  walkBlocks(parseDoc(content), state);
  return {
    text: state.text.join('').replace(/\n+$/, ''),
    mentions: [...state.mentions.values()],
    links: [...state.links.values()],
  };
}

/** Plain text of the document, used to (re)build the FTS index row. */
export function extractPlainText(content: string): string {
  return extractFromContent(content).text;
}
