
import { GoogleGenAI, Type } from "@google/genai";

// Standard safety check for process.env which can cause Script Error in some browser environments
const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : (window as any).process?.env?.API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export async function parseTaskWithAI(input: string) {
  if (!apiKey) {
    console.error("Gemini API Key is missing");
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Разбери задачу: "${input}". Текущая дата: ${today}.`,
      config: {
        systemInstruction: "Ты помощник по управлению задачами. Извлеки детали задачи из ввода пользователя на русском языке. Всегда возвращай валидный JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            date: { type: Type.STRING, description: "Дата в формате ГГГГ-ММ-ДД" },
            status: { type: Type.STRING, enum: ["todo", "in-progress", "done"] }
          },
          required: ["title", "date", "status"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (e) {
    console.error("Ошибка парсинга AI", e);
    return null;
  }
}
