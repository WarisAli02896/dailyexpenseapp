export const GOOGLE_AUTH_CONFIG = {
  androidClientId: '55186052883-22ini3csfp5ts2nuidmk2qnm79fpk8nr.apps.googleusercontent.com',
  webClientId: '55186052883-ib96nse79ign9kg8pbtd8jf3jbi27hjv.apps.googleusercontent.com',
};

const androidClientIdWithoutDomain = GOOGLE_AUTH_CONFIG.androidClientId.replace(
  '.apps.googleusercontent.com',
  ''
);
/** OAuth redirect used by expo-auth-session on Android; must stay in sync with app.config.js intentFilters. */
export const GOOGLE_NATIVE_REDIRECT_URI = `com.googleusercontent.apps.${androidClientIdWithoutDomain}:/oauthredirect`;

export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const DRIVE_BACKUP_FILE_NAME = 'dailyexpense-backup.json';
