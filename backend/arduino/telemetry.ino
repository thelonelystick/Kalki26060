// Arduino IDE example for an ESP32/Arduino-compatible board.
// Send real sensor readings to the Node.js API; do not hard-code production keys.
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_URL = "http://YOUR_BACKEND_HOST:8787/api/telemetry/station-01";
const char* DEVICE_KEY = "YOUR_DEVICE_KEY";

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", DEVICE_KEY);
    String payload = "{\"temperatureC\": " + String(analogRead(34)) + ", \"humidityPct\": " + String(analogRead(35)) + "}";
    int status = http.POST(payload);
    Serial.printf("telemetry status: %d\n", status);
    http.end();
  }
  delay(30000);
}
