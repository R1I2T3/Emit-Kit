import { GoogleGenerativeAI } from "@google/generative-ai";

export async function enrichOperationDocs(
  operation: any,
  apiKey: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Generate documentation for the following API operation.

Operation: ${operation.method} ${operation.path}
Summary: ${operation.summary || ""}
Description: ${operation.description || ""}

Parameters:
${JSON.stringify(operation.parameters, null, 2)}

Write:
1. A clear 2-3 sentence description
2. A curl usage example
3. A TypeScript usage example
4. A Python usage example
5. Common errors and handling

Respond with markdown only. No preamble.`;

  const result = (await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout")), 15000)
    ),
  ])) as any;

  return result.response.text();
}
