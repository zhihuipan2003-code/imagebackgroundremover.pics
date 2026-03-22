export async function onRequestDelete(context) {
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
    
    // Get history ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const historyId = pathParts[pathParts.length - 1];
    
    if (!historyId || isNaN(historyId)) {
      return new Response(JSON.stringify({ error: 'Invalid history ID' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete the history record
    // First verify it belongs to the user
    const checkStmt = env.DB.prepare(
      `SELECT id FROM processing_history WHERE id = ? AND user_id = ?`
    ).bind(historyId, user.sub);
    
    const record = await checkStmt.first();
    
    if (!record) {
      return new Response(JSON.stringify({ error: 'Record not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete the record
    const deleteStmt = env.DB.prepare(
      `DELETE FROM processing_history WHERE id = ?`
    ).bind(historyId);
    
    await deleteStmt.run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to delete history:', err);
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