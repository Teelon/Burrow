/**
 * Document starter templates (Epic 3.1).
 *
 * Plain structural block definitions compatible with BlockNote's `PartialBlock`
 * shape (heading / paragraph / list items), intentionally dependency-free so
 * both web and worker can import this module.
 */

export interface TemplateBlock {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: TemplateBlock[];
}

export interface StarterTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  blocks: TemplateBlock[];
}

const h = (level: 1 | 2 | 3, text: string): TemplateBlock => ({
  type: 'heading',
  props: { level },
  content: text,
});

const p = (text: string): TemplateBlock => ({ type: 'paragraph', content: text });

const bullet = (text: string, children?: TemplateBlock[]): TemplateBlock => ({
  type: 'bulletListItem',
  content: text,
  ...(children ? { children } : {}),
});

const numbered = (text: string): TemplateBlock => ({
  type: 'numberedListItem',
  content: text,
});

const todo = (text: string): TemplateBlock => ({ type: 'checkListItem', content: text });

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'product-spec',
    name: 'Product Spec (RFC)',
    icon: '📝',
    description: 'Problem statement, goals, non-goals, proposed design, open questions.',
    blocks: [
      h(1, 'Product Spec: Title'),
      h(2, 'Problem statement'),
      p('What problem are we solving, for whom, and why now?'),
      h(2, 'Goals'),
      bullet('Goal 1 — measurable outcome'),
      bullet('Goal 2 — measurable outcome'),
      h(2, 'Non-goals'),
      bullet('Explicitly out of scope for this iteration'),
      h(2, 'Proposed design'),
      p('Describe the proposed approach, key trade-offs, and alternatives considered.'),
      h(2, 'Open questions'),
      bullet('Question that needs an answer before kickoff'),
    ],
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    icon: '🤝',
    description: 'Attendees, agenda, discussion points, action items.',
    blocks: [
      h(1, 'Meeting Notes'),
      h(2, 'Attendees'),
      p('Use @ to mention attendees'),
      h(2, 'Agenda'),
      bullet('Topic 1'),
      bullet('Topic 2'),
      h(2, 'Discussion'),
      p('Key points, decisions, and context…'),
      h(2, 'Action items'),
      todo('Action item — owner, due date'),
    ],
  },
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    icon: '🏃',
    description: 'Sprint goal, capacity, committed backlog items.',
    blocks: [
      h(1, 'Sprint Planning'),
      h(2, 'Sprint goal'),
      p('One sentence describing what this sprint should achieve.'),
      h(2, 'Capacity'),
      bullet('Teammate A — 5 available days'),
      bullet('Teammate B — 3 available days (leave Thu–Fri)'),
      h(2, 'Committed backlog'),
      todo('Item 1'),
      todo('Item 2'),
      h(2, 'Risks & dependencies'),
      bullet('Risk or cross-team dependency'),
    ],
  },
  {
    id: 'bug-report',
    name: 'Bug Report',
    icon: '🐛',
    description: 'Steps to reproduce, expected vs actual behavior, logs.',
    blocks: [
      h(1, 'Bug: Title'),
      h(2, 'Summary'),
      p('What went wrong, where, and how often.'),
      h(2, 'Steps to reproduce'),
      numbered('1. Go to…'),
      numbered('2. Click…'),
      numbered('3. Observe…'),
      h(2, 'Expected behavior'),
      p('What should have happened.'),
      h(2, 'Actual behavior'),
      p('What happened instead.'),
      h(2, 'Logs / screenshots'),
      p('Paste logs or attach screenshots here.'),
    ],
  },
  {
    id: 'one-on-one',
    name: '1-on-1 Catchup',
    icon: '🎯',
    description: 'Wins, challenges, feedback, career goals.',
    blocks: [
      h(1, '1-on-1 Catchup'),
      h(2, 'Wins'),
      bullet('Something that went well since last time'),
      h(2, 'Challenges'),
      bullet('Blocker or struggle to discuss'),
      h(2, 'Feedback'),
      p('Two-way feedback — give it and ask for it.'),
      h(2, 'Career goals'),
      bullet('Growth area or skill to develop'),
      h(2, 'Action items'),
      todo('Follow-up item'),
    ],
  },
];

export function getTemplateById(id: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id);
}
