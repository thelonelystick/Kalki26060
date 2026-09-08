import infrastructure from "../../assets/infrastructure-dataset.json";
import utilities from "../../assets/utilities-dataset.json";
import transfer from "../../assets/data-transfer-dataset.json";
import alerts from "../../assets/alerts-dataset.json";

const datasets = { infrastructure, utilities, transfer, alerts };

export default function handler(request, response) {
  const moduleName = request.query?.module;
  const dataset = datasets[moduleName];

  if (!dataset) {
    response.status(404).json({
      error: "Unknown dataset",
      available: Object.keys(datasets)
    });
    return;
  }

  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  response.status(200).json({ module: moduleName, data: dataset });
}
