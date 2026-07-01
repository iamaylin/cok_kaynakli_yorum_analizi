import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("OpenAI LLM backend çalışıyor.");
});

// ==========================
// Ürün Özeti
// ==========================
app.post("/api/product-summary", async (req, res) => {
  try {
    const {
      productName,
      productSummary,
      generalAspects,
      categoricalAspects,
    } = req.body;

    const prompt = `
Sen deneyimli bir e-ticaret ürün analiz uzmanısın.

Aşağıdaki verileri inceleyerek kullanıcıya gösterilecek profesyonel bir özet oluştur.

Ürün:
${productName}

Toplam yorum:
${productSummary.totalReviews}

Analiz edilen kriter:
${productSummary.totalAspects}

Ortalama puan:
${productSummary.averageStar}/5

Duygu dağılımı

Pozitif:
${productSummary.sentiment.positive}

Negatif:
${productSummary.sentiment.negative}

Nötr:
${productSummary.sentiment.neutral}

Belirsiz:
${productSummary.sentiment.uncertain}

Genel kriterler:

${JSON.stringify(generalAspects.slice(0, 8), null, 2)}

Kategori kriterleri:

${JSON.stringify(categoricalAspects.slice(0, 6), null, 2)}

Kurallar

- Kullanıcı diliyle yaz.
- 2 veya en fazla 3 cümle olsun.
- Ürünün güçlü yönlerini ve zayıf yönlerini dengeli belirt.
- Reklam dili kullanma.
- Sayıları tekrar etme.
- Sonuç kısmında genel satın alma izlenimi ver.
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    res.json({
  explanation: response.output_text,
});
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "LLM özeti oluşturulamadı.",
    });
  }
});

// ==========================
// Satıcı Özeti
// ==========================
app.post("/api/seller-summary", async (req, res) => {
  try {
    const { seller, type } = req.body;

    const prompt = `
Sen e-ticaret satıcı analizi yapan profesyonel bir uzmansın.

Satıcı:
${seller.sellerName}

Platform:
${seller.platformName}

Güven puanı:
${seller.score}/10

Analiz sayısı:
${seller.analysisCount}

Kullanılan kriterler:
${seller.usedAspects.join(", ")}

Durum:
${type === "trusted"
  ? "Güvenilir satıcı"
  : "Dikkat edilmesi gereken satıcı"}

Kurallar

- 1 veya 2 cümle yaz.
- Kullanıcıya neden bu sonucun çıktığını açıkla.
- Kesin hüküm verme.
- Profesyonel ama sade Türkçe kullan.
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    res.json({
      explanation: response.output_text,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Satıcı özeti oluşturulamadı.",
    });
  }
});

app.listen(5001, () => {
  console.log("Backend çalışıyor: http://localhost:5001");
});