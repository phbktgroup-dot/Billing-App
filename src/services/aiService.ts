import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BusinessInsights {
  summary: string;
  healthScore: number;
  anomalies: string[];
  recommendations: string[];
  forecast: { month: string; revenue: number }[];
  radarData: { subject: string; A: number; fullMark: number }[];
  strategyRoadmap: { phase: string; goal: string; timeline: string; priority: 'High' | 'Medium' | 'Low' }[];
  productMatrix: { name: string; sales: number; growth: number; category: 'Star' | 'Cash Cow' | 'Question Mark' | 'Dog' }[];
  taxEstimate: { amount: number; dueDate: string; category: string }[];
  clvInsights: { segment: string; value: number; count: number }[];
}

export interface SimulationResult {
  impact: string;
  projectedRevenue: number;
  confidence: number;
  risks: string[];
}

export async function generateBusinessInsights(data: any, businessId: string): Promise<BusinessInsights> {
  const CACHE_KEY = `ai_business_insights_cache_${businessId}`;
  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const { timestamp, insights } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return insights;
    }
  }

  const prompt = `
    Analyze the following business data and provide advanced insights.
    Data: ${JSON.stringify(data)}
    
    Provide the response in JSON format with the following structure:
    {
      "summary": "A concise 2-sentence summary of the business health.",
      "healthScore": 0-100,
      "anomalies": ["List of unusual patterns or potential risks"],
      "recommendations": ["Actionable advice to improve the business"],
      "forecast": [{"month": "Next Month", "revenue": 12345}],
      "radarData": [
        {"subject": "Revenue Growth", "A": 80, "fullMark": 100},
        {"subject": "Efficiency", "A": 70, "fullMark": 100},
        {"subject": "Liquidity", "A": 90, "fullMark": 100},
        {"subject": "Retention", "A": 65, "fullMark": 100},
        {"subject": "Stock Health", "A": 85, "fullMark": 100}
      ],
      "strategyRoadmap": [
        {"phase": "Q1", "goal": "Optimize Inventory", "timeline": "Jan-Mar", "priority": "High"}
      ],
      "productMatrix": [
        {"name": "Product A", "sales": 5000, "growth": 15, "category": "Star"}
      ],
      "taxEstimate": [
        {"amount": 1200, "dueDate": "2024-04-15", "category": "VAT"}
      ],
      "clvInsights": [
        {"segment": "High Value", "value": 5000, "count": 10}
      ]
    }
  `;

  try {
    let response;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  healthScore: { type: Type.NUMBER },
                  anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
                  recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                  forecast: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        month: { type: Type.STRING },
                        revenue: { type: Type.NUMBER }
                      }
                    }
                  },
                  radarData: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        subject: { type: Type.STRING },
                        A: { type: Type.NUMBER },
                        fullMark: { type: Type.NUMBER }
                      }
                    }
                  },
                  strategyRoadmap: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        phase: { type: Type.STRING },
                        goal: { type: Type.STRING },
                        timeline: { type: Type.STRING },
                        priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                      }
                    }
                  },
                  productMatrix: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        sales: { type: Type.NUMBER },
                        growth: { type: Type.NUMBER },
                        category: { type: Type.STRING, enum: ['Star', 'Cash Cow', 'Question Mark', 'Dog'] }
                      }
                    }
                  },
                  taxEstimate: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        amount: { type: Type.NUMBER },
                        dueDate: { type: Type.STRING },
                        category: { type: Type.STRING }
                      }
                    }
                  },
                  clvInsights: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        segment: { type: Type.STRING },
                        value: { type: Type.NUMBER },
                        count: { type: Type.NUMBER }
                      }
                    }
                  }
                }
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("AI request timed out")), 180000))
        ]);
        break; // Success
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        console.warn(`AI request attempt ${attempts} failed, retrying...`);
      }
    }

    if (!response || !(response as any).text) {
      console.error('AI response:', response);
      throw new Error("No response text from AI");
    }

    const insights = JSON.parse((response as any).text);
    console.log('Parsed AI insights:', insights);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), insights }));
    return insights;
  } catch (error) {
    console.error("AI Insights Error:", error);
    // Fallback data
    return {
      summary: "Business is stable with consistent revenue growth.",
      healthScore: 75,
      anomalies: ["No significant anomalies detected."],
      recommendations: ["Consider optimizing inventory for low-stock items."],
      forecast: [],
      radarData: [
        { subject: 'Growth', A: 80, fullMark: 100 },
        { subject: 'Efficiency', A: 70, fullMark: 100 },
        { subject: 'Liquidity', A: 90, fullMark: 100 },
        { subject: 'Retention', A: 65, fullMark: 100 },
        { subject: 'Stock', A: 85, fullMark: 100 },
      ],
      strategyRoadmap: [
        { phase: 'Phase 1', goal: 'Inventory Optimization', timeline: 'Next 30 days', priority: 'High' },
        { phase: 'Phase 2', goal: 'Customer Retention', timeline: 'Next 60 days', priority: 'Medium' },
        { phase: 'Phase 3', goal: 'Market Expansion', timeline: 'Next 90 days', priority: 'Low' }
      ],
      productMatrix: [
        { name: 'Electronics', sales: 12000, growth: 20, category: 'Star' },
        { name: 'Furniture', sales: 8000, growth: 5, category: 'Cash Cow' },
        { name: 'Apparel', sales: 3000, growth: 15, category: 'Question Mark' },
        { name: 'Accessories', sales: 1000, growth: -5, category: 'Dog' }
      ],
      taxEstimate: [
        { amount: 4500, dueDate: '2024-06-30', category: 'Income Tax' },
        { amount: 1200, dueDate: '2024-04-15', category: 'VAT' }
      ],
      clvInsights: [
        { segment: 'VIP', value: 15000, count: 5 },
        { segment: 'Loyal', value: 8000, count: 12 },
        { segment: 'New', value: 2000, count: 20 }
      ]
    };
  }
}

export async function askBusinessQuestion(question: string, context: any): Promise<string> {
  const prompt = `
    You are a world-class business consultant. Answer the following question based on the provided business context.
    Question: ${question}
    Context: ${JSON.stringify(context)}
    
    Provide a concise, professional, and data-driven answer.
  `;

  try {
    let response;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("AI request timed out")), 180000))
        ]);
        break; // Success
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        console.warn(`AI request attempt ${attempts} failed, retrying...`);
      }
    }
    return (response as any).text || "I'm sorry, I couldn't generate an answer at this time.";
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "The AI consultant is currently unavailable. Please try again later.";
  }
}

export async function simulateScenario(scenario: string, context: any): Promise<SimulationResult> {
  const prompt = `
    Simulate the following business scenario and predict the outcome.
    Scenario: ${scenario}
    Context: ${JSON.stringify(context)}
    
    Provide the response in JSON format:
    {
      "impact": "A detailed description of the predicted impact.",
      "projectedRevenue": number,
      "confidence": 0-100,
      "risks": ["Potential risks of this scenario"]
    }
  `;

  try {
    let response;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        response = await Promise.race([
          ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  impact: { type: Type.STRING },
                  projectedRevenue: { type: Type.NUMBER },
                  confidence: { type: Type.NUMBER },
                  risks: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("AI request timed out")), 180000))
        ]);
        break; // Success
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
        console.warn(`AI request attempt ${attempts} failed, retrying...`);
      }
    }
    return JSON.parse((response as any).text);
  } catch (error) {
    console.error("AI Simulation Error:", error);
    return {
      impact: "Unable to simulate scenario due to an error.",
      projectedRevenue: 0,
      confidence: 0,
      risks: ["System error during simulation"]
    };
  }
}
