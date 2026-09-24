import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createWorkerApp } from '../../src/worker/index'
import { expectInvariantsHold } from './helpers'

const app = createWorkerApp(env)

describe('Phase 6: Organization, Search & Trash', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token'
  let ownerCookie = ''
  let projectId = ''
  let notepad1Id = ''
  let notepad2Id = ''
  let boardId = ''
  let tagId = ''

  it('sets up workspace with notepads, content, and tags', async () => {
    // 1. Sign up owner
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'search-owner@example.com',
          password: 'password123',
          name: 'Search Owner',
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
    const me = (await meRes.json()) as { lastProjectId: string }
    projectId = me.lastProjectId

    // 2. Create Tag: "research"
    const tagRes = await app.request(
      `http://localhost/api/projects/${projectId}/tags`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ name: 'research', color: '#10b981' }),
      },
      env,
    )
    expect(tagRes.status).toBe(201)
    const tagData = (await tagRes.json()) as { id: string; name: string }
    tagId = tagData.id
    expect(tagData.name).toBe('research')

    // 3. Create Notepad 1: "Quantum Computing Overview" with search terms in body
    const np1Res = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ title: 'Quantum Computing Overview' }),
      },
      env,
    )
    expect(np1Res.status).toBe(201)
    const np1 = (await np1Res.json()) as { id: string }
    notepad1Id = np1.id

    // Save content for Notepad 1
    const np1Content = JSON.stringify([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Quantum superposition enables parallel calculations for cryptography.' }],
      },
    ])
    await app.request(
      `http://localhost/api/notepads/${notepad1Id}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          content: np1Content,
          baseVersion: 1,
        }),
      },
      env,
    )

    // Tag Notepad 1 with "research"
    const tagAttachRes = await app.request(
      `http://localhost/api/notepads/${notepad1Id}/tags`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ tagIds: [tagId] }),
      },
      env,
    )
    expect(tagAttachRes.status).toBe(200)

    // 4. Create Notepad 2: "Machine Learning Notes"
    const np2Res = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ title: 'Machine Learning Notes' }),
      },
      env,
    )
    expect(np2Res.status).toBe(201)
    const np2 = (await np2Res.json()) as { id: string }
    notepad2Id = np2.id

    // 5. Create Board
    const boardRes = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ name: 'Sprint Board' }),
      },
      env,
    )
    expect(boardRes.status).toBe(201)
    const b = (await boardRes.json()) as { id: string }
    boardId = b.id
  })

  it('searches by title and body matches via FTS5 with snippet', async () => {
    // Search for "quantum"
    const searchRes = await app.request(
      `http://localhost/api/search?q=quantum&projectId=${projectId}&scope=project`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    expect(searchRes.status).toBe(200)
    const results = (await searchRes.json()) as Array<{
      id: string
      title: string
      snippet: string
    }>

    expect(results.length).toBeGreaterThanOrEqual(1)
    const match = results.find((r) => r.id === notepad1Id)
    expect(match).toBeDefined()
    expect(match?.title).toBe('Quantum Computing Overview')

    // Search for body term "superposition"
    const bodySearchRes = await app.request(
      `http://localhost/api/search?q=superposition&projectId=${projectId}`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    expect(bodySearchRes.status).toBe(200)
    const bodyResults = (await bodySearchRes.json()) as Array<{
      id: string
      snippet: string
    }>
    const bodyMatch = bodyResults.find((r) => r.id === notepad1Id)
    expect(bodyMatch).toBeDefined()
  })

  it('excludes soft-deleted items from search and lists them in Trash', async () => {
    // 1. Soft delete Notepad 1
    const delRes = await app.request(
      `http://localhost/api/notepads/${notepad1Id}`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(delRes.status).toBe(200)

    // 2. Search for "quantum" -> should return 0 results now
    const searchRes = await app.request(
      `http://localhost/api/search?q=quantum&projectId=${projectId}`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    expect(searchRes.status).toBe(200)
    const results = (await searchRes.json()) as Array<{ id: string }>
    expect(results.find((r) => r.id === notepad1Id)).toBeUndefined()

    // 3. GET /api/projects/:pid/trash -> lists notepad1
    const trashRes = await app.request(
      `http://localhost/api/projects/${projectId}/trash`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    expect(trashRes.status).toBe(200)
    const trashData = (await trashRes.json()) as {
      notepads: Array<{ id: string; title: string }>
      boards: Array<{ id: string }>
    }
    expect(trashData.notepads.some((n) => n.id === notepad1Id)).toBe(true)

    // Invariants check
    await expectInvariantsHold(env.DB)
  })

  it('restores notepad from Trash and verifies it is searchable again', async () => {
    // 1. Restore Notepad 1
    const restoreRes = await app.request(
      `http://localhost/api/notepads/${notepad1Id}/restore`,
      {
        method: 'POST',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(restoreRes.status).toBe(200)

    // 2. Search again for "quantum" -> should be found again!
    const searchRes = await app.request(
      `http://localhost/api/search?q=quantum&projectId=${projectId}`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    expect(searchRes.status).toBe(200)
    const results = (await searchRes.json()) as Array<{ id: string }>
    expect(results.some((r) => r.id === notepad1Id)).toBe(true)

    // 3. GET /api/projects/:pid/recent -> includes notepad1 & notepad2
    const recentRes = await app.request(
      `http://localhost/api/projects/${projectId}/recent`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    expect(recentRes.status).toBe(200)
    const recent = (await recentRes.json()) as Array<{ id: string }>
    expect(recent.some((n) => n.id === notepad1Id)).toBe(true)
    expect(recent.some((n) => n.id === notepad2Id)).toBe(true)

    // Invariants check
    await expectInvariantsHold(env.DB)
  })

  it('tests board trash lifecycle: soft delete, list in trash, restore', async () => {
    // 1. Soft delete board
    const delBoardRes = await app.request(
      `http://localhost/api/boards/${boardId}`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(delBoardRes.status).toBe(200)

    // 2. Check trash
    const trashRes = await app.request(
      `http://localhost/api/projects/${projectId}/trash`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    const trash = (await trashRes.json()) as { boards: Array<{ id: string }> }
    expect(trash.boards.some((b) => b.id === boardId)).toBe(true)

    // 3. Restore board
    const restoreBoardRes = await app.request(
      `http://localhost/api/boards/${boardId}/restore`,
      {
        method: 'POST',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(restoreBoardRes.status).toBe(200)

    // Invariants check
    await expectInvariantsHold(env.DB)
  })

  it('tests permanent delete of a notepad from trash', async () => {
    // 1. Soft delete notepad2
    await app.request(
      `http://localhost/api/notepads/${notepad2Id}`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    )

    // 2. Permanently delete notepad2
    const permRes = await app.request(
      `http://localhost/api/notepads/${notepad2Id}/permanent`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(permRes.status).toBe(200)

    // 3. Verify it is gone from trash
    const trashRes = await app.request(
      `http://localhost/api/projects/${projectId}/trash`,
      { headers: { Cookie: ownerCookie } },
      env,
    )
    const trash = (await trashRes.json()) as { notepads: Array<{ id: string }> }
    expect(trash.notepads.some((n) => n.id === notepad2Id)).toBe(false)

    // Invariants check
    await expectInvariantsHold(env.DB)
  })
})
