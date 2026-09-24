import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { app } from '../../src/worker/index'
import { createDb } from '../../src/worker/db/client'
import * as t from '../../src/worker/db/schema'
import { expectInvariantsHold } from './helpers'

const db = createDb(env.DB)

describe('Phase 4: Kanban Boards & Cards Lifecycle', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token'
  let ownerCookie = ''
  let editorCookie = ''
  let viewerCookie = ''
  let ownerUserId = ''
  let editorUserId = ''
  let viewerUserId = ''
  let workspaceId = ''
  let projectId = ''

  let boardId = ''
  let todoColId = ''
  let inProgressColId = ''
  let doneColId = ''

  let cardId1 = ''
  let cardId2 = ''
  let tagId = ''

  it('sets up workspace with owner, editor, and viewer', async () => {
    // 1. Owner sign-up
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'board-owner@example.com',
          password: 'password123',
          name: 'Board Owner',
          bootstrapToken,
        }),
      },
      env,
    )
    expect(ownerRes.status).toBe(200)
    ownerCookie = ownerRes.headers.get('set-cookie')!

    const meRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: ownerCookie } },
      env,
    )
    const meData = (await meRes.json()) as {
      user: { id: string }
      workspace: { id: string }
      lastProjectId: string
    }
    ownerUserId = meData.user.id
    workspaceId = meData.workspace.id
    projectId = meData.lastProjectId
    expect(workspaceId).toBeDefined()

    // 2. Invite editor
    const editorInviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ email: 'board-editor@example.com', role: 'editor' }),
      },
      env,
    )
    const editorInvite = (await editorInviteRes.json()) as { token: string }

    const editorSignupRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'board-editor@example.com',
          password: 'password123',
          name: 'Board Editor',
          inviteToken: editorInvite.token,
        }),
      },
      env,
    )
    editorCookie = editorSignupRes.headers.get('set-cookie')!

    const editorMeRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: editorCookie } },
      env,
    )
    const editorMe = (await editorMeRes.json()) as { user: { id: string } }
    editorUserId = editorMe.user.id

    // 3. Invite viewer
    const viewerInviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ email: 'board-viewer@example.com', role: 'viewer' }),
      },
      env,
    )
    const viewerInvite = (await viewerInviteRes.json()) as { token: string }

    const viewerSignupRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'board-viewer@example.com',
          password: 'password123',
          name: 'Board Viewer',
          inviteToken: viewerInvite.token,
        }),
      },
      env,
    )
    viewerCookie = viewerSignupRes.headers.get('set-cookie')!

    const viewerMeRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: viewerCookie } },
      env,
    )
    const viewerMe = (await viewerMeRes.json()) as { user: { id: string } }
    viewerUserId = viewerMe.user.id
    expect(viewerUserId).toBeDefined()

    // Create a tag for this project
    const tagRes = await db
      .insert(t.tags)
      .values({
        id: 'tag-1',
        projectId,
        name: 'Urgent Bug',
        color: '#ef4444',
      })
      .returning()
    tagId = tagRes[0]!.id

    await expectInvariantsHold(env.DB)
  })

  it('creates board with default columns and denies viewer writes', async () => {
    // Viewer should be 403
    const viewerCreate = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
        body: JSON.stringify({ name: 'Viewer Board' }),
      },
      env,
    )
    expect(viewerCreate.status).toBe(403)

    // Editor creates board
    const createRes = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({ name: 'Sprint 1', icon: '🚀' }),
      },
      env,
    )
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as { id: string; position: string }
    boardId = created.id
    expect(boardId).toBeDefined()

    // Get board with columns
    const getRes = await app.request(
      `http://localhost/api/boards/${boardId}`,
      { headers: { Cookie: viewerCookie } }, // Viewers can read!
      env,
    )
    expect(getRes.status).toBe(200)
    const board = (await getRes.json()) as {
      id: string
      name: string
      columns: Array<{ id: string; name: string; position: string }>
    }
    expect(board.name).toBe('Sprint 1')
    expect(board.columns.length).toBe(3)
    expect(board.columns.map((c) => c.name)).toEqual(['To do', 'In progress', 'Done'])

    todoColId = board.columns[0]!.id
    inProgressColId = board.columns[1]!.id
    doneColId = board.columns[2]!.id

    await expectInvariantsHold(env.DB)
  })

  it('creates cards with quick-add payload atomically', async () => {
    // Card 1: with priority, due date, assignee, tag
    const createCard1 = await app.request(
      `http://localhost/api/columns/${todoColId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({
          title: 'Implement Auth',
          priority: 'high',
          dueDate: Date.now() + 86400000,
          assigneeIds: [editorUserId],
          tagIds: [tagId],
        }),
      },
      env,
    )
    expect(createCard1.status).toBe(201)
    const c1Data = (await createCard1.json()) as { cardId: string; notepadId: string }
    cardId1 = c1Data.cardId
    expect(cardId1).toBeDefined()

    // Card 2: with linked notepad creation mode='new'
    const createCard2 = await app.request(
      `http://localhost/api/columns/${todoColId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({
          title: 'Design Spec',
          priority: 'medium',
          notepad: { mode: 'new' },
        }),
      },
      env,
    )
    expect(createCard2.status).toBe(201)
    const c2Data = (await createCard2.json()) as {
      cardId: string
      notepadId: string
      linkedNotepadId: string | null
    }
    cardId2 = c2Data.cardId
    expect(cardId2).toBeDefined()
    expect(c2Data.linkedNotepadId).toBeDefined()

    // Check invariants I1, I2, I3, I9, I10
    await expectInvariantsHold(env.DB)

    // Verify card detail
    const cardDetailRes = await app.request(
      `http://localhost/api/cards/${cardId1}`,
      { headers: { Cookie: editorCookie } },
      env,
    )
    expect(cardDetailRes.status).toBe(200)
    const cardDetail = (await cardDetailRes.json()) as {
      id: string
      title: string
      priority: string
      assignees: Array<{ userId: string }>
      tags: Array<{ id: string }>
    }
    expect(cardDetail.title).toBe('Implement Auth')
    expect(cardDetail.priority).toBe('high')
    expect(cardDetail.assignees[0]?.userId).toBe(editorUserId)
    expect(cardDetail.tags[0]?.id).toBe(tagId)
  })

  it('moves cards between columns and preserves ordering', async () => {
    // Move card 1 to inProgress
    const moveRes = await app.request(
      `http://localhost/api/cards/${cardId1}/move`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({ columnId: inProgressColId }),
      },
      env,
    )
    expect(moveRes.status).toBe(200)

    // Move card 2 to inProgress after card 1
    const move2Res = await app.request(
      `http://localhost/api/cards/${cardId2}/move`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({ columnId: inProgressColId, afterId: cardId1 }),
      },
      env,
    )
    expect(move2Res.status).toBe(200)

    // Verify inProgress column has both cards in order
    const boardRes = await app.request(
      `http://localhost/api/boards/${boardId}`,
      { headers: { Cookie: editorCookie } },
      env,
    )
    const board = (await boardRes.json()) as {
      columns: Array<{ id: string; cards: Array<{ id: string }> }>
    }
    const inProg = board.columns.find((c) => c.id === inProgressColId)!
    expect(inProg.cards.map((c) => c.id)).toEqual([cardId1, cardId2])

    await expectInvariantsHold(env.DB)
  })

  it('requires destination column when deleting a non-empty column', async () => {
    // Attempt delete inProgress column without moveTo -> should fail 400
    const failDelete = await app.request(
      `http://localhost/api/columns/${inProgressColId}`,
      {
        method: 'DELETE',
        headers: { Cookie: editorCookie },
      },
      env,
    )
    expect(failDelete.status).toBe(400)

    // Delete inProgress column specifying moveTo=doneColId
    const successDelete = await app.request(
      `http://localhost/api/columns/${inProgressColId}?moveTo=${doneColId}`,
      {
        method: 'DELETE',
        headers: { Cookie: editorCookie },
      },
      env,
    )
    expect(successDelete.status).toBe(200)

    // Verify cards are now in doneColId
    const boardRes = await app.request(
      `http://localhost/api/boards/${boardId}`,
      { headers: { Cookie: editorCookie } },
      env,
    )
    const board = (await boardRes.json()) as {
      columns: Array<{ id: string; cards: Array<{ id: string }> }>
    }
    const doneCol = board.columns.find((c) => c.id === doneColId)!
    expect(doneCol.cards.length).toBe(2)

    await expectInvariantsHold(env.DB)
  })

  it('updates card properties and rejects invalid assignees or tags', async () => {
    // Reject non-member assignee
    const badAssigneeRes = await app.request(
      `http://localhost/api/cards/${cardId1}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({ assigneeIds: ['non-existent-user'] }),
      },
      env,
    )
    expect(badAssigneeRes.status).toBe(400)

    // Reject tag from other project
    const badTagRes = await app.request(
      `http://localhost/api/cards/${cardId1}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({ tagIds: ['foreign-tag-id'] }),
      },
      env,
    )
    expect(badTagRes.status).toBe(400)

    // Valid update
    const validUpdate = await app.request(
      `http://localhost/api/cards/${cardId1}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({
          title: 'Renamed Auth Card',
          priority: 'urgent',
          assigneeIds: [ownerUserId, editorUserId],
        }),
      },
      env,
    )
    expect(validUpdate.status).toBe(200)

    const updated = await app.request(
      `http://localhost/api/cards/${cardId1}`,
      { headers: { Cookie: editorCookie } },
      env,
    )
    const cardData = (await updated.json()) as {
      title: string
      priority: string
      assignees: Array<{ userId: string }>
    }
    expect(cardData.title).toBe('Renamed Auth Card')
    expect(cardData.priority).toBe('urgent')
    expect(cardData.assignees.length).toBe(2)

    await expectInvariantsHold(env.DB)
  })

  it('provides batched summaries for cardLink blocks', async () => {
    const summaryRes = await app.request(
      `http://localhost/api/cards/summary?ids=${cardId1},${cardId2}`,
      { headers: { Cookie: editorCookie } },
      env,
    )
    expect(summaryRes.status).toBe(200)
    const summaries = (await summaryRes.json()) as Array<{
      id: string
      title: string
      priority: string
      columnName: string
    }>
    expect(summaries.length).toBe(2)
    const c1 = summaries.find((s) => s.id === cardId1)!
    expect(c1.title).toBe('Renamed Auth Card')
    expect(c1.columnName).toBe('Done')
  })

  it('handles card lifecycle: soft-delete, restore, and permanent delete', async () => {
    // 1. Soft-delete card 2
    const delRes = await app.request(
      `http://localhost/api/cards/${cardId2}`,
      { method: 'DELETE', headers: { Cookie: editorCookie } },
      env,
    )
    expect(delRes.status).toBe(200)

    // Invariants (I5, I7) hold: soft-deleted card has no FTS row
    await expectInvariantsHold(env.DB)

    // 2. Restore card 2
    const restRes = await app.request(
      `http://localhost/api/cards/${cardId2}/restore`,
      { method: 'POST', headers: { Cookie: editorCookie } },
      env,
    )
    expect(restRes.status).toBe(200)

    // Invariant I7 holds: restored card has FTS row restored
    await expectInvariantsHold(env.DB)
  })

  it('handles board lifecycle: soft-delete with cards, restore, and permanent delete', async () => {
    // 1. Soft delete board
    const delBoard = await app.request(
      `http://localhost/api/boards/${boardId}`,
      { method: 'DELETE', headers: { Cookie: editorCookie } },
      env,
    )
    expect(delBoard.status).toBe(200)

    // Verify all notepads for cards on board are soft-deleted, FTS rows removed
    await expectInvariantsHold(env.DB)

    // 2. Restore board
    const restBoard = await app.request(
      `http://localhost/api/boards/${boardId}/restore`,
      { method: 'POST', headers: { Cookie: editorCookie } },
      env,
    )
    expect(restBoard.status).toBe(200)

    // Verify cards and FTS rows restored
    await expectInvariantsHold(env.DB)

    // 3. Delete again and permanently delete board
    await app.request(
      `http://localhost/api/boards/${boardId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    )
    const permDel = await app.request(
      `http://localhost/api/boards/${boardId}/permanent`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    )
    expect(permDel.status).toBe(200)

    // Verify board, cards, card notepads, and FTS rows are cleanly gone
    await expectInvariantsHold(env.DB)
  })

  it('removes member card assignments when member is removed (I10)', async () => {
    // Create new board and card assigned to editor
    const bRes = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ name: 'Member Test Board' }),
      },
      env,
    )
    const b = (await bRes.json()) as { id: string }

    const colRes = await app.request(
      `http://localhost/api/boards/${b.id}`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    const bDetail = (await colRes.json()) as { columns: Array<{ id: string }> }
    const colId = bDetail.columns[0]!.id

    const cRes = await app.request(
      `http://localhost/api/columns/${colId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          title: 'Editor Task',
          assigneeIds: [editorUserId],
        }),
      },
      env,
    )
    expect(cRes.status).toBe(201)
    await expectInvariantsHold(env.DB)

    // Remove editor from workspace
    const removeRes = await app.request(
      `http://localhost/api/members/${editorUserId}`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(removeRes.status).toBe(200)

    // I10 must hold: card_assignees row for editor was cascaded
    await expectInvariantsHold(env.DB)
  })
})
