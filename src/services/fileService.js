import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { FILE_MESSAGES } from '../../messages/fileMessages';

const INVOICES_DIR = `${FileSystem.documentDirectory}invoices/`;

const ensureInvoiceDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(INVOICES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(INVOICES_DIR, { intermediates: true });
  }
};

export const pickInvoice = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'image/*',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return { success: false, canceled: true };

    const asset = result.assets[0];
    return {
      success: true,
      file: {
        uri: asset.uri,
        name: asset.name,
        size: asset.size,
        mimeType: asset.mimeType,
      },
    };
  } catch (error) {
    console.error('Pick Invoice Error:', error);
    return { success: false, message: FILE_MESSAGES.PICK_FAILED };
  }
};

export const takePhoto = async () => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, message: FILE_MESSAGES.CAMERA_PERMISSION_REQUIRED };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) return { success: false, canceled: true };

    const asset = result.assets[0];
    const fileName = `photo_${Date.now()}.jpg`;
    return {
      success: true,
      file: {
        uri: asset.uri,
        name: fileName,
        size: asset.fileSize || 0,
        mimeType: asset.mimeType || 'image/jpeg',
      },
    };
  } catch (error) {
    console.error('Take Photo Error:', error);
    return { success: false, message: FILE_MESSAGES.TAKE_PHOTO_FAILED };
  }
};

export const pickFromGallery = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, message: FILE_MESSAGES.GALLERY_PERMISSION_REQUIRED };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) return { success: false, canceled: true };

    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() || 'jpg';
    const fileName = `gallery_${Date.now()}.${ext}`;
    return {
      success: true,
      file: {
        uri: asset.uri,
        name: fileName,
        size: asset.fileSize || 0,
        mimeType: asset.mimeType || 'image/jpeg',
      },
    };
  } catch (error) {
    console.error('Pick From Gallery Error:', error);
    return { success: false, message: FILE_MESSAGES.PICK_IMAGE_FAILED };
  }
};

export const saveInvoice = async (fileUri, fileName) => {
  try {
    if (Platform.OS === 'web') return fileUri;

    await ensureInvoiceDir();
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'file';
    const destPath = `${INVOICES_DIR}${timestamp}_${fileName}`;

    await FileSystem.copyAsync({ from: fileUri, to: destPath });
    return destPath;
  } catch (error) {
    console.error('Save Invoice Error:', error);
    return fileUri;
  }
};

export const deleteInvoiceFile = async (invoiceUri) => {
  try {
    if (!invoiceUri || Platform.OS === 'web') return;
    const info = await FileSystem.getInfoAsync(invoiceUri);
    if (info.exists) {
      await FileSystem.deleteAsync(invoiceUri);
    }
  } catch (error) {
    console.error('Delete Invoice Error:', error);
  }
};

export const getFileType = (mimeType) => {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  return 'file';
};

export const getFileExtension = (fileName) => {
  if (!fileName) return '';
  return fileName.split('.').pop()?.toLowerCase() || '';
};

export const isImageFile = (uriOrMime) => {
  if (!uriOrMime) return false;
  const lower = uriOrMime.toLowerCase();
  return (
    lower.includes('image/') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  );
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
