import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";

const app = express();
app.use(cors());
// Remove or comment out express.json() and express.urlencoded() since multer will handle form-data
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

const upload = multer(); // memory storage by default, files will be buffers

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables");
  process.exit(1);
}

app.post("/api/telegram", upload.single("photo"), async (req, res) => {
  try {
    // req.body fields
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
    const formattedDateTime = now.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).replace(', ', ' ');

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

    const message = messageLines.join('\n');

    // If photo uploaded, send photo with caption
    if (req.file) {
      // req.file.buffer contains the image data

      // Send multipart/form-data with form-data package to Telegram API
      import FormData from "form-data"; // make sure installed

      const form = new FormData();
      form.append("chat_id", TELEGRAM_CHAT_ID);
      form.append("caption", message);
      form.append("parse_mode", "HTML");
      form.append("photo", req.file.buffer, {
        filename: req.file.originalname || "photo.jpg",
        contentType: req.file.mimetype || "image/jpeg",
      });

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
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
          message: "Failed to send photo message to Telegram.",
          details: errorText,
        });
      }

      return res.json({ status: "success", message: "✅ Request with photo sent successfully! We will contact you soon." });
    }

    // If no photo, send normal text message
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

    res.json({ status: "success", message: "✅ Request sent successfully! We will contact you soon." });
  } catch (error) {
    console.error("Internal server error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error. Please try again later.",
      details: error.message,
    });
  }
});
