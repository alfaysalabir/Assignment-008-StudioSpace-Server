require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectDB } = require("./db");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// connect to MongoDB before every request (works on Vercel too)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ message: "Database connection failed" });
  }
});

app.get("/", (req, res) => res.json({ message: "StudioSpace API is running" }));

app.use("/api/studios", require("./routes/studios"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/wishlist", require("./routes/wishlist"));

// unknown route
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

const port = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(port, () => console.log(`StudioSpace server running on port ${port}`));
}

module.exports = app;
