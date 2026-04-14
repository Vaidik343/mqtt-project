require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");
const { Op } = require("sequelize");
const http = require("http");
const { Server } = require("socket.io");

const { connectDB } = require("./config/connectDB");
const { Devices, DeviceLogs } = require("./models");
const { logDeviceEvent } = require("./services/logsService");

const app = express();
const server = http.createServer(app);
const PORT = 9001;

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

/* =========================
   SOCKET.IO
========================= */
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

/* =========================
   MQTT SETUP
========================= */
const client = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
});

client.on("connect", () => {
  console.log("✅ Backend connected to MQTT");

  client.subscribe("devices/+/status");
  client.subscribe("devices/+/heartbeat");
  client.subscribe("devices/+/config/ack");
});

client.on("error", (err) => {
  console.error("❌ MQTT Error:", err.message);
});

/* =========================
   DEVICE STATE
========================= */
const deviceTimers = new Map();
const HEARTBEAT_TIMEOUT = 15000;

/* =========================
   MQTT MESSAGE HANDLER
========================= */
client.on("message", async (topic, message) => {
  try {
    const payload = message.toString();
    const parts = topic.split("/");
    const deviceId = parts[1];
    const type = parts.slice(2).join("/");

    let device = await Devices.findOne({
      where: { device_id: deviceId }
    });

    if (!device) {
      device = await Devices.create({
        device_id: deviceId,
        status: "offline"
      });
    }

    switch (type) {
      /* ===== STATUS ===== */
      case "status":
        await handleStatus(device, payload);

        io.emit("device:update", {
          deviceId,
          status: payload
        });
        break;

      /* ===== HEARTBEAT ===== */
      case "heartbeat":
        const hbData = JSON.parse(payload);

        await handleHeartbeat(device, hbData);

        io.emit("device:heartbeat", {
          deviceId,
          lastSeen: new Date(),
          ip: hbData.ip
        });
        break;

      /* ===== CONFIG ACK ===== */
      case "config/ack":
        const ackData = JSON.parse(payload);

        await Devices.update(
          { config_status: "applied" },
          { where: { device_id: deviceId } }
        );

        await logDeviceEvent({
          deviceId,
          event: "config_ack",
          message: `Config applied (v${ackData.version})`
        });

        io.emit("device:config_status", {
          deviceId,
          status: "applied"
        });

        break;
    }

  } catch (err) {
    console.error("MQTT handler error:", err);
  }
});

/* =========================
   HANDLERS
========================= */

const handleStatus = async (device, status) => {
  await device.update({ status });

  await logDeviceEvent({
    deviceId: device.device_id,
    event: "status",
    message: `Device is ${status}`
  });

  if (status === "online") {
    resetHeartbeatTimer(device.device_id);

    // await sendConfig(device); // auto sync config
  }

  if (status === "offline") {
    clearHeartbeatTimer(device.device_id);
  }
};

const handleHeartbeat = async (device, hbData) => {
  await device.update({
    last_seen: new Date(),
    status: "online",
    ip: hbData.ip // ✅ FIXED
  });

  if (Math.random() < 0.1) {
    await logDeviceEvent({
      deviceId: device.device_id,
      event: "heartbeat",
      message: "Heartbeat received",
      meta: hbData
    });
  }

  resetHeartbeatTimer(device.device_id);
};

/* =========================
   TIMER MANAGEMENT
========================= */

function resetHeartbeatTimer(deviceId) {
  if (deviceTimers.has(deviceId)) {
    clearTimeout(deviceTimers.get(deviceId));
  }

  const timer = setTimeout(async () => {
    await Devices.update(
      { status: "offline" },
      { where: { device_id: deviceId } }
    );

    await logDeviceEvent({
      deviceId,
      event: "offline",
      message: "Heartbeat timeout"
    });

    io.emit("device:update", {
      deviceId,
      status: "offline"
    });

    deviceTimers.delete(deviceId);
  }, HEARTBEAT_TIMEOUT);

  deviceTimers.set(deviceId, timer);
}

function clearHeartbeatTimer(deviceId) {
  if (deviceTimers.has(deviceId)) {
    clearTimeout(deviceTimers.get(deviceId));
    deviceTimers.delete(deviceId);
  }
}

/* =========================
   CONFIG SYSTEM
========================= */

async function sendConfig(device) {
  const payload = {
    ...device.config,
    version: device.config_version
  };

  await device.update({ config_status: "pending" });

  client.publish(
    `devices/${device.device_id}/config`,
    JSON.stringify(payload),
    { qos: 1 }
  );

  await logDeviceEvent({
    deviceId: device.device_id,
    event: "config_sent",
    message: "Config sent",
    meta: payload
  });

  io.emit("device:config_status", {
    deviceId: device.device_id,
    status: "pending"
  });

  console.log(`🚀 Config sent to ${device.device_id}`);
}

/* =========================
   API
========================= */

app.get("/devices", async (req, res) => {
  const devices = await Devices.findAll();
  res.json(devices);
});

app.get("/logs", async (req, res) => {
  const logs = await DeviceLogs.findAll({
    limit: 50,
    order: [["createdAt", "DESC"]]
  });

  res.json(logs);
});

app.post("/devices/:id/config", async (req, res) => {
  try {
    const { id } = req.params;
    const newConfig = req.body;

    const device = await Devices.findOne({
      where: { device_id: id }
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const updated = await device.update({
      config: newConfig,
      config_version: device.config_version + 1
    });

    await sendConfig(updated);

    res.json({
      message: "Config updated & sent",
      device: updated
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
   RECOVERY
========================= */

async function recoverOfflineDevices() {
  const threshold = new Date(Date.now() - HEARTBEAT_TIMEOUT);

  await Devices.update(
    { status: "offline" },
    {
      where: {
        last_seen: {
          [Op.lt]: threshold
        }
      }
    }
  );

  console.log("♻️ Recovery complete");
}

/* =========================
   START SERVER
========================= */

const startServer = async () => {
  try {
    await connectDB();
    await recoverOfflineDevices();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("Startup error:", err);
  }
};

startServer();