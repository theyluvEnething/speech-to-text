/**
 * Fixed transcription prompts used as the Whisper `prompt` parameter.
 *
 * Each prompt is in the target language (research confirmed: the prompt MUST
 * match the audio language, or the model may switch languages).
 *
 * Prompts are kept under 100 tokens. For older Whisper models (whisper-1,
 * whisper-large-v3, whisper-large-v3-turbo), the prompt acts as keyword
 * biasing and style continuation (last 224 tokens only). For newer models
 * (gpt-4o-transcribe), the prompt is treated as free-text instructions.
 *
 * Newlines are avoided — Groq's Whisper API has a known issue where prompts
 * containing newlines can trigger HTTP 500 errors.
 *
 * These prompts cannot be changed by the user — they are hardcoded per
 * language. For user-customizable text processing, see the after-processing
 * prompt on each Profile.
 */

export const TRANSCRIPTION_PROMPTS: Record<string, string> = {
  en: [
    "Transcribe exactly what is spoken. Convert spoken punctuation:",
    'period→. comma→, question mark→? exclamation mark→! colon→: semicolon→;',
    'dash→- slash→/ "new line"→line break. Normalize numbers and units:',
    '"ten milligrams"→10 mg, "one twenty over eighty"→120/80.',
    "Remove filler words like um, uh. Use [inaudible] if unclear.",
    "Spell proper nouns and technical terms correctly.",
    "Terms: hemoglobin A1c, creatinine, metformin, amlodipine.",
  ].join(" "),

  de: [
    "Transkribiere genau, was gesprochen wird. Wandle gesprochene Satzzeichen um:",
    'Punkt→. Komma→, Fragezeichen→? Ausrufezeichen→! Doppelpunkt→: Semikolon→;',
    'Bindestrich→- Schrägstrich→/ "neue Zeile"→Zeilenumbruch.',
    "Normalisiere Zahlen und Einheiten:",
    '"zehn Milligramm"→10 mg, "eins zwanzig über achtzig"→120/80.',
    "Entferne Füllwörter wie ähm, ehm. Bei Unklarheit [unverständlich].",
    "Eigennamen und Fachbegriffe korrekt schreiben.",
    "Begriffe: Hämoglobin A1c, Kreatinin, Metformin, Amlodipin.",
  ].join(" "),

  it: [
    "Trascrivi esattamente ciò che viene detto. Converti la punteggiatura parlata:",
    'punto→. virgola→, punto interrogativo→? punto esclamativo→! due punti→: punto e virgola→;',
    'trattino→- barra→/ "nuova riga"→interruzione di riga.',
    "Normalizza numeri e unità:",
    '"dieci milligrammi"→10 mg, "uno venti su ottanta"→120/80.',
    "Rimuovi parole di riempimento come um, ehm. Usa [incomprensibile] se poco chiaro.",
    "Nomi propri e termini tecnici scritti correttamente.",
    "Termini: emoglobina A1c, creatinina, metformina, amlodipina.",
  ].join(" "),

  es: [
    "Transcribe exactamente lo que se dice. Convierte la puntuación hablada:",
    'punto→. coma→, signo de interrogación→? signo de exclamación→! dos puntos→: punto y coma→;',
    'guión→- barra→/ "nueva línea"→salto de línea.',
    "Normaliza números y unidades:",
    '"diez miligramos"→10 mg, "ciento veinte sobre ochenta"→120/80.',
    "Elimina muletillas como um, eh. Usa [inaudible] si no está claro.",
    "Nombres propios y términos técnicos escritos correctamente.",
    "Términos: hemoglobina A1c, creatinina, metformina, amlodipina.",
  ].join(" "),

  ja: [
    "話された内容を正確に文字起こししてください。句読点の変換：",
    'ピリオド→. コンマ→, 疑問符→? 感嘆符→! コロン→: セミコロン→;',
    'ダッシュ→- スラッシュ→/ 「改行」→改行。',
    "数字と単位を正規化：",
    '「10ミリグラム」→10 mg、「120 over 80」→120/80。',
    "「えーと」「あのー」などのフィラーを削除。不明瞭な場合は[聞き取れず]。",
    "固有名詞と専門用語を正しく表記。",
    "用語：ヘモグロビンA1c、クレアチニン、メトホルミン、アムロジピン。",
  ].join(" "),

  fr: [
    "Transcrivez exactement ce qui est dit. Convertissez la ponctuation parlée :",
    'point→. virgule→, point d\'interrogation→? point d\'exclamation→! deux-points→: point-virgule→;',
    'tiret→- barre oblique→/ "nouvelle ligne"→saut de ligne.',
    "Normalisez les nombres et les unités :",
    '"dix milligrammes"→10 mg, "cent vingt sur quatre-vingts"→120/80.',
    "Supprimez les mots de remplissage comme euh, hum. Utilisez [inaudible] si peu clair.",
    "Noms propres et termes techniques correctement orthographiés.",
    "Termes : hémoglobine A1c, créatinine, metformine, amlodipine.",
  ].join(" "),

  ko: [
    "말한 내용을 정확히 받아쓰세요. 구두점 변환:",
    '마침표→. 쉼표→, 물음표→? 느낌표→! 콜론→: 세미콜론→;',
    '대시→- 슬래시→/ "새 줄"→줄 바꿈.',
    "숫자와 단위 정규화:",
    '"10밀리그램"→10 mg, "120 over 80"→120/80.',
    "음, 어 같은 채우기 단어 제거. 불분명하면 [들리지 않음].",
    "고유명사와 전문용어 올바르게 표기.",
    "용어: 헤모글로빈 A1c, 크레아티닌, 메트포르민, 암로디핀.",
  ].join(" "),

  zh: [
    "准确转录说话内容。标点符号转换：",
    '句号→. 逗号→, 问号→? 感叹号→! 冒号→: 分号→;',
    '破折号→- 斜杠→/ "换行"→换行。',
    "数字和单位规范化：",
    '"10毫克"→10 mg，"120/80"→120/80。',
    "删除嗯、啊等填充词。不清晰时用[听不清]。",
    "专有名词和技术术语正确拼写。",
    "术语：血红蛋白A1c、肌酐、二甲双胍、氨氯地平。",
  ].join(" "),

  auto: [
    "Transcribe exactly what is spoken in the speaker's language.",
    "Convert spoken punctuation to symbols: period→. comma→, question",
    "mark→? exclamation→! colon→: semicolon→; dash→- slash→/.",
    'Convert "new line" to a line break. Normalize numbers and units:',
    '"ten milligrams"→10 mg. Remove filler words like um, uh.',
    "Use [inaudible] if unclear. Spell proper nouns correctly.",
  ].join(" "),
};

/**
 * Returns the transcription prompt for a given language code.
 * Falls back to the "auto" (English) prompt for unsupported languages.
 */
export function getTranscriptionPrompt(language: string): string {
  return TRANSCRIPTION_PROMPTS[language] ?? TRANSCRIPTION_PROMPTS["auto"]!;
}
