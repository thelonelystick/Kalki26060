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

  // Keep the boolean for existing consumers and publish the DOM binding contract
  // so automation can locate a module, item, or individual dataset field.
  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  response.status(200).json({
    module: moduleName,
    data: dataset,
    dom: true,
    domAttributes: {
      module: "data-dataset",
      item: "data-dataset-item",
      path: "data-dataset-path"
    }
  });
}
