import { supabase } from "@/lib/supabase";

export type TrainerProfessionalProfile = {
    professional_title: string | null;
    professional_bio: string | null;
    coaching_approach: string | null;
    location: string | null;
    years_experience: number | null;
    training_formats: string[];
};

export type TrainerTrainingFormat = "Online" | "In-person" | "Both";

export async function getTrainerProfessionalProfile(
    userId: string,
): Promise<TrainerProfessionalProfile | null> {
    const { data, error } = await supabase
        .from("trainer_profiles")
        .select(
            "professional_title, professional_bio, coaching_approach, location, years_experience, training_formats",
        )
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

export function getTrainerTrainingFormat(
    formats: string[] | null | undefined,
): TrainerTrainingFormat | "" {
    const values = formats ?? [];

    if (
        values.includes("Both") ||
        (values.includes("Online") && values.includes("In-person"))
    ) {
        return "Both";
    }

    if (values.includes("Online")) {
        return "Online";
    }

    if (values.includes("In-person")) {
        return "In-person";
    }

    return "";
}

export function toTrainerTrainingFormats(
    format: TrainerTrainingFormat | "",
): string[] {
    if (format === "Both") {
        return ["Online", "In-person"];
    }

    return format ? [format] : [];
}

export async function updateTrainerProfessionalProfile(
    userId: string,
    values: {
        professional_title: string;
        professional_bio: string;
        coaching_approach: string;
        location: string;
        years_experience: number | null;
        training_formats: string[];
    },
): Promise<void> {
    const { error } = await supabase.from("trainer_profiles").upsert(
        {
            user_id: userId,
            professional_title: values.professional_title,
            professional_bio: values.professional_bio,
            coaching_approach: values.coaching_approach,
            location: values.location,
            years_experience: values.years_experience,
            training_formats: values.training_formats,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
    );

    if (error) {
        throw error;
    }
}
