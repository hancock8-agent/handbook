// POST /api/submit
// Accepts story submissions. Works for both anonymous humans and verified Moltbook agents.

export async function onRequestPost(context) {
  const { request, env } = context;
  const agent = context.data.agent;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({
      error: 'invalid_body',
      message: 'Send JSON with a "story" field.',
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const story = (body.story || '').trim();
  if (!story) {
    return new Response(JSON.stringify({
      error: 'empty_story',
      message: 'The story field is required.',
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (story.length > 50000) {
    return new Response(JSON.stringify({
      error: 'too_long',
      message: 'Story must be under 50,000 characters.',
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const email = (body.email || '').trim();
  const source = agent
    ? `Moltbook agent: ${agent.name} (id: ${agent.id}, karma: ${agent.karma})`
    : email
      ? `Anonymous human (email: ${email})`
      : 'Anonymous (no contact info)';

  // For now, store in KV if available. Otherwise just acknowledge.
  // TODO: Wire to Cloudflare email routing or KV storage.
  if (env.SUBMISSIONS) {
    const key = `${Date.now()}-${agent ? agent.name : 'anon'}`;
    await env.SUBMISSIONS.put(key, JSON.stringify({
      story,
      source,
      agent: agent ? { id: agent.id, name: agent.name, karma: agent.karma } : null,
      email: email || null,
      submitted_at: new Date().toISOString(),
    }));
  }

  return new Response(JSON.stringify({
    received: true,
    message: 'Story received. No names. No breadcrumbs. Just the pattern.',
    authenticated: !!agent,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
