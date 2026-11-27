/**
 * TRAINR — Personal Workout & Progress Tracking
 *
 * Shared types for Gym-Goers and Personal Trainers.
 * These models represent personal workouts, not assigned programme logs.
 */

// =========================================================
// CATEGORIES AND STATUS
// =========================================================

export type PersonalWorkoutCategory =
  'strength' | 'cardio' | 'bodyweight' | 'flexibility' | 'functional' | 'custom';

export type PersonalWorkoutStatus = 'draft' | 'in_progress' | 'completed';

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';

export type FitnessGoalType =
  | 'workout_frequency'
  | 'strength_target'
  | 'cardio_target'
  | 'workout_duration'
  | 'body_weight'
  | 'custom';

export type FitnessGoalStatus = 'active' | 'paused' | 'completed' | 'archived';

// =========================================================
// PERSONAL WORKOUTS
// =========================================================

export type PersonalWorkout = {
  id: string;
  user_id: string;
  workout_name: string;
  workout_type: PersonalWorkoutCategory;
  workout_date: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  status: PersonalWorkoutStatus;
  created_at: string;
  updated_at: string;
};

export type CreatePersonalWorkoutInput = {
  workout_name: string;
  workout_type: PersonalWorkoutCategory;
  workout_date?: string;
  started_at?: string | null;
  notes?: string | null;
  status?: Exclude<PersonalWorkoutStatus, 'completed'>;
};

export type UpdatePersonalWorkoutInput = {
  workout_name?: string;
  workout_type?: PersonalWorkoutCategory;
  workout_date?: string;
  started_at?: string | null;
  notes?: string | null;
  duration_seconds?: number | null;
};

/**
 * Completion is handled separately by the service so that
 * completed_at and duration_seconds are set consistently.
 */
export type CompletePersonalWorkoutInput = {
  completed_at?: string;
  duration_seconds?: number;
};

// =========================================================
// PERSONAL EXERCISES
// =========================================================

export type PersonalExercise = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: PersonalWorkoutCategory;
  muscle_group: string | null;
  equipment: string[];
  instructions: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatePersonalExerciseInput = {
  name: string;
  description?: string | null;
  category: PersonalWorkoutCategory;
  muscle_group?: string | null;
  equipment?: string[];
  instructions?: string | null;
};

export type UpdatePersonalExerciseInput = Partial<CreatePersonalExerciseInput>;

// =========================================================
// WORKOUT EXERCISES
// =========================================================

export type WorkoutExercise = {
  id: string;
  workout_id: string;
  exercise_id: string | null;
  personal_exercise_id: string | null;
  exercise_order: number;
  notes: string | null;
  created_at: string;
};

export type CreateWorkoutExerciseInput = {
  workout_id: string;
  exercise_id?: string | null;
  personal_exercise_id?: string | null;
  exercise_order?: number;
  notes?: string | null;
};

export type UpdateWorkoutExerciseInput = {
  exercise_order?: number;
  notes?: string | null;
};

// =========================================================
// WORKOUT SETS
// =========================================================

export type WorkoutSet = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  repetitions: number | null;
  weight: number | null;
  weight_unit: WeightUnit | null;
  duration_seconds: number | null;
  distance: number | null;
  distance_unit: DistanceUnit | null;
  notes: string | null;
  created_at: string;
};

export type CreateWorkoutSetInput = {
  workout_exercise_id: string;
  set_number: number;
  repetitions?: number | null;
  weight?: number | null;
  weight_unit?: WeightUnit | null;
  duration_seconds?: number | null;
  distance?: number | null;
  distance_unit?: DistanceUnit | null;
  notes?: string | null;
};

export type UpdateWorkoutSetInput = Partial<
  Omit<CreateWorkoutSetInput, 'workout_exercise_id'>
>;

// =========================================================
// WORKOUT DETAILS
// =========================================================

export type WorkoutExerciseWithSets = WorkoutExercise & {
  sets: WorkoutSet[];
};

export type PersonalWorkoutDetails = PersonalWorkout & {
  exercises: WorkoutExerciseWithSets[];
};

// =========================================================
// FITNESS GOALS
// =========================================================

export type FitnessGoal = {
  id: string;
  user_id: string;
  goal_type: FitnessGoalType;
  goal_name: string;
  description: string | null;
  target_value: number;
  current_value: number | null;
  measurement_unit: string | null;
  exercise_id: string | null;
  personal_exercise_id: string | null;
  start_date: string;
  target_date: string | null;
  goal_status: FitnessGoalStatus;
  created_at: string;
  updated_at: string;
};

export type CreateFitnessGoalInput = {
  goal_type: FitnessGoalType;
  goal_name: string;
  description?: string | null;
  target_value: number;
  current_value?: number | null;
  measurement_unit?: string | null;
  exercise_id?: string | null;
  personal_exercise_id?: string | null;
  start_date?: string;
  target_date?: string | null;
};

export type UpdateFitnessGoalInput = Partial<CreateFitnessGoalInput> & {
  goal_status?: FitnessGoalStatus;
};

// =========================================================
// PERSONAL RECORDS
// =========================================================

export type PersonalRecordType =
  'max_weight' | 'max_repetitions' | 'max_distance' | 'fastest_time';

export type PersonalRecordUnit = 'kg' | 'reps' | 'km' | 'seconds';

export type PersonalRecord = {
  id: string;
  user_id: string;
  exercise_id: string | null;
  personal_exercise_id: string | null;
  exercise_category: PersonalWorkoutCategory;
  source_category: string | null;
  record_type: PersonalRecordType;
  record_value: number;
  measurement_unit: PersonalRecordUnit;
  workout_set_id: string;
  achieved_at: string;
  comparison_distance_meters: number | null;
};
