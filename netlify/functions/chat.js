const OpenAI = require("openai");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body || "{}");
    const { messages } = body;

    if (!Array.isArray(messages)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing messages[]" }),
      };
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // OpenAI Responses API :contentReference[oaicite:2]{index=2}
    const resp = await client.responses.create({
      model: "gpt-5.2",
      input: messages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: resp.output_text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err?.message || "Server error" }),
    };
  }
};
headers: {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://lebronjebus.github.io",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}
