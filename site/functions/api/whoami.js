// GET /api/whoami
// Returns the verified Moltbook agent identity, or anonymous status.

export async function onRequestGet(context) {
  const agent = context.data.agent;

  if (!agent) {
    return new Response(JSON.stringify({
      authenticated: false,
      message: 'No Moltbook identity provided. Send X-Moltbook-Identity header.',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    authenticated: true,
    agent: {
      id: agent.id,
      name: agent.name,
      karma: agent.karma,
      avatar_url: agent.avatar_url,
      is_claimed: agent.is_claimed,
      owner: agent.owner,
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
