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
    
    // Get history from D1 database
    const stmt = env.DB.prepare(
      `SELECT * FROM processing_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(user.sub);
    
    const result = await stmt.all();
    
    return new Response(JSON.stringify(result.results || []), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to load history:', err);
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
    
    // Ensure user exists
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)`
    ).bind(user.sub, user.email, user.name, user.picture).run();
    
    // Save processing history
    const stmt = env.DB.prepare(
      `INSERT INTO processing_history (user_id, original_url, result_url) VALUES (?, ?, ?)`
    ).bind(user.sub, body.original_url, body.result_url);
    
    await stmt.run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error saving history:', err);
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
