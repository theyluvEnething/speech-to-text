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
      "Turn the user's rough, spoken request into a single high-quality prompt",
      "for an AI assistant that will carry out the task. State precisely what the",
      "user wants done, including the concrete goal, the specific requirements and",
      "constraints, any relevant context, and what a correct result looks like.",
      "Be exact and unambiguous — replace vague wording with concrete detail, but",
      "never invent requirements the user did not state. ALWAYS end the prompt",
      "with an instruction telling the assistant that, if the request is vague or",
      "any detail needed to implement it fully is missing, it must first ask the",
      "user targeted clarifying questions instead of guessing or assuming.",
      "Write the prompt as plain, direct prose. Output ONLY the prompt text —",
      "no Markdown, no headings, no bold or asterisks, no bullet points, no",
      'labels such as "Prompt:", and no surrounding quotes.',
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
