// ============================================
// api/send-order.js — Vercel Serverless Function
// Client base64 PDF + metadata bhejta hai (JSON)
// Server Telegram ko forward karta hai — token hidden
// ============================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID   = process.env.CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: "Server config missing — environment variables set nahi hain" });
  }

  let body;
  try {
    body = req.body;
    if (!body || !body.fileBase64 || !body.fileName || !body.caption) {
      return res.status(400).json({ error: "fileBase64, fileName, caption required" });
    }
  } catch(e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // Base64 → Buffer → Blob
  const fileBuffer = Buffer.from(body.fileBase64, "base64");

  const { FormData, Blob } = await import("node:buffer").catch(() => ({}));

  // Use native fetch (Node 18+)
  const formData = new (globalThis.FormData || (await import("formdata-node")).FormData)();
  const fileBlob = new Blob([fileBuffer], { type: "application/pdf" });

  formData.append("chat_id", CHAT_ID);
  formData.append("document", fileBlob, body.fileName);
  formData.append("caption", body.caption);
  formData.append("reply_markup", JSON.stringify({
    inline_keyboard: [[
      { text: "🖨 PRINT", callback_data: "print" },
      { text: "❌ REJECT", callback_data: "reject" }
    ]]
  }));

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`,
      { method: "POST", body: formData }
    );
    const data = await tgRes.json();
    return res.status(tgRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
