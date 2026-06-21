/**
 * Transcription prompts passed as the Whisper `prompt` parameter.
 *
 * IMPORTANT — how Whisper uses this (whisper-large-v3 on Groq): the prompt is
 * NOT an instruction channel. The model mimics the prompt's STYLE and biases
 * toward its VOCABULARY; it does not follow commands. Only the last ~224 tokens
 * are used, and later tokens weigh more — so the highest-value vocabulary goes
 * at the END. (See OpenAI's Whisper prompting guide.)
 *
 * Newlines are avoided — Groq's Whisper API can return HTTP 500 on prompts that
 * contain newlines.
 *
 * Two variants per language:
 *   - GENERAL_PROMPTS: content-neutral style primer (default).
 *   - MEDICAL_PROMPTS: the general primer plus a rich medical vocabulary block
 *     at the end, biasing recognition of drug/lab/abbreviation spellings.
 *
 * `auto` and unknown languages fall back to English.
 */

export const GENERAL_PROMPTS: Record<string, string> = {
  en: [
    "Transcribe exactly what is spoken. Convert spoken punctuation:",
    'period→. comma→, question mark→? exclamation mark→! colon→: semicolon→;',
    'dash→- slash→/ "new line"→line break. Normalize numbers and units:',
    '"ten milligrams"→10 mg, "twenty-five percent"→25%.',
    "Remove filler words like um, uh. Use [inaudible] if unclear.",
    "Spell proper nouns and technical terms correctly.",
  ].join(" "),

  de: [
    "Transkribiere genau, was gesprochen wird. Wandle gesprochene Satzzeichen um:",
    'Punkt→. Komma→, Fragezeichen→? Ausrufezeichen→! Doppelpunkt→: Semikolon→;',
    'Bindestrich→- Schrägstrich→/ "neue Zeile"→Zeilenumbruch.',
    "Normalisiere Zahlen und Einheiten:",
    '"zehn Milligramm"→10 mg, "fünfundzwanzig Prozent"→25%.',
    "Entferne Füllwörter wie ähm, ehm. Bei Unklarheit [unverständlich].",
    "Eigennamen und Fachbegriffe korrekt schreiben.",
  ].join(" "),

  it: [
    "Trascrivi esattamente ciò che viene detto. Converti la punteggiatura parlata:",
    'punto→. virgola→, punto interrogativo→? punto esclamativo→! due punti→: punto e virgola→;',
    'trattino→- barra→/ "nuova riga"→interruzione di riga.',
    "Normalizza numeri e unità:",
    '"dieci milligrammi"→10 mg, "venticinque percento"→25%.',
    "Rimuovi parole di riempimento come um, ehm. Usa [incomprensibile] se poco chiaro.",
    "Nomi propri e termini tecnici scritti correttamente.",
  ].join(" "),

  es: [
    "Transcribe exactamente lo que se dice. Convierte la puntuación hablada:",
    'punto→. coma→, signo de interrogación→? signo de exclamación→! dos puntos→: punto y coma→;',
    'guión→- barra→/ "nueva línea"→salto de línea.',
    "Normaliza números y unidades:",
    '"diez miligramos"→10 mg, "veinticinco por ciento"→25%.',
    "Elimina muletillas como um, eh. Usa [inaudible] si no está claro.",
    "Nombres propios y términos técnicos escritos correctamente.",
  ].join(" "),

  ja: [
    "話された内容を正確に文字起こししてください。句読点の変換：",
    'ピリオド→. コンマ→, 疑問符→? 感嘆符→! コロン→: セミコロン→;',
    'ダッシュ→- スラッシュ→/ 「改行」→改行。',
    "数字と単位を正規化：",
    '「10ミリグラム」→10 mg、「25パーセント」→25%。',
    "「えーと」「あのー」などのフィラーを削除。不明瞭な場合は[聞き取れず]。",
    "固有名詞と専門用語を正しく表記。",
  ].join(" "),

  fr: [
    "Transcrivez exactement ce qui est dit. Convertissez la ponctuation parlée :",
    'point→. virgule→, point d\'interrogation→? point d\'exclamation→! deux-points→: point-virgule→;',
    'tiret→- barre oblique→/ "nouvelle ligne"→saut de ligne.',
    "Normalisez les nombres et les unités :",
    '"dix milligrammes"→10 mg, "vingt-cinq pour cent"→25%.',
    "Supprimez les mots de remplissage comme euh, hum. Utilisez [inaudible] si peu clair.",
    "Noms propres et termes techniques correctement orthographiés.",
  ].join(" "),

  ko: [
    "말한 내용을 정확히 받아쓰세요. 구두점 변환:",
    '마침표→. 쉼표→, 물음표→? 느낌표→! 콜론→: 세미콜론→;',
    '대시→- 슬래시→/ "새 줄"→줄 바꿈.',
    "숫자와 단위 정규화:",
    '"10밀리그램"→10 mg, "25퍼센트"→25%.',
    "음, 어 같은 채우기 단어 제거. 불분명하면 [들리지 않음].",
    "고유명사와 전문용어 올바르게 표기.",
  ].join(" "),

  zh: [
    "准确转录说话内容。标点符号转换：",
    '句号→. 逗号→, 问号→? 感叹号→! 冒号→: 分号→;',
    '破折号→- 斜杠→/ "换行"→换行。',
    "数字和单位规范化：",
    '"10毫克"→10 mg，"25%"→25%。',
    "删除嗯、啊等填充词。不清晰时用[听不清]。",
    "专有名词和技术术语正确拼写。",
  ].join(" "),
};

/**
 * Rich medical vocabulary, appended to the END of the general primer (the
 * highest-weight position) to bias recognition of clinical spellings. Kept on
 * a single line (no newlines) and well under the 224-token window.
 */
const MEDICAL_TERM_HINTS = [
  "Term hints — drugs: metformin, amlodipine, clopidogrel, levothyroxine,",
  "amoxicillin, azithromycin, ceftriaxone, vancomycin, insulin glargine;",
  "labs: hemoglobin A1c, creatinine, eGFR, troponin, D-dimer, BNP, CRP, ESR;",
  "abbreviations: BP, HR, RR, SpO2, WBC, Hgb, Hct, MCV, Plt, Na, K, Cr, BUN,",
  "AST, ALT, ALP, INR, PT, PTT; units: mg, mcg, g, mL, L, mmHg, bpm.",
].join(" ");

export const MEDICAL_PROMPTS: Record<string, string> = Object.fromEntries(
  Object.entries(GENERAL_PROMPTS).map(([lang, primer]) => [
    lang,
    `${primer} ${MEDICAL_TERM_HINTS}`,
  ]),
);

export type TranscriptionVariant = "general" | "medical";

/**
 * Returns the transcription prompt for a language + variant. `auto` and
 * unknown languages fall back to English.
 */
export function getTranscriptionPrompt(
  language: string,
  variant: TranscriptionVariant = "general",
): string {
  const set = variant === "medical" ? MEDICAL_PROMPTS : GENERAL_PROMPTS;
  return set[language] ?? set["en"]!;
}
