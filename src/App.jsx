import { useState, useEffect } from "react";
import data from "./data/final_multi_source_analysis.json";
import llmSummaries from "./data/llm_summaries.json";
import "./App.css";

const categoricalAspects = [
  "Kargo",
  "Teslimat",
  "Paketleme",
  "Satıcı",
  "İade/Değişim",
  "İade",
  "Değişim",
  "Müşteri Hizmetleri",
];

const sellerTrustAspects = [
  "Satıcı",
  "Kargo",
  "Teslimat",
  "Teslimat Süresi",
  "Paketleme",
  "İade/Değişim",
  "İade",
  "Değişim",
  "Müşteri Hizmetleri",
  "Garanti",
];

function getProductSummary(productData) {
  let totalReviews = 0;
  let totalAspects = 0;
  let weightedStarSum = 0;

  const sentiment = {
    positive: 0,
    neutral: 0,
    negative: 0,
    uncertain: 0,
  };

  Object.values(productData).forEach((platformData) => {
    Object.values(platformData).forEach((sellerData) => {
      const summary = sellerData.summary;
      if (!summary) return;

      totalReviews += summary.total_reviews || 0;
      totalAspects += summary.total_aspects_analyzed || 0;

      weightedStarSum +=
        (summary.average_absa_star_rating || 0) *
        (summary.total_aspects_analyzed || 0);

      sentiment.positive += summary.sentiment_distribution?.positive || 0;
      sentiment.neutral += summary.sentiment_distribution?.neutral || 0;
      sentiment.negative += summary.sentiment_distribution?.negative || 0;
      sentiment.uncertain += summary.sentiment_distribution?.uncertain || 0;
    });
  });

  const averageStar =
    totalAspects > 0 ? (weightedStarSum / totalAspects).toFixed(2) : "0.00";

  return { totalReviews, totalAspects, averageStar, sentiment };
}

function normalizeAspectName(aspectName) {
  const lowerName = aspectName.toLocaleLowerCase("tr-TR");

  if (
    lowerName.includes("fiyat") ||
    lowerName.includes("ücret") ||
    lowerName.includes("para")
  ) {
    return "Fiyat";
  }

  return aspectName;
}

function getAspectScores(productData) {
  const aspectMap = {};

  Object.values(productData).forEach((platformData) => {
    Object.values(platformData).forEach((sellerData) => {
      sellerData.detailed_reviews?.forEach((review) => {
        review.absa_analysis?.aspects_analyzed?.forEach((aspectItem) => {
          const rawAspectName = aspectItem.aspect;
          const star = Number(aspectItem.star_rating);

          if (!rawAspectName || Number.isNaN(star)) return;

          const aspectName = normalizeAspectName(rawAspectName);

          if (!aspectMap[aspectName]) {
            aspectMap[aspectName] = {
              name: aspectName,
              total: 0,
              count: 0,
            };
          }

          aspectMap[aspectName].total += star;
          aspectMap[aspectName].count += 1;
        });
      });
    });
  });

  return Object.values(aspectMap)
    .filter((aspect) => aspect.count >= 10)
    .map((aspect) => ({
      name: aspect.name,
      score: Number((aspect.total / aspect.count).toFixed(2)),
      count: aspect.count,
      type: categoricalAspects.some((keyword) =>
        aspect.name.toLocaleLowerCase("tr-TR").includes(keyword.toLocaleLowerCase("tr-TR"))
      )
        ? "categorical"
        : "general",
    }))
    .sort((a, b) => b.count - a.count);
}

