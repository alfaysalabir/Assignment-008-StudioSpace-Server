// Run once:  npm run seed   -> adds demo studios so the Home page is not empty
require("dotenv").config();
const { connectDB } = require("./db");

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;
const pool = [
  img("photo-1492691527719-9d1e07e534b4"),
  img("photo-1516280440614-37939bbacd81"),
  img("photo-1598488035139-bdbb2231ce04"),
  img("photo-1478737270239-2f02b77fc618"),
  img("photo-1519682337058-a94d519337bc"),
  img("photo-1513364776144-60967b0f800f"),
  img("photo-1511379938547-c1f69419868d"),
  img("photo-1485846234645-a62644f84728"),
  img("photo-1590602847861-f357a9332bbc"),
  img("photo-1471478331149-c72f17e33c73"),
];

const base = [
  ["North Light Cyc Wall", "Photo Studio", 45, 100, 8, "Soho, New York, USA", ["Natural Light", "Cyc Wall", "Backdrops", "Wi-Fi", "Changing Room"], "A bright 1,200 sq ft studio with a seamless white cyc wall and huge north-facing windows. Perfect for fashion, product and portrait shoots."],
  ["Blackbox Cinema Stage", "Film Stage", 120, 400, 30, "Culver City, Los Angeles, USA", ["Green Screen", "Lighting Kit", "Green Room", "Parking", "Air Conditioning"], "A 3,000 sq ft soundproof stage with a lighting grid, green screen wall and a private green room for your cast and crew."],
  ["Velvet Mic Podcast Lounge", "Podcast Lounge", 35, 50, 5, "Shoreditch, London, UK", ["Soundproofing", "Mic & Mixer", "Wi-Fi", "Air Conditioning", "Kitchenette"], "A cozy lounge with four broadcast microphones, acoustic panels and a relaxed sofa corner for guests and live interviews."],
  ["Echo Room Recording Suite", "Music Suite", 60, 150, 10, "Kreuzberg, Berlin, Germany", ["Soundproofing", "Studio Monitors", "Mic & Mixer", "Wi-Fi", "Parking"], "A treated live room and control room with a 24-channel console, drum kit and vintage amps. Engineer available on request."],
  ["Clay & Canvas Workshop", "Workshop", 28, 40, 14, "Gulshan, Dhaka, Bangladesh", ["Natural Light", "Wi-Fi", "Kitchenette", "Air Conditioning", "Changing Room"], "A large open workshop with easels, pottery wheels and a kiln. Great for art classes, craft sessions and small creative events."],
  ["Loft Sixteen Daylight Studio", "Photo Studio", 55, 120, 12, "Brooklyn, New York, USA", ["Natural Light", "Cyc Wall", "Lighting Kit", "Backdrops", "Parking"], "A converted warehouse loft with brick walls, a hardwood floor and soft daylight all afternoon. Includes strobes and modifiers."],
  ["Studio Orbit Sound Stage", "Film Stage", 95, 300, 25, "Banani, Dhaka, Bangladesh", ["Green Screen", "Lighting Kit", "Soundproofing", "Green Room", "Air Conditioning"], "A modern sound stage for commercials, music videos and short films with a drive-in loading door and rigging points."],
  ["The Quiet Booth", "Podcast Lounge", 22, 30, 3, "Mirpur, Dhaka, Bangladesh", ["Soundproofing", "Mic & Mixer", "Wi-Fi", "Air Conditioning"], "A compact, fully treated booth ideal for solo voice-over, audiobooks and two-person podcasts at an easy price."],
  ["Analog Dreams Music Suite", "Music Suite", 48, 100, 8, "Nashville, Tennessee, USA", ["Studio Monitors", "Mic & Mixer", "Soundproofing", "Kitchenette", "Parking"], "A warm, wood-paneled suite built for songwriters and small bands, with a grand piano and plenty of outboard gear."],
  ["Sunday Hands Art Workshop", "Workshop", 32, 60, 16, "Lisbon, Portugal", ["Natural Light", "Backdrops", "Wi-Fi", "Kitchenette", "Changing Room"], "A sunny ground-floor workshop for painting, screen printing and photography classes with long shared tables and storage."],
];

const reviewers = [
  ["Maya Rahman", "Beautiful space and a very friendly host. The light was perfect for our shoot."],
  ["Daniel Cruz", "Clean, quiet and exactly like the photos. Easy booking and fast reply."],
  ["Sara Lindqvist", "Great value for the price. We will book again for our next project."],
];

async function seed() {
  const db = await connectDB();
  const col = db.collection("studios");

  await col.deleteMany({ ownerEmail: "host@studiospace.demo" }); // remove old demo data only

  const docs = base.map((s, i) => {
    const reviews = reviewers.slice(0, 2 + (i % 2)).map((r, n) => ({
      userName: r[0],
      userEmail: `reviewer${n}@studiospace.demo`,
      userPhoto: "",
      rating: n === 0 ? 5 : 4,
      comment: r[1],
      createdAt: new Date(Date.now() - n * 86400000 * 3),
    }));
    const rating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    return {
      title: s[0],
      category: s[1],
      hourlyRate: s[2],
      securityDeposit: s[3],
      maxCapacity: s[4],
      location: s[5],
      amenities: s[6],
      overview: s[7],
      image: pool[i % pool.length],
      gallery: [pool[(i + 3) % pool.length], pool[(i + 6) % pool.length]],
      ownerEmail: "host@studiospace.demo",
      ownerName: "StudioSpace Demo Host",
      ownerPhoto: "",
      rating: Math.round(rating * 10) / 10,
      reviewCount: reviews.length,
      reviews,
      createdAt: new Date(Date.now() - i * 86400000),
    };
  });

  await col.insertMany(docs);
  console.log(`Seeded ${docs.length} studios`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
