const mqtt = require("mqtt");

const BROKER_URL = "mqtts://b2c52b58b4c7491bba1df64fc866718c.s1.eu.hivemq.cloud:8883";
const USERNAME = "vaidik";
const PASSWORD = "Test@123";

const devices = new Map();

function createDevice(deviceId) {
    const client = mqtt.connect(BROKER_URL, {
        clientId: deviceId,
        username: USERNAME,
        password: PASSWORD,

        will: {
            topic: `devices/${deviceId}/status`,
            payload: "offline",
            qos: 1,
            retain: true
        }
    });

    let heartbeatInterval;

    client.on("connect", () => {
        console.log(`📱 ${deviceId} connected`);

        // Send ONLINE status
        client.publish(`devices/${deviceId}/status`, "online", { retain: true });

        // Subscribe to config
        client.subscribe(`devices/${deviceId}/config`);

        // Start heartbeat
        heartbeatInterval = setInterval(() => {
            client.publish(
                `devices/${deviceId}/heartbeat`,
                JSON.stringify({ ts: Date.now() })
            );
        }, 5000);
    });

    client.on("message", (topic, message) => {
  const payload = JSON.parse(message.toString());

  if (topic.includes("/config")) {
    console.log(`${deviceId} received config`, payload);

    // simulate applying config
    setTimeout(() => {
      client.publish(
        `devices/${deviceId}/config/ack`,
        JSON.stringify({ version: payload.version })
      );
    }, 1000);
  }
});

    client.on("close", () => {
        console.log(`❌ ${deviceId} disconnected`);
    });

    return {
        deviceId,
        client,
        stopHeartbeat: () => {
            console.log(`🛑 ${deviceId} heartbeat stopped`);
            clearInterval(heartbeatInterval);
        },
        kill: () => {
            console.log(`💥 ${deviceId} killed`);
            client.end(true); // force disconnect (triggers LWT)
        }
    };
}

function startSimulation(count = 10) {
    for (let i = 1; i <= count; i++) {
        const deviceId = `dev-${i}`;
        const device = createDevice(deviceId);
        devices.set(deviceId, device);
    }
}

// 🚀 Start 10 devices
startSimulation(10);



// ================= TEST SCENARIOS =================

// 💥 Kill one device (LWT test)
setTimeout(() => {
    const device = devices.get("dev-3");
    if (device) device.kill();
}, 15000);


// 🛑 Stop heartbeat (timeout test)
setTimeout(() => {
    const device = devices.get("dev-5");
    if (device) device.stopHeartbeat();
}, 20000);


// 🔄 Restart a device (recovery test)
setTimeout(() => {
    console.log("🔄 Restarting dev-3");

    const device = createDevice("dev-3");
    devices.set("dev-3", device);
}, 30000);