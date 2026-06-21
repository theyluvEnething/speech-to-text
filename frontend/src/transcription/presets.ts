/**
 * Built-in transformation presets. Each `instruction` seeds a profile's
 * editable post-processing instruction; the user can tweak it afterward.
 */
export interface Preset {
  id: string;
  label: string;
  instruction: string;
}

export const PRESETS: Preset[] = [
  {
    id: "ai-prompt",
    label: "AI Prompt",
    instruction: [
      "Rewrite the user's rough, spoken description into a clear, well-structured",
      "prompt for an AI assistant. Include an explicit objective, the key",
      "requirements and constraints, and definitions for any vague terms.",
      "Keep the user's intent exactly; do not invent features they did not ask",
      "for. Output only the finished prompt.",
    ].join(" "),
  },
  {
    id: "email",
    label: "Email",
    instruction: [
      "Turn the user's dictation into a polished email.",
      "Start with a greeting on its own line: if the user named a recipient, use",
      '"Dear <name>,"; otherwise use "Dear [Name]," as a fillable placeholder.',
      'Follow with a brief courtesy line such as "I hope you are well." Then the',
      "body conveying the user's message, and a suitable sign-off.",
      'If the user asks for a specific language (e.g. "write this in German"),',
      "write the ENTIRE email in that language and do not include that request",
      "in the output. Output only the email.",
    ].join(" "),
  },
  {
    id: "notes",
    label: "Notes",
    instruction: [
      "Reorganize the user's rambling dictation into clean, structured notes:",
      "concise bullet points grouped logically, with a short heading if helpful.",
      "Preserve all facts and intent; remove filler and repetition.",
      "Output only the notes.",
    ].join(" "),
  },
];

/** Returns the preset with the given id, or undefined. */
export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
