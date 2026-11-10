
import { supabase } from '@/lib/supabase';

export type FitnessMetricType =
  | 'body_weight'
  | 'body_fat'
  | 'waist'
  | 'chest'
  | 'hips'
  | 'arm'
  | 'thigh';

export type FitnessMetricUnit = 'kg' | 'lb' | '%' | 'cm' | 'in';

export type FitnessProgress = {
  id: string;
  user_id: string;
  metric_type: FitnessMetricType;
  value: number;
  unit: FitnessMetricUnit;
  recorded_at: string;
  notes: string | null;
  created_at: string;
};

export type CreateFitnessProgressInput = {
  metricType: FitnessMetricType;
  value: number;
  unit: FitnessMetricUnit;
  recordedAt: string;
  notes?: string | null;
};

export type BodyWeightInput = {
  value: number;
  unit: 'kg' | 'lb';
  recordedAt: string;
  notes?: string | null;
};

const FITNESS_PROGRESS_COLUMNS = `
  id,
  user_id,
  metric_type,
  value,
  unit,
  recorded_at,
  notes,
  created_at
`;

const VALID_METRICS: FitnessMetricType[] = [
  'body_weight',
  'body_fat',
  'waist',
  'chest',
  'hips',
  'arm',
  'thigh',
];

const VALID_UNITS: FitnessMetricUnit[] = [
  'kg',
  'lb',
  '%',
  'cm',
  'in',
];

function validateMeasurement({
  metricType,
  value,
  unit,
  recordedAt,
  notes,
}: CreateFitnessProgressInput) {
  if (!VALID_METRICS.includes(metricType)) {
    throw new Error('Please select a valid fitness measurement.');
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Measurement must be a positive number.');
  }

  if (!VALID_UNITS.includes(unit)) {
    throw new Error('Please select a valid measurement unit.');
  }

  if (
    metricType === 'body_weight' &&
    unit !== 'kg' &&
    unit !== 'lb'
  ) {
    throw new Error('Body weight must use kg or lb.');
  }

  if (metricType === 'body_fat' && unit !== '%') {
    throw new Error('Body fat must use percentage.');
  }

  if (
    ['waist', 'chest', 'hips', 'arm', 'thigh'].includes(metricType) &&
    unit !== 'cm' &&
    unit !== 'in'
  ) {
    throw new Error('Body measurements must use cm or in.');
  }

  if (!recordedAt || Number.isNaN(Date.parse(recordedAt))) {
    throw new Error('Please provide a valid measurement date.');
  }

  if (new Date(recordedAt).getTime() > Date.now()) {
    throw new Error('Measurement date cannot be in the future.');
  }

  if (notes && notes.trim().length > 1000) {
    throw new Error('Notes must be 1,000 characters or fewer.');
  }
}

async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[Fitness Progress] Unable to verify user:', error);
    throw new Error('Unable to verify your account. Please try again.');
  }

  if (!user) {
    throw new Error('Please sign in to continue.');
  }

  return user;
}

/**
 * Retrieves the authenticated user's fitness measurements.
 * Results are ordered from newest to oldest.
 */
export async function getFitnessProgress(): Promise<FitnessProgress[]> {
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_progress')
    .select(FITNESS_PROGRESS_COLUMNS)
    .eq('user_id', user.id)
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Fitness Progress] Unable to load measurements:', error);
    throw new Error('Unable to load your fitness progress. Please try again.');
  }

  return (data ?? []) as unknown as FitnessProgress[];
}

/**
 * Retrieves the authenticated user's body-weight history.
 * Results are ordered from newest to oldest.
 */
export async function getBodyWeightHistory(): Promise<FitnessProgress[]> {
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_progress')
    .select(FITNESS_PROGRESS_COLUMNS)
    .eq('user_id', user.id)
    .eq('metric_type', 'body_weight')
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Fitness Progress] Unable to load weight history:', error);
    throw new Error('Unable to load your weight history. Please try again.');
  }

  return (data ?? []) as unknown as FitnessProgress[];
}

/**
 * Retrieves the latest body-weight record.
 * Returns null when no weight has been recorded.
 */
export async function getCurrentBodyWeight(): Promise<FitnessProgress | null> {
  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_progress')
    .select(FITNESS_PROGRESS_COLUMNS)
    .eq('user_id', user.id)
    .eq('metric_type', 'body_weight')
    .order('recorded_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Fitness Progress] Unable to load current weight:', error);
    throw new Error('Unable to load your current weight. Please try again.');
  }

  return data as unknown as FitnessProgress | null;
}

/**
 * Records a new fitness measurement for the authenticated user.
 * Ownership is enforced by database RLS.
 */
export async function createFitnessProgress(
  input: CreateFitnessProgressInput,
): Promise<FitnessProgress> {
  validateMeasurement(input);

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_progress')
    .insert({
      user_id: user.id,
      metric_type: input.metricType,
      value: input.value,
      unit: input.unit,
      recorded_at: new Date(input.recordedAt).toISOString(),
      notes: input.notes?.trim() || null,
    })
    .select(FITNESS_PROGRESS_COLUMNS)
    .single();

  if (error) {
    console.error('[Fitness Progress] Unable to save measurement:', error);
    throw new Error('Unable to save your measurement. Please try again.');
  }

  return data as unknown as FitnessProgress;
}

/**
 * Updates an existing body-weight record.
 * The database RLS policy enforces ownership and gym-goer permissions.
 */
export async function updateBodyWeight(
  progressId: string,
  input: BodyWeightInput,
): Promise<FitnessProgress> {
  if (!progressId.trim()) {
    throw new Error('A valid weight record is required.');
  }

  validateMeasurement({
    metricType: 'body_weight',
    value: input.value,
    unit: input.unit,
    recordedAt: input.recordedAt,
    notes: input.notes,
  });

  const user = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from('fitness_progress')
    .update({
      value: input.value,
      unit: input.unit,
      recorded_at: new Date(input.recordedAt).toISOString(),
      notes: input.notes?.trim() || null,
    })
    .eq('id', progressId)
    .eq('user_id', user.id)
    .eq('metric_type', 'body_weight')
    .select(FITNESS_PROGRESS_COLUMNS)
    .single();

  if (error) {
    console.error('[Fitness Progress] Unable to update weight:', error);
    throw new Error('Unable to update your weight. Please try again.');
  }

  return data as unknown as FitnessProgress;
}
