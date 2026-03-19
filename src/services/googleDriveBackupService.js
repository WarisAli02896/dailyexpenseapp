import { DRIVE_APPDATA_SCOPE, DRIVE_BACKUP_FILE_NAME } from '../constants/googleDrive';
import { BACKUP_MESSAGES } from '../../messages/backupMessages';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

const parseError = async (response) => {
  try {
    const data = await response.json();
    return data?.error?.message || 'Google Drive request failed.';
  } catch {
    return 'Google Drive request failed.';
  }
};

const authorizedRequest = async (url, accessToken, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response;
};

const listBackups = async (accessToken) => {
  const query = encodeURIComponent(
    `name='${DRIVE_BACKUP_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`
  );

  const response = await authorizedRequest(
    `${DRIVE_API_BASE}/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
    accessToken
  );

  const data = await response.json();
  return data?.files || [];
};

const createBackupFile = async (accessToken) => {
  const response = await authorizedRequest(`${DRIVE_API_BASE}/files`, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_BACKUP_FILE_NAME,
      parents: ['appDataFolder'],
    }),
  });

  return response.json();
};

export const uploadBackupToDrive = async (accessToken, backupPayload) => {
  try {
    const files = await listBackups(accessToken);
    let fileId = files[0]?.id;

    if (!fileId) {
      const created = await createBackupFile(accessToken);
      fileId = created.id;
    }

    await authorizedRequest(
      `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media`,
      accessToken,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupPayload),
      }
    );

    return { success: true, data: { fileId } };
  } catch (error) {
    console.error('Drive Upload Error:', error);
    return { success: false, message: error.message || 'Drive upload failed.' };
  }
};

export const downloadLatestBackupFromDrive = async (accessToken) => {
  try {
    const files = await listBackups(accessToken);
    const latest = files[0];

    if (!latest?.id) {
      return { success: false, code: 'NO_BACKUP', message: BACKUP_MESSAGES.NO_BACKUP_FOUND };
    }

    const response = await authorizedRequest(
      `${DRIVE_API_BASE}/files/${latest.id}?alt=media`,
      accessToken
    );
    const payload = await response.json();

    return {
      success: true,
      data: payload,
      meta: {
        fileId: latest.id,
        modifiedTime: latest.modifiedTime,
      },
    };
  } catch (error) {
    console.error('Drive Download Error:', error);
    return { success: false, message: error.message || 'Drive download failed.' };
  }
};

export const DRIVE_SCOPE = DRIVE_APPDATA_SCOPE;
