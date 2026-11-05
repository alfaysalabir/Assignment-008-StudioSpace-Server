const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Challenge 2: double-booking prevention
// A new slot collides with a Confirmed booking when:
//   existing.start < new.end  AND  existing.end > new.start
function findOverlap(col, { studioId, date, startTime, endTime, excludeId }) {
  const query = {
    studioId,
    date,
    status: "Confirmed",
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return col.findOne(query);
}

// ---------- GET confirmed slots of a studio for one date (public) ----------
router.get("/slots", async (req, res) => {
  try {
    const { studioId, date } = req.query;
    if (!studioId || !date) return res.status(400).json({ message: "studioId and date are required" });

    const slots = await getDB()
      .collection("bookings")
      .find({ studioId, date, status: "Confirmed" }, { projection: { startTime: 1, endTime: 1 } })
      .sort({ startTime: 1 })
      .toArray();
    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: "Could not load slots" });
  }
});

// ---------- GET my reservations (private) ----------
router.get("/my", verifyToken, async (req, res) => {
  try {
    const list = await getDB()
      .collection("bookings")
      .find({ userEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Could not load your bookings" });
  }
});

// ---------- GET booking requests for my studios (private, host) ----------
router.get("/requests", verifyToken, async (req, res) => {
  try {
    const list = await getDB()
      .collection("bookings")
      .find({ hostEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: "Could not load booking requests" });
  }
});

// ---------- POST new booking (private) ----------
router.post("/", verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { studioId, date, startTime, endTime, guests, notes } = req.body;

    if (!ObjectId.isValid(studioId)) return res.status(400).json({ message: "Invalid studio" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ message: "Please choose a date" });
    if (!TIME_REGEX.test(startTime || "") || !TIME_REGEX.test(endTime || "")) {
      return res.status(400).json({ message: "Please choose start and end time" });
    }
    if (toMinutes(endTime) - toMinutes(startTime) < 60) {
      return res.status(400).json({ message: "Minimum booking is 1 hour (end time must be after start time)" });
    }

    // not in the past (1 day tolerance because of time zones)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (date < yesterday) return res.status(400).json({ message: "You cannot book a past date" });

    const studio = await db.collection("studios").findOne({ _id: new ObjectId(studioId) });
    if (!studio) return res.status(404).json({ message: "Studio not found" });
    if (studio.ownerEmail === req.user.email) {
      return res.status(400).json({ message: "You cannot book your own studio" });
    }

    const guestCount = Number(guests) || 1;
    if (guestCount < 1 || guestCount > studio.maxCapacity) {
      return res.status(400).json({ message: `Guests must be between 1 and ${studio.maxCapacity}` });
    }

    const col = db.collection("bookings");
    const clash = await findOverlap(col, { studioId, date, startTime, endTime });
    if (clash) {
      return res.status(409).json({
        message: `This time overlaps with a confirmed booking (${clash.startTime} - ${clash.endTime}). Please pick another slot.`,
      });
    }

    const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60;
    const booking = {
      studioId,
      studioTitle: studio.title,
      studioImage: studio.image,
      studioLocation: studio.location,
      hourlyRate: studio.hourlyRate,
      securityDeposit: studio.securityDeposit,
      hostEmail: studio.ownerEmail,
      hostName: studio.ownerName,
      userEmail: req.user.email,
      userName: req.user.name,
      date,
      startTime,
      endTime,
      hours,
      guests: guestCount,
      notes: String(notes || "").trim(),
      totalPrice: hours * studio.hourlyRate,
      status: "Pending",
      createdAt: new Date(),
    };

    const result = await col.insertOne(booking);
    res.status(201).json({ message: "Booking request sent", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Could not create the booking" });
  }
});

// ---------- PATCH cancel (private, the creator who booked, only Pending) ----------
router.patch("/:id/cancel", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Booking not found" });
    const col = getDB().collection("bookings");
    const _id = new ObjectId(req.params.id);

    const booking = await col.findOne({ _id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.userEmail !== req.user.email) {
      return res.status(403).json({ message: "This is not your booking" });
    }
    if (booking.status !== "Pending") {
      return res.status(400).json({ message: "Only pending bookings can be cancelled" });
    }

    await col.updateOne({ _id }, { $set: { status: "Cancelled" } });
    res.json({ message: "Booking cancelled" });
  } catch (error) {
    res.status(500).json({ message: "Could not cancel the booking" });
  }
});

// ---------- PATCH status (private, the host of the studio) ----------
router.patch("/:id/status", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Booking not found" });
    const col = getDB().collection("bookings");
    const _id = new ObjectId(req.params.id);
    const { status } = req.body;

    if (!["Confirmed", "Completed", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await col.findOne({ _id });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.hostEmail !== req.user.email) {
      return res.status(403).json({ message: "Only the studio host can change this booking" });
    }
    if (["Completed", "Cancelled"].includes(booking.status)) {
      return res.status(400).json({ message: `This booking is already ${booking.status}` });
    }
    if (status === "Completed" && booking.status !== "Confirmed") {
      return res.status(400).json({ message: "Only confirmed bookings can be completed" });
    }

    if (status === "Confirmed") {
      // check overlap again, because another booking may be confirmed meanwhile
      const clash = await findOverlap(col, {
        studioId: booking.studioId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        excludeId: _id,
      });
      if (clash) {
        return res.status(409).json({
          message: `Cannot confirm: overlaps with a confirmed booking (${clash.startTime} - ${clash.endTime}).`,
        });
      }
    }

    await col.updateOne({ _id }, { $set: { status } });
    res.json({ message: `Booking ${status.toLowerCase()}` });
  } catch (error) {
    res.status(500).json({ message: "Could not update the booking" });
  }
});

module.exports = router;
