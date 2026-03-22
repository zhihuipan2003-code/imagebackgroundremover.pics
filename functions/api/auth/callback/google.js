export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(`/?error=${error}`, 302);
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${new URL(request.url).origin}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`User info fetch failed: ${userResponse.status}`);
    }

    const user = await userResponse.json();
    
    // Generate JWT
    const jwt = await generateJWT(user, env.JWT_SECRET);
    
    // Redirect back to home with token
    return Response.redirect(`https://imagebackgroundremover.pics/?token=${jwt}`, 302);

  } catch (err) {
    console.error('OAuth callback error:', err);
    return Response.redirect(`/?error=auth_failed`, 302);
  }
}

async function generateJWT(user, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
  };

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const headerBase64 = btoa(JSON.stringify(header)).replace(/=+$/, '');
  const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=+$/, '');
  const signatureInput = encoder.encode(`${headerBase64}.${payloadBase64}`);
  const signature = await crypto.subtle.sign('HMAC', key, signatureInput);
  
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray)).replace(/=+$/, '');

  return `${headerBase64}.${payloadBase64}.${signatureBase64}`;
}
