const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();

const CATEGORIES = ["Photo Studio", "Film Stage", "Podcast Lounge", "Music Suite", "Workshop"];

// ---------- helpers ----------
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanStudio(body) {
  return {
    title: String(body.title || "").trim(),
    category: body.category,
    hourlyRate: Number(body.hourlyRate),
    securityDeposit: Number(body.securityDeposit),
    maxCapacity: Number(body.maxCapacity),
    location: String(body.location || "").trim(),
    image: String(body.image || "").trim(),
    gallery: Array.isArray(body.gallery) ? body.gallery.filter(Boolean) : [],
    amenities: Array.isArray(body.amenities) ? body.amenities : [],
    overview: String(body.overview || "").trim(),
  };
}

function validateStudio(s) {
  if (s.title.length < 3) return "Title must be at least 3 characters";
  if (!CATEGORIES.includes(s.category)) return "Please choose a valid category";
  if (!(s.hourlyRate > 0)) return "Hourly rate must be more than $0";
  if (isNaN(s.securityDeposit) || s.securityDeposit < 0) return "Security deposit must be 0 or more";
  if (!(s.maxCapacity > 0)) return "Max capacity must be at least 1";
  if (s.location.length < 3) return "Please add the studio location";
  if (!s.image) return "Please add a studio image";
  if (s.overview.length < 20) return "Overview must be at least 20 characters";
  return null;
}

// ---------- GET all studios (public) ----------
// supports: ?search= &category= &sort= &limit=
router.get("/", async (req, res) => {
  try {
    const { search, category, sort, limit } = req.query;
    const filter = {};

    if (category && category !== "All") filter.category = category;
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ title: rx }, { location: rx }, { category: rx }];
    }

    const sorts = {
      rating: { rating: -1, createdAt: -1 },
      newest: { createdAt: -1 },
      priceLow: { hourlyRate: 1 },
      priceHigh: { hourlyRate: -1 },
    };

    let cursor = getDB().collection("studios").find(filter).sort(sorts[sort] || sorts.newest);
    const max = Number(limit);
    if (max > 0) cursor = cursor.limit(Math.min(max, 50)); // Home page uses .limit(6)

    res.json(await cursor.toArray());
  } catch (error) {
    res.status(500).json({ message: "Could not load studios" });
  }
});

// ---------- GET my studios (private) ----------
router.get("/my", verifyToken, async (req, res) => {
  try {
    const studios = await getDB()
      .collection("studios")
      .find({ ownerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(studios);
  } catch (error) {
    res.status(500).json({ message: "Could not load your listings" });
  }
});

// ---------- GET one studio (public) ----------
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: "Studio not found" });
    }
    const studio = await getDB().collection("studios").findOne({ _id: new ObjectId(req.params.id) });
    if (!studio) return res.status(404).json({ message: "Studio not found" });
    res.json(studio);
  } catch (error) {
    res.status(500).json({ message: "Could not load the studio" });
  }
});

// ---------- POST add studio (private) ----------
router.post("/", verifyToken, async (req, res) => {
  try {
    const studio = cleanStudio(req.body);
    const problem = validateStudio(studio);
    if (problem) return res.status(400).json({ message: problem });

    // owner info always comes from the verified token (not from the form)
    studio.ownerEmail = req.user.email;
    studio.ownerName = req.user.name;
    studio.ownerPhoto = req.user.image || "";
    studio.rating = 0;
    studio.reviewCount = 0;
    studio.reviews = [];
    studio.createdAt = new Date();

    const result = await getDB().collection("studios").insertOne(studio);
    res.status(201).json({ message: "Studio added", insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Could not add the studio" });
  }
});

// ---------- PUT update studio (private, owner only) ----------
router.put("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Studio not found" });
    const col = getDB().collection("studios");
    const _id = new ObjectId(req.params.id);

    const old = await col.findOne({ _id });
    if (!old) return res.status(404).json({ message: "Studio not found" });
    if (old.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: "You can only edit your own studios" });
    }

    const studio = cleanStudio(req.body);
    const problem = validateStudio(studio);
    if (problem) return res.status(400).json({ message: problem });

    studio.updatedAt = new Date();
    await col.updateOne({ _id }, { $set: studio });
    res.json({ message: "Studio updated" });
  } catch (error) {
    res.status(500).json({ message: "Could not update the studio" });
  }
});

// ---------- DELETE studio (private, owner only) ----------
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Studio not found" });
    const db = getDB();
    const _id = new ObjectId(req.params.id);

    const old = await db.collection("studios").findOne({ _id });
    if (!old) return res.status(404).json({ message: "Studio not found" });
    if (old.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: "You can only delete your own studios" });
    }

    await db.collection("studios").deleteOne({ _id });
    // clean up: cancel open bookings and remove saved hearts
    await db
      .collection("bookings")
      .updateMany(
        { studioId: req.params.id, status: { $in: ["Pending", "Confirmed"] } },
        { $set: { status: "Cancelled" } }
      );
    await db.collection("wishlists").deleteMany({ studioId: req.params.id });

    res.json({ message: "Studio deleted" });
  } catch (error) {
    res.status(500).json({ message: "Could not delete the studio" });
  }
});

// ---------- POST review (private) ----------
router.post("/:id/reviews", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Studio not found" });
    const col = getDB().collection("studios");
    const _id = new ObjectId(req.params.id);

    const studio = await col.findOne({ _id });
    if (!studio) return res.status(404).json({ message: "Studio not found" });
    if (studio.ownerEmail === req.user.email) {
      return res.status(400).json({ message: "You cannot review your own studio" });
    }
    if ((studio.reviews || []).some((r) => r.userEmail === req.user.email)) {
      return res.status(400).json({ message: "You already reviewed this studio" });
    }

    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: "Rating must be 1 to 5" });
    if (comment.length < 5) return res.status(400).json({ message: "Please write a short comment" });

    const review = {
      _id: new ObjectId(),
      userName: req.user.name,
      userEmail: req.user.email,
      userPhoto: req.user.image || "",
      rating,
      comment,
      createdAt: new Date(),
    };

    const reviews = [review, ...(studio.reviews || [])];
    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await col.updateOne(
      { _id },
      { $set: { reviews, reviewCount: reviews.length, rating: Math.round(average * 10) / 10 } }
    );
    res.status(201).json({ message: "Thanks for your review" });
  } catch (error) {
    res.status(500).json({ message: "Could not save the review" });
  }
});

module.exports = router;
