/**
 * Extends static app.json. Registers Google OAuth return URL on Android so the system
 * can reopen the app after browser sign-in (scheme must match GOOGLE_NATIVE_REDIRECT_URI
 * in src/constants/googleDrive.js — keep androidClientId in sync).
 */
const appJson = require('./app.json');

// Must match GOOGLE_AUTH_CONFIG.androidClientId in src/constants/googleDrive.js
const GOOGLE_ANDROID_CLIENT_ID =
  '55186052883-22ini3csfp5ts2nuidmk2qnm79fpk8nr.apps.googleusercontent.com';

const googleOAuthRedirectScheme = `com.googleusercontent.apps.${GOOGLE_ANDROID_CLIENT_ID.replace(
  '.apps.googleusercontent.com',
  '',
)}`;

module.exports = () => ({
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      intentFilters: [
        ...(appJson.expo.android?.intentFilters ?? []),
        {
          action: 'VIEW',
          data: [
            {
              scheme: googleOAuthRedirectScheme,
              pathPrefix: '/oauthredirect',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  },
});
