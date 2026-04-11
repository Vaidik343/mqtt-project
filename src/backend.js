require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");
const { Op } = require("sequelize");

const { connectDB } = require("./config/connectDB");
const { Devices } = require("./models");

const app = express();
const PORT = 9001;

app.use(cors());
app.use(express.json());

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
   DEVICE STATE MANAGEMENT
========================= */

const deviceTimers = new Map();
console.log("🚀 ~ deviceTimers:", deviceTimers)
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
            console.log("🚀 ~ device:", device)
        }

        switch (type) {
            case "status":
                await handleStatus(device, payload);
                break;

            case "heartbeat":
                await handleHeartbeat(device);
                break;

            case "config/ack":
                console.log(`✅ Config ACK from ${deviceId}`);
                break;
        }
        console.log("🚀 ~ type:", type)

    } catch (err) {
        console.error("MQTT handler error:", err);
    }
});

/* =========================
   HANDLERS
========================= */

async function handleStatus(device, status) {
    await device.update({ status });

    if (status === "online") {
        resetHeartbeatTimer(device.device_id);
    }

    if (status === "offline") {
        clearHeartbeatTimer(device.device_id);
    }
}

async function handleHeartbeat(device) {
    await device.update({
        last_seen: new Date(),
        status: "online"
    });

    resetHeartbeatTimer(device.device_id);
}

/* =========================
   TIMER MANAGEMENT
========================= */

function resetHeartbeatTimer(deviceId) {
    if (deviceTimers.has(deviceId)) {
        clearTimeout(deviceTimers.get(deviceId));
    }

    const timer = setTimeout(async () => {
        try {
            await Devices.update(
                { status: "offline" },
                { where: { device_id: deviceId } }
            );
deviceTimers.delete(deviceId);
            console.log(`⚠️ ${deviceId} OFFLINE (heartbeat timeout)`);

        } catch (err) {
            console.error("Timer error:", err);
        }
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
   CONFIG SENDER
========================= */

function sendConfig(deviceId) {
    const config = {
        ip: "192.168.1.10",
        volume: 5
    };

    client.publish(
        `devices/${deviceId}/config`,
        JSON.stringify(config),
        { qos: 1 }
    );

    console.log(`🚀 Config sent to ${deviceId}`);
}

/* =========================
   API
========================= */

app.get("/devices", async (req, res) => {
    const devices = await Devices.findAll();
    res.json(devices);
});

/* =========================
   RECOVERY (IMPORTANT)
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


async function sendConfigToAll() {
    const devices = await Devices.findAll();

    for (const device of devices) {
        sendConfig(device.device_id);
    }
}


/* =========================
   START SERVER
========================= */

const startServer = async () => {
    try {
        await connectDB();

        await recoverOfflineDevices();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });

        // test config
setTimeout(() => {
    sendConfigToAll();
}, 10000);

    } catch (err) {
        console.error("Startup error:", err);
    }
};

startServer();