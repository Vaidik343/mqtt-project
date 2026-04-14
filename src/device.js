const mqtt = require("mqtt");
const os = require("os");

const deviceId = "real-dev-1";

/* =========================
   GET REAL LOCAL IP
========================= */
function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (let name of Object.keys(interfaces)) {
    for (let net of interfaces[name]) {
      if (
        net.family === "IPv4" &&
        !net.internal &&
        (
          net.address.startsWith("192.168") || // home WiFi
          net.address.startsWith("10.") ||     // office network
          net.address.startsWith("172.")       // some LAN ranges
        )
      ) {
        return net.address;
      }
    }
  }

  return "unknown";
}

/* =========================
   MQTT CONNECT
========================= */
const client = mqtt.connect(
  "mqtts://b2c52b58b4c7491bba1df64fc866718c.s1.eu.hivemq.cloud:8883",
  {
    username: "vaidik",
    password: "Test@123",
    clientId: deviceId
  }
);

/* =========================
   ON CONNECT
========================= */
client.on("connect", () => {
  console.log(`📱 ${deviceId} connected`);
  console.log("🌐 Device IP:", getLocalIP());

  // Send ONLINE
  client.publish(`devices/${deviceId}/status`, "online", { retain: true });

  // Subscribe for config
  client.subscribe(`devices/${deviceId}/config`);

  // Heartbeat
  setInterval(() => {
    const payload = {
      ts: Date.now(),
      ip: getLocalIP()
    };

    console.log("📡 Sending heartbeat:", payload);

    client.publish(
      `devices/${deviceId}/heartbeat`,
      JSON.stringify(payload)
    );
  }, 5000);
});

/* =========================
   CONFIG HANDLING
========================= */
let currentVersion = 0;

client.on("message", (topic, message) => {
  const payload = JSON.parse(message.toString());

  // ignore duplicate config
  if (payload.version === currentVersion) {
    console.log("⚠️ Duplicate config ignored");
    return;
  }

  currentVersion = payload.version;

  console.log("📥 Config received:", payload);

  // simulate applying config
  setTimeout(() => {
    client.publish(
      `devices/${deviceId}/config/ack`,
      JSON.stringify({ version: payload.version })
    );
  }, 1000);
});