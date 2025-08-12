import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // increased limit for big base64 images
app.use(express.urlencoded({ extended: true }));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables");
  process.exit(1);
}

app.post("/api/telegram", async (req, res) => {
  try {
    const {
      name = "Not specified",
      contact = "Not specified",
      status = "Not specified",
      unit = "",
      otherUnit = "",
      location = "Not specified",
      issue = "Not specified",
      imageUrl,      // optional image URL from frontend
      imageBase64,   // optional base64 image string from frontend
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

    // If imageBase64 is provided, convert to a Buffer and send via multipart/form-data.
    // If imageUrl is provided, just send the photo with caption.
    // Else send a text message.

    if (imageUrl) {
      // Send photo by URL with caption = message
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            photo: imageUrl,
            caption: message,
            parse_mode: "HTML",
          }),
        }
      );

      if (!telegramResponse.ok) {
        const errorText = await telegramResponse.text();
        console.error("Telegram API error (sendPhoto URL):", errorText);
        return res.status(telegramResponse.status).json({
          status: "error",
          message: "Failed to send photo message to Telegram.",
          details: errorText,
        });
      }

      return res.json({ status: "success", message: "✅ Request with image URL sent successfully!" });
    } 
    else if (imageBase64) {
      // Send photo by uploading base64 data as file - requires multipart/form-data
      // For that, we need form-data package and stream the buffer

      // We'll handle this in a helper function below

      const result = await sendPhotoBase64(imageBase64, message);
      if (!result.ok) {
        console.error("Telegram API error (sendPhoto Base64):", result.error);
        return res.status(500).json({
          status: "error",
          message: "Failed to send base64 image to Telegram.",
          details: result.error,
        });
      }

      return res.json({ status: "success", message: "✅ Request with base64 image sent successfully!" });
    }
    else {
      // No image, send as text message
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
        console.error("Telegram API error (sendMessage):", errorText);
        return res.status(telegramResponse.status).json({
          status: "error",
          message: "Failed to send message to Telegram.",
          details: errorText,
        });
      }

      return res.json({ status: "success", message: "✅ Request sent successfully! We will contact you soon." });
    }
  } catch (error) {
    console.error("Internal server error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error. Please try again later.",
      details: error.message,
    });
  }
});

// Helper to send base64 photo to Telegram using multipart/form-data
import FormData from "form-data";

async function sendPhotoBase64(base64String, caption) {
  try {
    // Remove header if included like "data:image/png;base64,"
    const matches = base64String.match(/^data:(image\/\w+);base64,(.+)$/);
    let imageBuffer;
    let mimeType = "image/jpeg"; // default mime

    if (matches) {
      mimeType = matches[1];
      imageBuffer = Buffer.from(matches[2], 'base64');
    } else {
      imageBuffer = Buffer.from(base64String, 'base64');
    }

    const form = new FormData();
    form.append("chat_id", TELEGRAM_CHAT_ID);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("photo", imageBuffer, {
      filename: `image.${mimeType.split('/')[1]}`,
      contentType: mimeType,
    });

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.description || "Unknown error" };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
