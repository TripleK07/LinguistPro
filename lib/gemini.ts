
import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function lookupWord(word: string, targetLanguage: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Look up the English word "${word}" and translate it to ${targetLanguage}. 
    Provide phonetics (IPA), a clear definition, 3 usage examples, and 5 synonyms.
    IMPORTANT: For each example, provide both the original English sentence and its translation in ${targetLanguage}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetics: { type: Type.STRING },
          translation: { type: Type.STRING },
          definition: { type: Type.STRING },
          examples: {
            type: Type.ARRAY,
            items: { 
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                translated: { type: Type.STRING }
              },
              required: ["original", "translated"]
            }
          },
          synonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["word", "phonetics", "translation", "definition", "examples", "synonyms"]
      }
    }
  });

  return JSON.parse(response.text) as any;
}

export async function transcribeAudio(base64Audio: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Audio,
        },
      },
      { text: "Transcribe the spoken audio into a single English word for a dictionary search. Output ONLY the word, nothing else. If multiple words are spoken, output the most likely single search term." },
    ],
  });

  return response.text?.trim() || "";
}

export async function generateSpeech(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Pronounce clearly: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data received");
  return base64Audio;
}

// Audio Utils
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
