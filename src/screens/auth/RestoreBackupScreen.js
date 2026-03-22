import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { Button } from '../../components/common';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { GOOGLE_AUTH_CONFIG, GOOGLE_NATIVE_REDIRECT_URI } from '../../constants/googleDrive';
import { BACKUP_MESSAGES } from '../../messages/backupMessages';
import { restoreBackupAsNewUser } from '../../services/backupService';
import {
  downloadLatestBackupFromDrive,
  DRIVE_SCOPE,
} from '../../services/googleDriveBackupService';
import { showAlert } from '../../utils/alertUtils';
import { useAuth } from '../../hooks/useAuth';

const RestoreBackupScreen = ({ navigation }) => {
  const { login, markUserCreated } = useAuth();
  const [accessToken, setAccessToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const redirectUri = makeRedirectUri({
    native: GOOGLE_NATIVE_REDIRECT_URI,
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_AUTH_CONFIG.androidClientId,
    webClientId: GOOGLE_AUTH_CONFIG.webClientId,
    scopes: [DRIVE_SCOPE],
    redirectUri,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      if (response.params?.code && !response.authentication?.accessToken && !response.params?.access_token) {
        return;
      }

      const token =
        response.authentication?.accessToken ||
        response.params?.access_token ||
        '';

      if (!token) {
        setAccessToken('');
        showAlert('Error', BACKUP_MESSAGES.GOOGLE_CONNECT_FAILED);
        return;
      }

      setAccessToken(token);
      showAlert('Success', BACKUP_MESSAGES.GOOGLE_CONNECT_SUCCESS);
      return;
    }

    if (response.type === 'error') {
      const details =
        response.error?.message ||
        response.params?.error_description ||
        response.params?.error ||
        '';
      showAlert(
        'Error',
        details ? `${BACKUP_MESSAGES.GOOGLE_CONNECT_FAILED}\n${details}` : BACKUP_MESSAGES.GOOGLE_CONNECT_FAILED
      );
    }
  }, [response]);

  const handleConnectGoogle = async () => {
    if (!request) return;
    setIsConnecting(true);
    try {
      await promptAsync({
        showInRecents: true,
      });
    } catch (error) {
      showAlert('Error', BACKUP_MESSAGES.GOOGLE_CONNECT_FAILED);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRestoreNow = async () => {
    if (!accessToken) {
      showAlert('Error', BACKUP_MESSAGES.GOOGLE_CONNECT_REQUIRED);
      return;
    }

    setIsRestoring(true);
    try {
      const remoteBackup = await downloadLatestBackupFromDrive(accessToken);
      if (!remoteBackup.success) {
        const message =
          remoteBackup.code === 'NO_BACKUP'
            ? BACKUP_MESSAGES.NO_BACKUP_FOUND
            : remoteBackup.message || BACKUP_MESSAGES.RESTORE_FAILED;
        showAlert('Error', message);
        return;
      }

      const restored = await restoreBackupAsNewUser(remoteBackup.data);
      if (!restored.success) {
        const msg = restored.message || BACKUP_MESSAGES.RESTORE_FAILED;
        showAlert('Error', msg);
        return;
      }

      markUserCreated();
      login(restored.data.user);
      showAlert('Success', BACKUP_MESSAGES.RESTORE_LOGIN_SUCCESS);
    } catch (error) {
      showAlert('Error', BACKUP_MESSAGES.RESTORE_FAILED);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="cloud-download-outline" size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Restore Backup</Text>
          <Text style={styles.subtitle}>
            New device? Restore from Google Drive and continue without creating a new account.
          </Text>
        </View>

        <Text style={styles.status}>Status: {accessToken ? 'Google connected' : 'Not connected'}</Text>

        <Button
          title={accessToken ? 'Reconnect Google' : 'Connect Google'}
          onPress={handleConnectGoogle}
          loading={isConnecting}
          disabled={!request}
          variant="outline"
          style={styles.button}
        />

        <Button
          title="Restore And Continue"
          onPress={handleRestoreNow}
          loading={isRestoring}
          disabled={!accessToken}
          style={styles.button}
        />

        <Button
          title="Create New Account Instead"
          onPress={() => navigation.replace('Register')}
          variant="secondary"
          style={styles.button}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    marginBottom: 10,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
  },
  status: {
    marginBottom: 12,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginBottom: 10,
  },
});

export default RestoreBackupScreen;
