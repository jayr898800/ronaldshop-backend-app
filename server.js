import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import FormData from "form-data";

const app = express();
app.use(cors());

const upload = multer(); // Memory storage

// ===== Visitor Counter =====
let visitorCount = 0;

app.get("/api/visitors", (req, res) => {
  visitorCount++;
  res.json({ count: visitorCount });
});
// ===========================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables");
  process.exit(1);
}

app.post("/api/telegram", upload.array("photos", 10), async (req, res) => {
  console.log("Received files:", req.files);

  try {
    const {
      name = "Not specified",
      contact = "Not specified",
      status = "Not specified",
      unit = "",
      otherUnit = "",
      location = "Not specified",
      issue = "Not specified",
    } = req.body;

    const now = new Date();
    const formattedDateTime = now.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).replace(", ", " ");

    const unitValue = unit === "Other..." ? (otherUnit.trim() || "Not specified") : (unit.trim() || "Not specified");

    const messageLines = [
      `🛠️Job Order Request (${formattedDateTime})`,
      ``,
      `👤 Name: ${name.trim() || "Not specified"}`,
      `📞 Contact Number: ${contact.trim() || "Not specified"}`,
      `📝 Status: ${status.trim() || "Not specified"}`,
      `📺 Unit: ${unitValue}`,
      `📍 Location: ${location.trim() || "Not specified"}`,
      `⚠️ Issue: ${issue.trim() || "Not specified"}`,
    ];

    const message = messageLines.join("\n");

    if (req.files && req.files.length > 0) {
      const form = new FormData();
      form.append("chat_id", TELEGRAM_CHAT_ID);

      const mediaArray = req.files.map((file, index) => ({
        type: "photo",
        media: `attach://photo${index}`,
        caption: index === 0 ? message : "",
        parse_mode: "HTML",
      }));

      form.append("media", JSON.stringify(mediaArray));

      req.files.forEach((file, index) => {
        form.append(`photo${index}`, file.buffer, {
          filename: file.originalname || `photo${index}.jpg`,
          contentType: file.mimetype || "image/jpeg",
        });
      });

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
        {
          method: "POST",
          body: form,
          headers: form.getHeaders(),
        }
      );

      if (!telegramResponse.ok) {
        const errorText = await telegramResponse.text();
        console.error("Telegram API error:", errorText);
        return res.status(telegramResponse.status).json({
          status: "error",
          message: "Failed to send photo messages to Telegram.",
          details: errorText,
        });
      }

      return res.json({ status: "success", message: "📞 We will contact you soon." });
    }

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      console.error("Telegram API error:", errorText);
      return res.status(telegramResponse.status).json({
        status: "error",
        message: "Failed to send message to Telegram.",
        details: errorText,
      });
    }

    res.json({ status: "success", message: "📞 We will contact you soon." });

  } catch (error) {
    console.error("Internal server error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error. Please try again later.",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
