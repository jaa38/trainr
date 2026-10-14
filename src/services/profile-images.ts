import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'profile-images';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function getImageMimeType(asset: ImagePicker.ImagePickerAsset): AllowedMimeType | null {
  const mimeType = asset.mimeType?.toLowerCase();

  if (mimeType && ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    return mimeType as AllowedMimeType;
  }

  // Fall back to the selected file's extension if MIME metadata is missing.
  const fileName = asset.fileName ?? asset.uri;
  const extension = fileName.split(/[?#]/)[0].split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

function getImageExtension(mimeType: AllowedMimeType): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
  }
}

export async function pickAndUploadProfileImage(userId: string) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    if (!permission.canAskAgain) {
      throw new Error(
        'Photo library access is disabled. Open your device Settings, find TRAINR, and allow photo access.',
      );
    }

    throw new Error(
      'TRAINR needs photo library permission to choose a profile image. Please allow access and try again.',
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = getImageMimeType(asset);

  if (!mimeType) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }

  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error('Unable to read the selected image. Please try again.');
  }

  // Use binary data rather than a Blob whose type may be text/plain.
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new Error('The selected image is empty. Please choose another.');
  }

  if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error('Choose an image smaller than 5 MB.');
  }

  const extension = getImageExtension(mimeType);
  const path = `${userId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      avatar_url: path,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError) {
    const { error: cleanupError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (cleanupError) {
      console.error(
        '[Profile Images] Failed to clean up an unreferenced upload:',
        cleanupError,
      );
    }

    throw profileError;
  }

  return path;
}

export async function getProfileImageUrl(path: string | null) {
  if (!path) {
    return null;
  }

  // Preserve compatibility with existing absolute image URLs.
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