function getSellerTrustScores(productData) {
  const sellers = [];

  Object.entries(productData).forEach(([platformName, platformData]) => {
    Object.entries(platformData).forEach(([sellerName, sellerData]) => {
      let total = 0;
      let count = 0;
      const usedAspects = new Set();

      sellerData.detailed_reviews?.forEach((review) => {
        review.absa_analysis?.aspects_analyzed?.forEach((aspectItem) => {
          const aspectName = aspectItem.aspect;
          const star = Number(aspectItem.star_rating);

          if (!aspectName || Number.isNaN(star)) return;

          const isTrustAspect = sellerTrustAspects.some((keyword) =>
            aspectName.toLowerCase().includes(keyword.toLowerCase())
          );

          if (!isTrustAspect) return;

          total += star;
          count += 1;
          usedAspects.add(formatAspectName(aspectName));
        });
      });

      if (count < 3) return;

      const scoreOutOfFive = total / count;
      const scoreOutOfTen = Number((scoreOutOfFive * 2).toFixed(2));

      sellers.push({
        sellerName,
        platformName,
        score: scoreOutOfTen,
        analysisCount: count,
        usedAspects: Array.from(usedAspects),
        // TODO: Bu alan daha sonra LLM ile satıcı açıklaması üretmek için kullanılacak.
        llmExplanation: "",
      });
    });
  });

  const trustedSellers = sellers
  .filter((seller) => seller.score >= 7.5)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

  const riskySellers = sellers
  .filter((seller) => seller.score <= 5)
  .sort((a, b) => a.score - b.score)
  .slice(0, 5);

  return { trustedSellers, riskySellers };
}

function formatAspectName(name) {
  return name
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toLocaleUpperCase("tr-TR") +
        word.slice(1).toLocaleLowerCase("tr-TR")
    )
    .join(" ");
}

function StarRating({ score }) {
  const rounded = Math.round(score);
  return (
    <span className="stars">
      {"★".repeat(rounded)}
      {"☆".repeat(5 - rounded)}
    </span>
  );
}

