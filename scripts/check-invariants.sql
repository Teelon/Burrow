-- One query per invariant (PLAN.md section 6.1). Each query returns OFFENDING rows.
-- Run via `pnpm check:data` (local) or `pnpm check:data --remote`.
-- Keep comments on their own lines: the runner splits statements on ';'.

-- I1: every cards.notepad_id points to a notepad with kind='card', and every
--      kind='card' notepad has exactly one card.
SELECT 'I1' AS invariant, c.id AS subject, 'card without kind=card notepad' AS detail
FROM cards c LEFT JOIN notepads n ON n.id = c.notepad_id
WHERE n.id IS NULL OR n.kind <> 'card'
UNION ALL
SELECT 'I1', n.id, 'card notepad without card row'
FROM notepads n LEFT JOIN cards c ON c.notepad_id = n.id
WHERE n.kind = 'card' AND c.id IS NULL;

-- I2: card notepads are never part of the notepad tree.
SELECT 'I2' AS invariant, id AS subject, 'card notepad has parent_id' AS detail
FROM notepads
WHERE kind = 'card' AND parent_id IS NOT NULL;

-- I3: card board, column board and notepad project all agree.
SELECT 'I3' AS invariant, c.id AS subject, 'board/column/project mismatch' AS detail
FROM cards c
JOIN board_columns col ON col.id = c.column_id
JOIN boards b ON b.id = c.board_id
JOIN notepads n ON n.id = c.notepad_id
WHERE col.board_id <> c.board_id OR b.project_id <> n.project_id;

-- I4: notepad/parent share a project; workspace_id matches the project's workspace.
SELECT 'I4' AS invariant, n.id AS subject, 'notepad workspace != project workspace' AS detail
FROM notepads n JOIN projects p ON p.id = n.project_id
WHERE n.workspace_id <> p.workspace_id
UNION ALL
SELECT 'I4', n.id, 'notepad project != parent project'
FROM notepads n JOIN notepads pa ON pa.id = n.parent_id
WHERE n.project_id <> pa.project_id
UNION ALL
SELECT 'I4', b.id, 'board workspace != project workspace'
FROM boards b JOIN projects p ON p.id = b.project_id
WHERE b.workspace_id <> p.workspace_id;

-- I5: a card and its notepad always share soft-delete state. The state lives in
--      exactly one column (notepads.deleted_at), so divergence is only possible
--      if the card/notepad pair itself is broken.
SELECT 'I5' AS invariant, c.id AS subject, 'card/notepad pair broken' AS detail
FROM cards c LEFT JOIN notepads n ON n.id = c.notepad_id
WHERE n.id IS NULL OR n.kind <> 'card';

-- I6: a non-deleted notepad has no deleted ancestors.
SELECT 'I6' AS invariant, n.id AS subject, 'deleted ancestor' AS detail
FROM notepads n JOIN notepads pa ON pa.id = n.parent_id
WHERE n.deleted_at IS NULL AND pa.deleted_at IS NOT NULL;

-- I7: exactly one FTS row per non-deleted notepad; no FTS rows for deleted/missing ones.
SELECT 'I7' AS invariant, n.id AS subject, 'missing fts row' AS detail
FROM notepads n LEFT JOIN notepads_fts f ON f.notepad_id = n.id
WHERE n.deleted_at IS NULL AND f.notepad_id IS NULL
UNION ALL
SELECT 'I7', f.notepad_id, 'fts row for deleted or missing notepad'
FROM notepads_fts f LEFT JOIN notepads n ON n.id = f.notepad_id
WHERE n.id IS NULL OR n.deleted_at IS NOT NULL;

-- I8: notepad_links.source_id always references an existing notepad.
SELECT 'I8' AS invariant, l.source_id AS subject,
       l.target_type || ':' || l.target_id AS detail
FROM notepad_links l LEFT JOIN notepads n ON n.id = l.source_id
WHERE n.id IS NULL;

-- I9: tag and notepad share a project (including tags on card notepads).
SELECT 'I9' AS invariant, nt.notepad_id AS subject,
       t.project_id || ' != ' || n.project_id AS detail
FROM notepad_tags nt
JOIN tags t ON t.id = nt.tag_id
JOIN notepads n ON n.id = nt.notepad_id
WHERE t.project_id <> n.project_id;

-- I10: every assignee is a current member of the card's workspace.
SELECT 'I10' AS invariant, ca.card_id AS subject, ca.user_id AS detail
FROM card_assignees ca
JOIN cards c ON c.id = ca.card_id
JOIN boards b ON b.id = c.board_id
LEFT JOIN members m ON m.user_id = ca.user_id AND m.workspace_id = b.workspace_id
WHERE m.user_id IS NULL;
