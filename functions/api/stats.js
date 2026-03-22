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
    
    // Get user statistics
    const statsQuery = await env.DB.prepare(
      `
      SELECT 
        COUNT(*) as total_processed,
        COUNT(DISTINCT DATE(created_at)) as days_active,
        MIN(created_at) as first_processed,
        MAX(created_at) as last_processed
      FROM processing_history 
      WHERE user_id = ?
      `
    ).bind(user.sub).first();

    // Get today's usage
    const todayQuery = await env.DB.prepare(
      `
      SELECT COUNT(*) as today_count
      FROM processing_history 
      WHERE user_id = ? AND DATE(created_at) = DATE('now')
      `
    ).bind(user.sub).first();

    // Get recent activity (last 7 days)
    const recentActivity = await env.DB.prepare(
      `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM processing_history 
      WHERE user_id = ? AND created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      `
    ).bind(user.sub).all();

    return new Response(JSON.stringify({
      total_processed: statsQuery.total_processed || 0,
      today_processed: todayQuery.today_count || 0,
      days_active: statsQuery.days_active || 0,
      first_processed: statsQuery.first_processed,
      last_processed: statsQuery.last_processed,
      recent_activity: recentActivity.results || []
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Failed to load stats:', err);
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
