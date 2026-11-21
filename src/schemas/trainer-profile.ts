import { z } from "zod";

export const trainerProfileSchema = z.object({
    professionalTitle: z
        .string()
        .trim()
        .max(120, "Professional title must be 120 characters or fewer."),

    professionalBio: z
        .string()
        .trim()
        .min(30, "Your professional bio must be at least 30 characters.")
        .max(1000, "Your professional bio must be 1,000 characters or fewer."),

    coachingApproach: z
        .string()
        .trim()
        .min(20, "Your coaching approach must be at least 20 characters.")
        .max(1000, "Your coaching approach must be 1,000 characters or fewer."),

    location: z
        .string()
        .trim()
        .min(1, "Please enter your city or area.")
        .max(150, "Location must be 150 characters or fewer."),

    yearsExperience: z
        .string()
        .trim()
        .refine(
            (value) => value === "" || /^\d+$/.test(value),
            "Enter years of experience as a whole number.",
        ),

    trainingFormat: z
        .enum(["Online", "In-person", "Both"])
        .or(z.literal("")),
});

export type TrainerProfileFormValues = z.infer<typeof trainerProfileSchema>;