function AspectList({ title, aspects, initialLimit = 8 }) {
  const [showAll, setShowAll] = useState(false);

  const visibleAspects = showAll ? aspects : aspects.slice(0, initialLimit);
  const hiddenCount = aspects.length - initialLimit;

  return (
    <div className="aspect-card">
      <h2>{title}</h2>

      {aspects.length === 0 ? (
        <p className="empty-text">Bu grupta analiz bulunamadı.</p>
      ) : (
        <>
          {visibleAspects.map((aspect) => (
            <div className="aspect-row" key={aspect.name}>
              <div>
                <strong>{formatAspectName(aspect.name)}</strong>
                <small>{aspect.count} analiz</small>
              </div>

              <div className="aspect-score">
                <StarRating score={aspect.score} />
                <span>{aspect.score} / 5</span>
              </div>
            </div>
          ))}

          {hiddenCount > 0 && (
            <button
              className="show-more-button"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Daha az göster" : `${hiddenCount} kriter daha göster`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SellerTrustList({
  title,
  sellers,
  type,
  sellerExplanations,
})  {
  return (
    <div className="seller-card">
      <h2>{title}</h2>

      {sellers.length === 0 ? (
        <p className="empty-text">Bu grupta satıcı bulunamadı.</p>
      ) : (
        sellers.map((seller) => (
          <div className="seller-row" key={`${seller.platformName}-${seller.sellerName}`}>
            <div>
              <strong>{seller.sellerName}</strong>
              <small>
                {seller.platformName} • {seller.analysisCount} analiz
              </small>

              <p className="seller-aspects">
                Kullanılan kriterler: {seller.usedAspects.join(", ")}
              </p>

              <p className="llm-placeholder">
  {sellerExplanations[seller.sellerName] ??
    "LLM açıklaması oluşturuluyor..."}
</p>
            </div>

            <div className={`seller-score ${type}`}>
              {seller.score} / 10
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function App() {
  const productNames = Object.keys(data);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

const [llmSummary, setLlmSummary] = useState("");
const [llmLoading, setLlmLoading] = useState(false);
const [sellerExplanations, setSellerExplanations] = useState({});

useEffect(() => {
  if (!selectedProduct || !selectedData) return;

  async function generateSummary() {
    try {
      setLlmLoading(true);

      const response = await fetch("http://localhost:5001/api/product-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: selectedProduct,
          productSummary,
          generalAspects,
          categoricalAspects: categoricalAspectList,
        }),
      });

      const result = await response.json();

      setLlmSummary(result.summary || "");
      const explanations = {};

const allSellers = [
  ...sellerTrust.trustedSellers.map((seller) => ({
    seller,
    type: "trusted",
  })),
  ...sellerTrust.riskySellers.map((seller) => ({
    seller,
    type: "risky",
  })),
];

for (const item of allSellers) {
  const response = await fetch("http://localhost:5001/api/seller-summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });

  const data = await response.json();

  explanations[item.seller.sellerName] = data.explanation;
}

setSellerExplanations(explanations);
    } catch (err) {
      console.error(err);
      setLlmSummary("LLM özeti oluşturulamadı.");
    } finally {
      setLlmLoading(false);
    }
  }

  generateSummary();
}, [selectedProduct]);

  const filteredProducts = productNames
    .filter((product) => product.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 8);

  const selectedData = selectedProduct ? data[selectedProduct] : null;
  const productSummary = selectedData ? getProductSummary(selectedData) : null;
  
  const aspectScores = selectedData ? getAspectScores(selectedData) : [];
  const sellerTrust = selectedData
    ? getSellerTrustScores(selectedData)
    : { trustedSellers: [], riskySellers: [] };

  const generalAspects = aspectScores.filter(
  (aspect) => aspect.type === "general"
);

const categoricalAspectList = aspectScores.filter(
  (aspect) => aspect.type === "categorical"
);



  return (
    <div className="container">
      {!selectedProduct ? (
        <>
          <h1>Çoklu Kaynaklı Yorum Analizi</h1>
          <p className="subtitle">İncelemek istediğiniz ürünü arayın.</p>

          <input
            className="search-input"
            type="text"
            placeholder="Ürün adı yazın..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <div className="suggestions">
              {filteredProducts.map((product) => (
                <div
                  className="suggestion-item"
                  key={product}
                  onClick={() => setSelectedProduct(product)}
                >
                  {product}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <button
            className="back-button"
            onClick={() => setSelectedProduct(null)}
          >
            ← Geri
          </button>

          <h1 className="product-title">{selectedProduct}</h1>
          <p className="subtitle">
            Tüm kaynaklardan gelen yorumlar birlikte analiz edilmiştir.
          </p>

          <div className="llm-summary-card">
  <h2>Genel Değerlendirme Özeti</h2>

 <p>
  {llmLoading
    ? "LLM özeti oluşturuluyor..."
    : llmSummary || "LLM özeti oluşturulamadı."}
</p>

</div>

          <div className="summary-grid">
            <div className="summary-card">
              <span>Toplam Yorum</span>
              <strong>{productSummary.totalReviews}</strong>
            </div>

            <div className="summary-card">
              <span>Analiz Edilen Kriter</span>
              <strong>{productSummary.totalAspects}</strong>
            </div>

            <div className="summary-card">
              <span>Ortalama Analiz Puanı</span>
              <strong>{productSummary.averageStar} / 5</strong>
            </div>
          </div>

          <div className="sentiment-grid">
  <div className="sentiment-mini-card">
    <span>Pozitif</span>
    <strong>{productSummary.sentiment.positive}</strong>
  </div>

  <div className="sentiment-mini-card">
    <span>Negatif</span>
    <strong>{productSummary.sentiment.negative}</strong>
  </div>

  <div className="sentiment-mini-card">
    <span>Nötr</span>
    <strong>{productSummary.sentiment.neutral}</strong>
  </div>

  <div className="sentiment-mini-card">
    <span>Belirsiz</span>
    <strong>{productSummary.sentiment.uncertain}</strong>
  </div>
</div>

          <div className="aspect-section">
            <AspectList title="Ürün Özellikleri Analizi" aspects={generalAspects} initialLimit={8} />
<AspectList title="Satış Süreci Analizi" aspects={categoricalAspectList} initialLimit={6} />
          </div>

          <div className="seller-section">
            <h2>Satıcı Güvenilirliği</h2>

            <div className="seller-grid">
              <SellerTrustList
    title="Güvenilir Satıcılar"
    sellers={sellerTrust.trustedSellers}
    type="trusted"
    sellerExplanations={sellerExplanations}
/>

              <SellerTrustList
    title="Dikkat Edilmesi Gereken Satıcılar"
    sellers={sellerTrust.riskySellers}
    type="risky"
    sellerExplanations={sellerExplanations}
/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;