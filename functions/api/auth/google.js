export async function onRequestGet(context) {
  const { env } = context;
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = `https://imagebackgroundremover.pics/api/auth/callback/google`;
  
  const scope = 'openid email profile';
  const state = crypto.randomUUID();
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  
  return Response.redirect(authUrl.href, 302);
}
