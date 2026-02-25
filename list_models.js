import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

// Try to get API key from .env or similar
const apiKey = process.env.VITE_API_KEY || ""; 

const ai = new GoogleGenAI({ apiKey });

async function list() {
  try {
    const models = await ai.models.list();
    console.log(JSON.stringify(models, null, 2));
  } catch (err) {
    console.error(err);
  }
}

list();
