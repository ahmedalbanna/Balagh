import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function classifyReport(description: string, voiceBase64?: string, imageBase64?: string) {
  const parts: any[] = [];
  
  let prompt = `
    You are an AI reporting assistant for a city service app called "Ballagh" (بلغ) specifically formulated for Yemeni citizens.
    Analyze the following report and categorize it. The user might use Yemeni dialects.
    
    If audio is provided, listen to the audio carefully. The text description might be empty or a rough transcription.
    
    Categories: "pothole" (حفر), "garbage" (قمامة/مخلفات), "sewage" (صرف صحي/مجاري), "lighting" (إنارة/كهرباء), "other" (أخرى).
    Priority guidelines:
    - "critical": Imminent danger to life/property (e.g., open deep manhole, sparking exposed wires, severe flooding).
    - "high": Major inconvenience or spreading hazard (e.g., huge garbage pile blocking road, large deep pothole crashing cars).
    - "medium": Standard service issue (e.g., street light out, moderate garbage).
    - "low": Minor issue.

    User Description Text: "${description}"
  `;

  parts.push({ text: prompt });

  if (imageBase64) {
    const mimeType = imageBase64.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    const data = imageBase64.split(",")[1] || imageBase64;
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: data
      }
    });
  }

  if (voiceBase64) {
    const data = voiceBase64.split(",")[1] || voiceBase64;
    parts.push({
      inlineData: {
        mimeType: "audio/webm", // assuming webm for web audio captures
        data: data
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // Use pro for audio/multimodal
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          category: { type: "string" },
          priority: { type: "string" },
          summary: { type: "string", description: "A concise summary of the issue in formal Arabic." },
          transcription: { type: "string", description: "The full transcription of the audio input in Arabic." },
          extractedLocation: { type: "string", description: "Any specific street or neighborhood mentioned in the report." }
        },
        required: ["category", "priority", "summary", "transcription"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
