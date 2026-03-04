const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'hareeds-secret-key';

// In-memory database (works on Render free tier)
const db = {
  users: [],
  products: [],
  cart: [],
  orders: [],
  orderItems: [],
  addresses: [],
  discounts: []
};

// Seed admin user
const adminExists = db.users.find(u => u.email === 'admin@hareeds.com');
if (!adminExists) {
  db.users.push({
    id: 'admin-' + uuidv4(),
    email: 'admin@hareeds.com',
    password: bcrypt.hashSync('admin123', 10),
    firstName: 'Admin',
    lastName: 'User',
    phone: '',
    isAdmin: true,
    loyaltyPoints: 0,
    createdAt: new Date().toISOString()
  });
  console.log('Admin created: admin@hareeds.com / admin123');
}

// Seed products
if (db.products.length === 0) {
  db.products.push(
    { id: 'prod-' + uuidv4(), title: 'The Clear Quran', author: 'Dr. Mustafa Khattab', description: 'Modern English translation', price: 19.99, originalPrice: 49.99, category: 'quran', stock: 100, isBestseller: true, discount: 60, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Riyad-us-Saliheen', author: 'Imam An-Nawawi', description: 'Hadith collection on ethics', price: 24.99, category: 'hadith', stock: 75, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Lost Islamic History', author: 'Firas Alkhateeb', description: 'Muslim civilization', price: 14.99, category: 'seerah', stock: 50, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'The Sealed Nectar', author: 'Safiur Rahman Mubarakpuri', description: 'Biography of Prophet Muhammad', price: 19.99, originalPrice: 54.99, category: 'seerah', stock: 60, isBestseller: true, discount: 64, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Purification of the Heart', author: 'Hamza Yusuf', description: 'Spiritual diseases and cures', price: 21.99, category: 'aqeedah', stock: 40, isBestseller: true, isActive: true, createdAt: new Date().toISOString() }
  );
}

app.use(cors());
app.use(express.json());

// ROOT ROUTE - THIS MUST BE HERE
app.get('/', (req, res) => res.json({ message: 'Hareeds API is running', status: 'OK' }));

// HEALTH CHECK
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// PRODUCTS
app.get('/api/products', (req, res) => {
  const { category, search, sort } = req.query;
  let products = db.products.filter(p => p.isActive);
  
  if (category) products = products.filter(p => p.category === category);
  if (search) {
    const s = search.toLowerCase();
    products = products.filter(p => p.title.toLowerCase().includes(s) || p.author.toLowerCase().includes(s));
  }
  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  
  res.json({ products, pagination: { total: products.length } });
});

app.get('/api/products/:id', (req, res) => {
  const product = db.products.find(p => p.id === req.params.id && p.isActive);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

app.get('/api/categories', (req, res) => {
  const categories = [...new Set(db.products.map(p => p.category))];
  res.json({ categories });
});

// 404 HANDLER - MUST BE LAST
app.use((req, res) => res.status(404).json({ error: 'Route not found', path: req.path }));

app.listen(PORT, () => console.log(`Hareeds Backend running on port ${PORT}`));
