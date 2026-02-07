import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize only if key exists to avoid immediate errors, handle gracefully in call
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const generateLyricSuggestion = async (
  contextLines: string[],
  genre: string = 'Pop',
  mood: string = 'Emotional'
): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key missing");
    return "Please configure API_KEY to use AI features.";
  }

  try {
    const model = ai.models;
    const prompt = `
      I am writing a song cover. The genre is ${genre} and the mood is ${mood}.
      Here are the previous lines:
      "${contextLines.join('\n')}"

      Suggest one single next line that rhymes or flows well with the previous context.
      Return ONLY the lyric text, nothing else.
    `;

    const response = await model.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating suggestion.";
  }
};
