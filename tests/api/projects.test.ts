import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { createWorkerApp } from '../../src/worker/index'
import { createDb } from '../../src/worker/db/client'

const app = createWorkerApp(env)
import * as t from '../../src/worker/db/schema'
import { eq } from 'drizzle-orm'
import { expectInvariantsHold } from './helpers'

const db = createDb(env.DB)

describe('Phase 2: Projects Service and API', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token'
  let ownerCookie = ''
  let viewerCookie = ''

  it('sets up workspace with owner and viewer', async () => {
    // Register owner
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'proj-owner@example.com',
          password: 'password123',
          name: 'Project Owner',
          bootstrapToken,
        }),
      },
      env,
    )
    expect(ownerRes.status).toBe(200)
    ownerCookie = ownerRes.headers.get('set-cookie')!

    // Create viewer invite
    const inviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          email: 'proj-viewer@example.com',
          role: 'viewer',
        }),
      },
      env,
    )
    const { token } = (await inviteRes.json()) as { token: string }

    // Register viewer
    const viewerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'proj-viewer@example.com',
          password: 'password123',
          name: 'Project Viewer',
          inviteToken: token,
        }),
      },
      env,
    )
    expect(viewerRes.status).toBe(200)
    viewerCookie = viewerRes.headers.get('set-cookie')!
  })

  let project1Id = ''
  let project2Id = ''

  it('lists existing projects and allows owner to create new projects', async () => {
    const listRes = await app.request(
      'http://localhost/api/projects',
      {
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(listRes.status).toBe(200)
    const projects = (await listRes.json()) as Array<{ id: string; name: string }>
    expect(projects.length).toBe(1)
    project1Id = projects[0]!.id

    const createRes = await app.request(
      'http://localhost/api/projects',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          name: 'Second Project',
          icon: '🚀',
          color: '#ff5500',
        }),
      },
      env,
    )
    expect(createRes.status).toBe(201)
    const newProj = (await createRes.json()) as { id: string; position: string }
    project2Id = newProj.id

    // Verify list contains both projects in order
    const listRes2 = await app.request(
      'http://localhost/api/projects',
      {
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    const projects2 = (await listRes2.json()) as Array<{ id: string; name: string }>
    expect(projects2.length).toBe(2)
    expect(projects2[1]!.name).toBe('Second Project')

    await expectInvariantsHold(env.DB)
  })

  it('updates and reorders projects', async () => {
    // Rename project
    const updateRes = await app.request(
      `http://localhost/api/projects/${project2Id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          name: 'Renamed Project',
          color: '#0055ff',
        }),
      },
      env,
    )
    expect(updateRes.status).toBe(200)

    // Move project 2 before project 1 (afterId = null)
    const moveRes = await app.request(
      `http://localhost/api/projects/${project2Id}/move`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ afterId: null }),
      },
      env,
    )
    expect(moveRes.status).toBe(200)

    // Verify project 2 is now first
    const listRes = await app.request(
      'http://localhost/api/projects',
      {
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    const projects = (await listRes.json()) as Array<{ id: string; name: string }>
    expect(projects[0]!.id).toBe(project2Id)
    expect(projects[0]!.name).toBe('Renamed Project')
  })

  it('archives and unarchives a project', async () => {
    // Archive
    const archRes = await app.request(
      `http://localhost/api/projects/${project2Id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ archived: true }),
      },
      env,
    )
    expect(archRes.status).toBe(200)

    // List should now only show project 1
    const listRes = await app.request(
      'http://localhost/api/projects',
      {
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    const projects = (await listRes.json()) as Array<{ id: string }>
    expect(projects.length).toBe(1)
    expect(projects[0]!.id).toBe(project1Id)

    // Unarchive
    await app.request(
      `http://localhost/api/projects/${project2Id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ archived: false }),
      },
      env,
    )
  })

  it('rejects mutating project endpoints for viewer with 403', async () => {
    const viewerCalls = [
      { path: '/api/projects', method: 'POST', body: { name: 'Unauthorized' } },
      { path: `/api/projects/${project2Id}`, method: 'PATCH', body: { name: 'Hacked' } },
      { path: `/api/projects/${project2Id}/move`, method: 'POST', body: { afterId: null } },
      { path: `/api/projects/${project2Id}?confirm=Renamed Project`, method: 'DELETE' },
    ]

    for (const call of viewerCalls) {
      const res = await app.request(
        `http://localhost${call.path}`,
        {
          method: call.method,
          headers: {
            'Content-Type': 'application/json',
            Cookie: viewerCookie,
          },
          body: call.body ? JSON.stringify(call.body) : undefined,
        },
        env,
      )
      expect(res.status).toBe(403)
      const err = (await res.json()) as { error: { code: string } }
      expect(err.error.code).toBe('forbidden')
    }
  })

  it('permanent delete requires name confirmation and removes project', async () => {
    // Wrong name
    const failRes = await app.request(
      `http://localhost/api/projects/${project2Id}?confirm=WrongName`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(failRes.status).toBe(400)
    const err = (await failRes.json()) as { error: { code: string } }
    expect(err.error.code).toBe('name_mismatch')

    // Correct name
    const successRes = await app.request(
      `http://localhost/api/projects/${project2Id}?confirm=Renamed Project`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    )
    expect(successRes.status).toBe(200)

    // Verify deleted
    const [p] = await db.select().from(t.projects).where(eq(t.projects.id, project2Id))
    expect(p).toBeUndefined()

    await expectInvariantsHold(env.DB)
  })
})
