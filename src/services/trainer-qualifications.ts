import type { DocumentPickerAsset } from 'expo-document-picker';

import { supabase } from '@/lib/supabase';

import type {
  TrainerQualificationCategory,
  TrainerQualificationFormValues,
} from '@/schemas/trainer-qualifications';

const TABLE_NAME = 'trainer_qualifications';
const BUCKET_NAME = 'trainer-certificates';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type TrainerQualification = {
  id: string;
  trainer_id: string;
  category: TrainerQualificationCategory;
  qualification_name: string;
  issuing_organisation: string | null;
  date_obtained: string | null;
  expiry_date: string | null;
  certificate_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function normalizeOptionalValue(value: string): string | null {
  return value.trim() || null;
}

function toDatabaseValues(values: TrainerQualificationFormValues) {
  return {
    category: values.category,
    qualification_name: values.qualificationName.trim(),
    issuing_organisation: normalizeOptionalValue(values.issuingOrganisation),
    date_obtained: normalizeOptionalValue(values.dateObtained),
    expiry_date: normalizeOptionalValue(values.expiryDate),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Fetch all qualification and certification records for a trainer.
 */
export async function getTrainerQualifications(
  trainerId: string,
): Promise<TrainerQualification[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('trainer_id', trainerId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as TrainerQualification[];
}

/**
 * Create a qualification or certification.
 */
export async function createTrainerQualification(
  trainerId: string,
  values: TrainerQualificationFormValues,
): Promise<TrainerQualification> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      trainer_id: trainerId,
      ...toDatabaseValues(values),
    })
    .select('*')
    .single();

  if (error) throw error;

  return data as TrainerQualification;
}

/**
 * Update an existing qualification or certification.
 */
export async function updateTrainerQualification(
  trainerId: string,
  recordId: string,
  values: TrainerQualificationFormValues,
): Promise<TrainerQualification> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(toDatabaseValues(values))
    .eq('id', recordId)
    .eq('trainer_id', trainerId)
    .select('*')
    .single();

  if (error) throw error;

  return data as TrainerQualification;
}

/**
 * Delete a qualification or certification.
 * The database record is deleted before its optional storage object.
 */
export async function deleteTrainerQualification(
  trainerId: string,
  recordId: string,
): Promise<void> {
  const { data: record, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('certificate_path')
    .eq('id', recordId)
    .eq('trainer_id', trainerId)
    .single();

  if (fetchError) throw fetchError;

  const { error: deleteError } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', recordId)
    .eq('trainer_id', trainerId);

  if (deleteError) throw deleteError;

  if (record.certificate_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([record.certificate_path]);

    if (storageError) {
      console.error('[Trainer Qualifications] Certificate cleanup failed:', storageError);
    }
  }
}

/**
 * Upload a PDF, JPEG or PNG certificate to private storage.
 */
export async function uploadTrainerCertificate(
  trainerId: string,
  asset: DocumentPickerAsset,
): Promise<string> {
  const extension = asset.name.split('.').pop()?.toLowerCase();

  const mimeType =
    asset.mimeType ??
    {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    }[extension ?? ''];

  if (
    !mimeType ||
    !ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])
  ) {
    throw new Error('Only PDF, JPEG and PNG files are supported.');
  }

  if (asset.size !== undefined && asset.size > MAX_FILE_SIZE) {
    throw new Error('Certificate files must be 10 MB or smaller.');
  }

  const response = await fetch(asset.uri);

  if (!response.ok) {
    throw new Error('Unable to read the selected certificate.');
  }

  const fileData = await response.arrayBuffer();

  if (fileData.byteLength > MAX_FILE_SIZE) {
    throw new Error('Certificate files must be 10 MB or smaller.');
  }

  const safeFileName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${trainerId}/${Date.now()}-${safeFileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileData, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw error;

  return data.path;
}

/**
 * Generate a temporary viewing URL for a private certificate.
 */
export async function getTrainerCertificateUrl(certificatePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(certificatePath, 3600);

  if (error) throw error;

  return data.signedUrl;
}

/**
 * Attach an uploaded certificate to an existing record.
 */
export async function attachTrainerCertificate(
  trainerId: string,
  recordId: string,
  certificatePath: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      certificate_path: certificatePath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('trainer_id', trainerId);

  if (error) throw error;
}

/**
 * Remove a certificate without deleting its qualification record.
 */
export async function removeTrainerCertificate(
  trainerId: string,
  recordId: string,
): Promise<void> {
  const { data: record, error: fetchError } = await supabase
    .from(TABLE_NAME)
    .select('certificate_path')
    .eq('id', recordId)
    .eq('trainer_id', trainerId)
    .single();

  if (fetchError) throw fetchError;

  if (!record.certificate_path) return;

  const { error: updateError } = await supabase
    .from(TABLE_NAME)
    .update({
      certificate_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .eq('trainer_id', trainerId);

  if (updateError) throw updateError;

  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([record.certificate_path]);

  if (storageError) {
    console.error('[Trainer Qualifications] Certificate removal failed:', storageError);

    throw storageError;
  }
}

/**
 * Delete an uploaded certificate file from private storage.
 * Used for cleaning up files when an attachment operation fails
 * or when replacing an existing certificate.
 */
export async function deleteTrainerCertificateFile(
  certificatePath: string,
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([certificatePath]);

  if (error) throw error;
}
