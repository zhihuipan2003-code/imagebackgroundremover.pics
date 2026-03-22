export async function onRequestGet(context) {
  const { request, env } = context;
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = authHeader.substring(7);
    const user = await verifyJWT(token, env.JWT_SECRET);
    
    // Get API settings
    const settingsStmt = env.DB.prepare(
      `SELECT api_key, default_output_format, default_size FROM user_settings WHERE user_id = ?`
    ).bind(user.sub);
    
    const settingsResult = await settingsStmt.first();
    
    // Don't return the actual API key for security
    return new Response(JSON.stringify({
      has_api_key: !!settingsResult?.api_key,
      default_output_format: settingsResult?.default_output_format || 'auto',
      default_size: settingsResult?.default_size || 'auto'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to load API settings:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = authHeader.substring(7);
    const user = await verifyJWT(token, env.JWT_SECRET);
    const body = await request.json();
    
    // Note: In production, you should encrypt the API key before storing
    const stmt = env.DB.prepare(`
      INSERT INTO user_settings (user_id, api_key, default_output_format, default_size)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        api_key = excluded.api_key,
        default_output_format = excluded.default_output_format,
        default_size = excluded.default_size,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      user.sub,
      body.api_key || null,
      body.default_output_format || 'auto',
      body.default_size || 'auto'
    );
    
    await stmt.run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to save API settings:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function verifyJWT(token, secret) {
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));

  const isValid = await crypto.subtle.verify('HMAC', key, signature, signatureInput);
  if (!isValid) throw new Error('Invalid signature');

  const payload = JSON.parse(atob(payloadB64));
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}