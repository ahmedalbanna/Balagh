import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function classifyReport(description: string, voiceBase64?: string, imageBase64?: string) {
  const parts: any[] = [];
  
  let prompt = `
    You are an AI reporting assistant for a city service app called "Ballagh" (بلغ).
    Analyze the following report and categorize it.
    
    Categories: "pothole", "garbage", "sewage", "lighting", "other".
    Priority: "low", "medium", "high", "critical".

    User Description: "${description}"
  `;

  parts.push({ text: prompt });

  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageBase64
      }
    });
  }

  // Voice analysis is harder with plain Gemini if it's just raw audio bytes, 
  // but if we have the text from speech-to-text on the client, it's better.
  // For now, let's assume we pass the transcription from the client or 
  // if not possible, just use the description and image.

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          category: { type: "string" },
          priority: { type: "string" },
          summary: { type: "string", description: "A concise summary of the issue." }
        },
        required: ["category", "priority", "summary"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
