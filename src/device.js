const mqtt = require("mqtt");

// const deviceId = "dev-1";

const client = mqtt.connect("mqtts://b2c52b58b4c7491bba1df64fc866718c.s1.eu.hivemq.cloud:8883", {
    clientId: deviceId,
    username: "vaidik",
    password: "Test@123", 

    will: {
        topic: `devices/${deviceId}/status`,
        payload: "offline",
        qos: 1,
        retain: true
    }
});

client.on("connect", () => {
  console.log(`📱 ${deviceId} connected`);

  // Send ONLINE status
  client.publish(`devices/${deviceId}/status`, "online", { retain: true });

  // Listen for config
  client.subscribe(`devices/${deviceId}/config`);

  // Heartbeat
  setInterval(() => {
    client.publish(`devices/${deviceId}/heartbeat`, JSON.stringify({
      ts: Date.now()
    }));
  }, 5000);
});

client.on("message", (topic, message) => {
  console.log(`⚙️ Config received: ${message.toString()}`);

  // Send ACK
  client.publish(`devices/${deviceId}/config/ack`, "success");
});