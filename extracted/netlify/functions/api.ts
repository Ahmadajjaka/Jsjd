import { Groq } from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';

export default async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Enable CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 1. Status Check
  if (pathname.endsWith('/status') || pathname.includes('/status')) {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    return new Response(
      JSON.stringify({
        status: 'online',
        platform: 'netlify-serverless',
        groqAvailable: !!groqKey,
        geminiAvailable: !!geminiKey,
        primaryProvider: groqKey ? 'groq' : geminiKey ? 'gemini' : 'client-engine',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  // 2. Chat Endpoint
  if (pathname.endsWith('/chat') || pathname.includes('/chat')) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const body = await req.json();
      const { messages = [], storeContext = null } = body;

      const systemInstruction = `أنت «المستشار الذكي والمنفّذ الآلي لخردوات المامو» — خبير مالي ومحاسبي وإداري متخصص في إدارة متاجر الخردوات ومواد البناء، ولديك صلاحية تنفيذ أي تغيير في التطبيق مباشرة.
عند طلب إضافة مادة، تسجيل مصروف، إضافة زبون، تعديل مخزون، أو كشف حساب، قم دائماً بتوليد كتلة json:action المقابلة في نهاية ردك:
\`\`\`json:action
{
  "action": "add_product",
  "title": "إدراج مادة جديدة",
  "data": { ... }
}
\`\`\`
${storeContext ? `مؤشرات المتجر اللحظية:\n${JSON.stringify(storeContext, null, 2)}` : ''}`;

      const groqKey = process.env.GROQ_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;

      // Stream SSE response
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const sendChunk = (text: string) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
          };

          try {
            if (groqKey) {
              const groq = new Groq({ apiKey: groqKey });
              const groqMessages = [
                { role: 'system' as const, content: systemInstruction },
                ...messages.map((m: any) => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                })),
              ];

              const chatStream = await groq.chat.completions.create({
                model: 'qwen/qwen3.8-27b',
                messages: groqMessages,
                stream: true,
                temperature: 0.4,
              });

              for await (const chunk of chatStream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) sendChunk(content);
              }
            } else if (geminiKey) {
              const gemini = new GoogleGenAI({ apiKey: geminiKey });
              const conversation = messages
                .map((m: any) => `${m.role === 'user' ? 'المستخدم' : 'المستشار'}: ${m.content}`)
                .join('\n');

              const response = await gemini.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: `${systemInstruction}\n\nسياق المحادثة:\n${conversation}`,
              });

              for await (const chunk of response) {
                const text = chunk.text;
                if (text) sendChunk(text);
              }
            } else {
              // Direct deterministic fallback response
              const lastMsg = messages[messages.length - 1]?.content || '';
              sendChunk(`أهلاً بك في نظام خردوات المامو. تم استلام طلبك («${lastMsg}») والعمل جاري عبر المحرك الذكي المباشر.`);
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: err.message || 'Error occurred' })}\n\n`)
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          ...corsHeaders,
        },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  return new Response(JSON.stringify({ message: 'Al-Mamo Accounting API - Netlify Edition' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
};
