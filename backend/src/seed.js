import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {db} from './db.js';
const hash=bcrypt.hashSync('StayNest@2026',12);
db.prepare(`INSERT OR IGNORE INTO users(name,email,password,role) VALUES(?,?,?,'admin')`).run('StayNest Admin','admin@staynest.local',hash);
const rows=[
['The Azure Loft','Lekki, Lagos','Admiralty Way, Lekki Phase 1','A calm, design-led city retreat with warm interiors, a bright living area and everything you need for a memorable stay.',85000,2,2,4,'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85','["Wi-Fi","Pool","Air conditioning","Kitchen","24/7 security"]',1],
['Palm Court Residence','Victoria Island, Lagos','Ahmadu Bello Way, Victoria Island','A spacious contemporary apartment close to business, dining and the waterfront.',110000,3,2,6,'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85','["Wi-Fi","Gym","Parking","Kitchen","Smart TV"]',1],
['The Garden Suite','Ikeja, Lagos','Alausa, Ikeja','A peaceful and practical home base with leafy views, comfortable bedrooms and easy access around Ikeja.',62000,2,1,4,'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85','["Wi-Fi","Workspace","Air conditioning","Parking"]',0],
['Skyline Penthouse','Ikoyi, Lagos','Bourdillon Road, Ikoyi','An elegant top-floor escape with generous spaces, city views and premium finishes.',165000,3,3,6,'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85','["Wi-Fi","Pool","Gym","Balcony","Generator"]',1],
['Coastal Hideaway','Oniru, Lagos','Oniru Estate, Lagos','A relaxed apartment for longer stays, with a clean modern feel and quick access to the beach area.',78000,2,2,4,'https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=85','["Wi-Fi","Kitchen","Parking","24/7 security"]',0],
['Maple Two-Bedroom','Yaba, Lagos','Herbert Macaulay Way, Yaba','A bright, comfortable apartment close to technology hubs, universities and local restaurants.',55000,2,1,3,'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1200&q=85','["Wi-Fi","Workspace","Kitchen","Air conditioning"]',0]
];
const insert=db.prepare(`INSERT INTO apartments(title,city,address,description,price,bedrooms,bathrooms,guests,image,amenities,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
const tx=db.transaction(()=>{if(db.prepare('SELECT COUNT(*) n FROM apartments').get().n===0) rows.forEach(r=>insert.run(...r));});
tx(); console.log('Seed complete. Admin: admin@staynest.local / StayNest@2026');
