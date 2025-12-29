const OpenAI = require("openai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const { messages } = body;
    if (!Array.isArray(messages)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing messages[]" }),
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "OPENAI_API_KEY is not set in Netlify env vars" }),
      };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const resp = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: messages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: String(m.content ?? "") }],
      })),
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: resp.output_text || "" }),
    };
  } catch (err) {
    // Always return JSON, never empty
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: err?.message || "Server error",
        // helpful for debugging:
        name: err?.name || null,
      }),
    };
  }
};
