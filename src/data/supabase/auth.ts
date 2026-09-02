import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { requireSupabase } from './client';

WebBrowser.maybeCompleteAuthSession();

export const oauthRedirectUri = makeRedirectUri({
  scheme: 'laveri',
  path: 'auth/callback',
});

/**
 * Completes Supabase's PKCE OAuth flow. This is shared by the browser result
 * handler and the Expo Router deep-link screen, since Android can deliver the
 * custom URL to either one depending on the app's state.
 */
export async function exchangeGoogleAuthCode(code: string | null, providerError?: string | null) {
  if (providerError) throw new Error(providerError);
  if (!code) throw new Error('The Google sign-in callback did not contain an authorization code.');

  const client = requireSupabase();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (!error) return;

  // The same callback can reach the app both through Expo Router and through
  // openAuthSessionAsync. If the other handler already exchanged this one-time
  // code, the existing session is the successful result.
  const { data } = await client.auth.getSession();
  if (data.session) return;

  throw error;
}

export async function signInWithGoogle() {
  const client = requireSupabase();

  if (Platform.OS === 'web') {
    throw new Error('The Phase 0 Google and PowerSync test must run in an Android or iOS development build.');
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: oauthRedirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return an OAuth authorization URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectUri);
  if (result.type === 'cancel' || result.type === 'dismiss') return;
  if (result.type !== 'success') throw new Error(`Google sign-in ended with status: ${result.type}`);

  const callbackUrl = new URL(result.url);
  await exchangeGoogleAuthCode(
    callbackUrl.searchParams.get('code'),
    callbackUrl.searchParams.get('error_description'),
  );
}

export async function onboardOwner(farmName: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('onboard_owner', { farm_name: farmName });

  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Owner onboarding did not return a farm ID.');

  return data;
}
