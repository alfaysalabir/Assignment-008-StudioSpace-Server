// Optional feature: Saved Studios Wishlist
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken); // every wishlist route is private

// list of saved studio ids (used for the heart icons)
router.get("/", async (req, res) => {
  try {
    const items = await getDB().collection("wishlists").find({ userEmail: req.user.email }).toArray();
    res.json(items.map((item) => item.studioId));
  } catch (error) {
    res.status(500).json({ message: "Could not load saved studios" });
  }
});

// full studio documents (used on the dashboard)
router.get("/studios", async (req, res) => {
  try {
    const db = getDB();
    const items = await db.collection("wishlists").find({ userEmail: req.user.email }).toArray();
    const ids = items.filter((i) => ObjectId.isValid(i.studioId)).map((i) => new ObjectId(i.studioId));
    const studios = await db.collection("studios").find({ _id: { $in: ids } }).toArray();
    res.json(studios);
  } catch (error) {
    res.status(500).json({ message: "Could not load saved studios" });
  }
});

// toggle heart: save if not saved, remove if already saved
router.post("/:studioId", async (req, res) => {
  try {
    const col = getDB().collection("wishlists");
    const filter = { userEmail: req.user.email, studioId: req.params.studioId };

    const exists = await col.findOne(filter);
    if (exists) {
      await col.deleteOne(filter);
      return res.json({ saved: false, message: "Removed from saved studios" });
    }
    await col.insertOne({ ...filter, createdAt: new Date() });
    res.json({ saved: true, message: "Saved to your wishlist" });
  } catch (error) {
    res.status(500).json({ message: "Could not update wishlist" });
  }
});

module.exports = router;
