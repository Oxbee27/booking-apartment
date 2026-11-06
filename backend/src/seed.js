import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./db.js";

const rows = [
  [
    "The Azure Loft",
    "Lekki, Lagos",
    "Admiralty Way, Lekki Phase 1",
    "A calm, design-led city retreat with warm interiors, a bright living area and everything you need for a memorable stay.",
    85000,
    2,
    2,
    4,
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Pool", "Air conditioning", "Kitchen", "24/7 security"],
    true,
  ],
  [
    "Palm Court Residence",
    "Victoria Island, Lagos",
    "Ahmadu Bello Way, Victoria Island",
    "A spacious contemporary apartment close to business, dining and the waterfront.",
    110000,
    3,
    2,
    6,
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Gym", "Parking", "Kitchen", "Smart TV"],
    true,
  ],
  [
    "The Garden Suite",
    "Ikeja, Lagos",
    "Alausa, Ikeja",
    "A peaceful and practical home base with leafy views, comfortable bedrooms and easy access around Ikeja.",
    62000,
    2,
    1,
    4,
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Workspace", "Air conditioning", "Parking"],
    false,
  ],
  [
    "Skyline Penthouse",
    "Ikoyi, Lagos",
    "Bourdillon Road, Ikoyi",
    "An elegant top-floor escape with generous spaces, city views and premium finishes.",
    165000,
    3,
    3,
    6,
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Pool", "Gym", "Balcony", "Generator"],
    true,
  ],
  [
    "Coastal Hideaway",
    "Oniru, Lagos",
    "Oniru Estate, Lagos",
    "A relaxed apartment for longer stays, with a clean modern feel and quick access to the beach area.",
    78000,
    2,
    2,
    4,
    "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Kitchen", "Parking", "24/7 security"],
    false,
  ],
  [
    "Maple Two-Bedroom",
    "Yaba, Lagos",
    "Herbert Macaulay Way, Yaba",
    "A bright, comfortable apartment close to technology hubs, universities and local restaurants.",
    55000,
    2,
    1,
    3,
    "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Workspace", "Kitchen", "Air conditioning"],
    false,
  ],
  [
    "Jabi Lakeside Apartment",
    "Jabi, Abuja",
    "Jabi Lake Mall Road, Jabi",
    "A bright, spacious apartment near Jabi Lake with a comfortable lounge and a quiet workspace.",
    95000,
    2,
    2,
    4,
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Workspace", "Kitchen", "24/7 security"],
    true,
  ],
  [
    "Old GRA Garden Residence",
    "Old GRA, Port Harcourt",
    "Sani Abacha Road, Old GRA",
    "A peaceful, fully furnished apartment with a private garden and easy access to Port Harcourt's business district.",
    80000,
    2,
    2,
    4,
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Air conditioning", "Parking", "Generator"],
    false,
  ],
  [
    "Bodija City Retreat",
    "Bodija, Ibadan",
    "Adeyi Avenue, Bodija",
    "A modern, welcoming apartment in Bodija with generous living space and convenient access to shops and restaurants.",
    50000,
    2,
    1,
    3,
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85",
    ["Wi-Fi", "Kitchen", "Parking", "Air conditioning"],
    false,
  ],
];

try {
  const password = await bcrypt.hash("StayNest@2026", 12);
  await db
    .prepare(
      "INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin') ON CONFLICT(email) DO NOTHING",
    )
    .run("StayNest Admin", "admin@staynest.local", password);

  const find = db.prepare("SELECT id FROM apartments WHERE title=? AND city=?");
  const insert = db.prepare(
    "INSERT INTO apartments(title,city,address,description,price,bedrooms,bathrooms,guests,image,amenities,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
  );
  for (const apartment of rows) {
    if (await find.get(apartment[0], apartment[1])) continue;
    await insert.run(
      ...apartment.slice(0, 9),
      JSON.stringify(apartment[9]),
      apartment[10],
    );
  }

  console.log("Seed complete. Admin: admin@staynest.local / StayNest@2026");
} finally {
  await db.close();
}
