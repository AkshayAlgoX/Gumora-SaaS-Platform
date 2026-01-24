import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI!;

async function dump() {
  await mongoose.connect(MONGO_URI);
  
  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  const products = await mongoose.connection.db.collection('products').find({}).toArray();
  
  console.log('--- USERS ---');
  console.log(JSON.stringify(users.map(u => ({ id: u._id, email: u.email, name: u.name })), null, 2));
  
  console.log('--- PRODUCTS ---');
  console.log(JSON.stringify(products.map(p => ({ id: p._id, title: p.title, slug: p.slug, visibility: p.visibility })), null, 2));
  
  await mongoose.disconnect();
}

dump();
