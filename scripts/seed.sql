-- Burrow Seed Data for Local Testing & Demo

-- Cleanup prior demo run if exists
DELETE FROM workspaces WHERE id = 'ws_demo_acme';
DELETE FROM user WHERE id IN ('usr_alice', 'usr_bob');

-- 1. Users
INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
VALUES
  ('usr_alice', 'Alice Smith', 'alice@example.com', 1, 1700000000000, 1700000000000),
  ('usr_bob', 'Bob Jones', 'bob@example.com', 1, 1700000000000, 1700000000000);

-- 2. Workspace
INSERT INTO workspaces (id, name, created_by, created_at)
VALUES ('ws_demo_acme', 'Acme Workspace', 'usr_alice', 1700000000000);

-- 3. Members
INSERT INTO members (workspace_id, user_id, role, joined_at)
VALUES
  ('ws_demo_acme', 'usr_alice', 'owner', 1700000000000),
  ('ws_demo_acme', 'usr_bob', 'editor', 1700000000000);

-- 4. Projects
INSERT INTO projects (id, workspace_id, name, icon, color, position, created_at, updated_at)
VALUES
  ('proj_prod', 'ws_demo_acme', 'Product & Engineering', '🚀', '#8b5cf6', 'a0', 1700000000000, 1700000000000),
  ('proj_design', 'ws_demo_acme', 'Design & Research', '🎨', '#ec4899', 'a1', 1700000000000, 1700000000000);

-- 5. Tags
INSERT INTO tags (id, project_id, name, color)
VALUES
  ('tag_roadmap', 'proj_prod', 'roadmap', '#8b5cf6'),
  ('tag_arch', 'proj_prod', 'architecture', '#3b82f6'),
  ('tag_design', 'proj_design', 'ui', '#ec4899');

-- 6. Root & Nested Notepads
INSERT INTO notepads (id, workspace_id, project_id, parent_id, kind, title, icon, content, version, position, is_favorite, created_by, created_at, updated_at)
VALUES
  ('np_roadmap', 'ws_demo_acme', 'proj_prod', NULL, 'notepad', 'Q4 Product Roadmap', '🗺️', '[{"type":"paragraph","content":[{"type":"text","text":"High-level deliverables for the final quarter."}]}]', 1, 'a0', 1, 'usr_alice', 1700000000000, 1700000000000),
  ('np_arch', 'ws_demo_acme', 'proj_prod', 'np_roadmap', 'notepad', 'Edge Architecture Review', '⚡', '[{"type":"paragraph","content":[{"type":"text","text":"Moving state to the edge with Cloudflare Workers and D1 database."}]}]', 1, 'a0', 0, 'usr_alice', 1700000000000, 1700000000000),
  ('np_design', 'ws_demo_acme', 'proj_design', NULL, 'notepad', 'Design System Guidelines', '✨', '[{"type":"paragraph","content":[{"type":"text","text":"Typography, spacing, colors, and accessibility tokens."}]}]', 1, 'a0', 1, 'usr_bob', 1700000000000, 1700000000000);

-- 7. FTS for Notepads
INSERT INTO notepads_fts (notepad_id, project_id, title, body)
VALUES
  ('np_roadmap', 'proj_prod', 'Q4 Product Roadmap', 'High-level deliverables for the final quarter.'),
  ('np_arch', 'proj_prod', 'Edge Architecture Review', 'Moving state to the edge with Cloudflare Workers and D1 database.'),
  ('np_design', 'proj_design', 'Design System Guidelines', 'Typography, spacing, colors, and accessibility tokens.');

-- 8. Notepad Tags
INSERT INTO notepad_tags (notepad_id, tag_id)
VALUES
  ('np_roadmap', 'tag_roadmap'),
  ('np_arch', 'tag_arch'),
  ('np_design', 'tag_design');

-- 9. Kanban Board & Columns
INSERT INTO boards (id, workspace_id, project_id, name, icon, position, created_at, updated_at)
VALUES ('board_sprint', 'ws_demo_acme', 'proj_prod', 'Sprint 42 Board', '📋', 'a0', 1700000000000, 1700000000000);

INSERT INTO board_columns (id, board_id, name, position)
VALUES
  ('col_todo', 'board_sprint', 'To do', 'a0'),
  ('col_inprog', 'board_sprint', 'In progress', 'a1'),
  ('col_done', 'board_sprint', 'Done', 'a2');

-- 10. Cards & Card Notepads
INSERT INTO notepads (id, workspace_id, project_id, parent_id, kind, title, icon, content, version, position, is_favorite, created_by, created_at, updated_at)
VALUES
  ('np_card_1', 'ws_demo_acme', 'proj_prod', NULL, 'card', 'Build Search Command Palette', '🔍', '[{"type":"paragraph","content":[{"type":"text","text":"Implement cmdk command palette with full-text search."}]}]', 1, 'a0', 0, 'usr_alice', 1700000000000, 1700000000000),
  ('np_card_2', 'ws_demo_acme', 'proj_prod', NULL, 'card', 'Verify D1 Invariants', '🛡️', '[{"type":"paragraph","content":[{"type":"text","text":"Ensure all 10 invariants hold under concurrent load."}]}]', 1, 'a0', 0, 'usr_bob', 1700000000000, 1700000000000);

INSERT INTO notepads_fts (notepad_id, project_id, title, body)
VALUES
  ('np_card_1', 'proj_prod', 'Build Search Command Palette', 'Implement cmdk command palette with full-text search.'),
  ('np_card_2', 'proj_prod', 'Verify D1 Invariants', 'Ensure all 10 invariants hold under concurrent load.');

INSERT INTO cards (id, board_id, column_id, notepad_id, position, priority, due_date, created_at)
VALUES
  ('card_1', 'board_sprint', 'col_inprog', 'np_card_1', 'a0', 'high', 1701000000000, 1700000000000),
  ('card_2', 'board_sprint', 'col_done', 'np_card_2', 'a0', 'medium', 1700500000000, 1700000000000);

INSERT INTO card_assignees (card_id, user_id)
VALUES
  ('card_1', 'usr_alice'),
  ('card_2', 'usr_bob');

-- 11. Links (card 1 links to np_arch)
INSERT INTO notepad_links (source_id, target_type, target_id)
VALUES ('np_card_1', 'notepad', 'np_arch');
