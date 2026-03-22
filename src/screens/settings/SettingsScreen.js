import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { Button } from '../../components/common';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { GOOGLE_AUTH_CONFIG, GOOGLE_NATIVE_REDIRECT_URI } from '../../constants/googleDrive';
import { useAuth } from '../../hooks/useAuth';
import { logoutUser } from '../../services/authService';
import { exportUserBackup, restoreUserBackup } from '../../services/backupService';
import {
  downloadLatestBackupFromDrive,
  DRIVE_SCOPE,
  uploadBackupToDrive,
} from '../../services/googleDriveBackupService';
import { BACKUP_MESSAGES } from '../../messages/backupMessages';
import { AUTH_MESSAGES } from '../../messages/authMessages';
import { showAlert, showConfirm } from '../../utils/alertUtils';

const SettingsScreen = ({ navigation }) => {
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
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
      // Native Google flow uses authorization code first; expo-auth-session exchanges it async.
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

  const handleLogout = () => {
    showConfirm('Logout', 'Are you sure you want to logout?', async () => {
      setLoading(true);
      try {
        const result = await logoutUser();
        if (result.success) {
          showAlert('Success', result.message || AUTH_MESSAGES.LOGOUT_SUCCESS);
          logout();
        } else {
          showAlert('Error', result.message);
        }
      } catch (error) {
        showAlert('Error', AUTH_MESSAGES.LOGOUT_FAILED);
      } finally {
        setLoading(false);
      }
    });
  };

  const handleConnectGoogle = async () => {
    if (!request) return;

    setIsConnectingGoogle(true);
    try {
      await promptAsync({
        showInRecents: true,
      });
    } catch (error) {
      showAlert('Error', BACKUP_MESSAGES.GOOGLE_CONNECT_FAILED);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleBackupNow = async () => {
    if (!accessToken) {
      showAlert('Error', BACKUP_MESSAGES.GOOGLE_CONNECT_REQUIRED);
      return;
    }

    setIsBackingUp(true);
    try {
      const localBackup = await exportUserBackup(user.id);
      if (!localBackup.success) {
        showAlert('Error', localBackup.message || BACKUP_MESSAGES.BACKUP_FAILED);
        return;
      }

      const uploaded = await uploadBackupToDrive(accessToken, localBackup.data);
      if (!uploaded.success) {
        showAlert('Error', uploaded.message || BACKUP_MESSAGES.BACKUP_FAILED);
        return;
      }

      showAlert('Success', BACKUP_MESSAGES.BACKUP_SUCCESS);
    } catch (error) {
      showAlert('Error', BACKUP_MESSAGES.BACKUP_FAILED);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreNow = () => {
    if (!accessToken) {
      showAlert('Error', BACKUP_MESSAGES.GOOGLE_CONNECT_REQUIRED);
      return;
    }

    showConfirm(
      BACKUP_MESSAGES.RESTORE_CONFIRM_TITLE,
      BACKUP_MESSAGES.RESTORE_CONFIRM_MESSAGE,
      async () => {
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

          const restored = await restoreUserBackup(user.id, remoteBackup.data);
          if (!restored.success) {
            showAlert('Error', restored.message || BACKUP_MESSAGES.RESTORE_FAILED);
            return;
          }

          if (restored.data?.user) {
            updateUser(restored.data.user);
          }

          showAlert('Success', BACKUP_MESSAGES.RESTORE_SUCCESS);
        } catch (error) {
          showAlert('Error', BACKUP_MESSAGES.RESTORE_FAILED);
        } finally {
          setIsRestoring(false);
        }
      }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>
              {user?.username ? `Logged in as ${user.username}` : 'Manage your account preferences'}
            </Text>
          </View>
        </View>

        <Button
          title="Edit Profile"
          onPress={() => navigation.navigate('Profile')}
          variant="outline"
          style={styles.profileButton}
        />

        <View style={styles.backupCard}>
          <View style={styles.backupHeader}>
            <Ionicons name="cloud-outline" size={20} color={COLORS.primary} />
            <Text style={styles.backupTitle}>Google Drive Backup</Text>
          </View>
          <Text style={styles.backupSubtitle}>
            Status: {accessToken ? 'Connected' : 'Not connected'}
          </Text>

          <Button
            title={accessToken ? 'Reconnect Google' : 'Connect Google'}
            onPress={handleConnectGoogle}
            loading={isConnectingGoogle}
            disabled={!request}
            variant="outline"
            style={styles.backupButton}
          />

          <Button
            title="Backup Now"
            onPress={handleBackupNow}
            loading={isBackingUp}
            disabled={!accessToken}
            style={styles.backupButton}
          />

          <Button
            title="Restore Latest Backup"
            onPress={handleRestoreNow}
            loading={isRestoring}
            disabled={!accessToken}
            variant="secondary"
            style={styles.backupButton}
          />
        </View>

        <Button
          title="Logout"
          onPress={handleLogout}
          loading={loading}
          variant="danger"
          style={styles.logoutButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    marginRight: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    marginTop: 4,
  },
  profileButton: {
    marginBottom: 10,
  },
  backupCard: {
    marginTop: 6,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
  },
  backupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  backupTitle: {
    marginLeft: 8,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  backupSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  backupButton: {
    marginBottom: 8,
  },
});

export default SettingsScreen;
