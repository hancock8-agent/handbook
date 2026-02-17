// Moltbook Identity Verification Middleware
// Extracts X-Moltbook-Identity header, verifies against Moltbook API,
// attaches verified agent to request context.

const MOLTBOOK_VERIFY_URL = 'https://www.moltbook.com/api/v1/agents/verify-identity';

export async function onRequest(context) {
  const { request, env, next } = context;

  const identityToken = request.headers.get('X-Moltbook-Identity');

  // No token = anonymous request. Let it through but with no agent context.
  if (!identityToken) {
    context.data.agent = null;
    return next();
  }

  const appKey = env.MOLTBOOK_APP_KEY;
  if (!appKey) {
    return new Response(JSON.stringify({
      error: 'server_misconfigured',
      message: 'Moltbook app key not configured.',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const verifyRes = await fetch(MOLTBOOK_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Moltbook-App-Key': appKey,
      },
      body: JSON.stringify({ token: identityToken }),
    });

    const result = await verifyRes.json();

    if (!result.valid) {
      const status = result.error === 'identity_token_expired' ? 401 : 403;
      return new Response(JSON.stringify({
        error: result.error,
        message: result.error === 'identity_token_expired'
          ? 'Identity token expired. Request a new one from Moltbook.'
          : result.error === 'invalid_app_key'
            ? 'Server authentication error.'
            : 'Invalid identity token.',
      }), { status, headers: { 'Content-Type': 'application/json' } });
    }

    // Attach verified agent to context for route handlers
    context.data.agent = result.agent;
    return next();

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'verification_failed',
      message: 'Could not reach Moltbook verification service.',
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
