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
    
    // Get user settings
    const settingsStmt = env.DB.prepare(
      `SELECT * FROM user_settings WHERE user_id = ?`
    ).bind(user.sub);
    
    const settingsResult = await settingsStmt.first();
    
    return new Response(JSON.stringify(settingsResult || {}), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to load settings:', err);
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
    
    // Upsert user settings
    const stmt = env.DB.prepare(`
      INSERT INTO user_settings (user_id, display_name, language, theme)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        language = excluded.language,
        theme = excluded.theme,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      user.sub,
      body.display_name || user.name,
      body.language || 'zh-CN',
      body.theme || 'light'
    );
    
    await stmt.run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to save settings:', err);
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