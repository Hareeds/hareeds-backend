const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'hareeds-secret-key';

// In-memory database
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

// Root route
app.get('/', (req, res) => res.json({ message: 'Hareeds API is running', status: 'OK' }));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
};

// ========== AUTH ==========
// Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  if (db.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const user = {
    id: 'user-' + uuidv4(),
    email,
    password: bcrypt.hashSync(password, 10),
    firstName: firstName || '',
    lastName: lastName || '',
    phone: phone || '',
    isAdmin: false,
    loyaltyPoints: 0,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: false }, JWT_SECRET);
  res.status(201).json({ 
    message: 'User registered successfully',
    user: { id: user.id, email, firstName, lastName, phone, isAdmin: false, loyaltyPoints: 0 }, 
    token 
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET);
  res.json({ 
    message: 'Login successful',
    user: { id: user.id, email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, isAdmin: user.isAdmin, loyaltyPoints: user.loyaltyPoints }, 
    token 
  });
});

// Admin Login
app.post('/api/auth/admin/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email && u.isAdmin === true);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: true }, JWT_SECRET);
  res.json({ 
    message: 'Admin login successful',
    user: { id: user.id, email, firstName: user.firstName, lastName: user.lastName, isAdmin: true }, 
    token 
  });
});

// Get current user
app.get('/api/auth/me', auth, (req, res) => {
  const user = db.users.find(u => u.id === req.user.userId);
  res.json({ 
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, isAdmin: user.isAdmin, loyaltyPoints: user.loyaltyPoints }
  });
});

// ========== PRODUCTS ==========
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

// ========== CART ==========
app.get('/api/cart', auth, (req, res) => {
  const items = db.cart.filter(c => c.userId === req.user.userId);
  const itemsWithProducts = items.map(item => {
    const product = db.products.find(p => p.id === item.productId);
    return { ...item, title: product?.title, price: product?.price, image: product?.image, stock: product?.stock };
  });
  const total = itemsWithProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ items: itemsWithProducts, total, itemCount: items.reduce((s, i) => s + i.quantity, 0) });
});

app.post('/api/cart', auth, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = db.products.find(p => p.id === productId && p.isActive);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock < quantity) return res.status(400).json({ error: 'Not enough stock' });
  
  const existing = db.cart.find(c => c.userId === req.user.userId && c.productId === productId);
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > product.stock) return res.status(400).json({ error: 'Not enough stock' });
    existing.quantity = newQty;
  } else {
    db.cart.push({ id: 'cart-' + uuidv4(), userId: req.user.userId, productId, quantity });
  }
  res.json({ message: 'Item added to cart successfully' });
});

app.put('/api/cart/:id', auth, (req, res) => {
  const { quantity } = req.body;
  const cartItem = db.cart.find(c => c.id === req.params.id && c.userId === req.user.userId);
  if (!cartItem) return res.status(404).json({ error: 'Cart item not found' });
  
  if (quantity === 0) {
    db.cart = db.cart.filter(c => c.id !== req.params.id);
    return res.json({ message: 'Item removed from cart' });
  }
  
  const product = db.products.find(p => p.id === cartItem.productId);
  if (quantity > product.stock) return res.status(400).json({ error: 'Not enough stock' });
  
  cartItem.quantity = quantity;
  res.json({ message: 'Quantity updated successfully' });
});

app.delete('/api/cart/:id', auth, (req, res) => {
  db.cart = db.cart.filter(c => c.id !== req.params.id && c.userId === req.user.userId);
  res.json({ message: 'Item removed from cart' });
});

app.delete('/api/cart', auth, (req, res) => {
  db.cart = db.cart.filter(c => c.userId !== req.user.userId);
  res.json({ message: 'Cart cleared successfully' });
});

// ========== ORDERS ==========
app.get('/api/orders', auth, (req, res) => {
  const orders = db.orders.filter(o => o.userId === req.user.userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ orders });
});

app.post('/api/orders', auth, (req, res) => {
  const { total, subtotal, tax, shipping, discount, shippingAddress, billingAddress, notes } = req.body;
  const cartItems = db.cart.filter(c => c.userId === req.user.userId);
  if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  
  for (const item of cartItems) {
    const product = db.products.find(p => p.id === item.productId);
    if (!product || item.quantity > product.stock) {
      return res.status(400).json({ error: `Not enough stock for ${product?.title || 'product'}` });
    }
  }
  
  const orderId = 'order-' + uuidv4();
  const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
  
  db.orders.push({
    id: orderId,
    userId: req.user.userId,
    orderNumber,
    status: 'pending',
    paymentStatus: 'pending',
    shippingStatus: 'pending',
    total,
    subtotal: subtotal || total,
    tax: tax || 0,
    shipping: shipping || 0,
    discount: discount || 0,
    shippingAddress: JSON.stringify(shippingAddress),
    billingAddress: JSON.stringify(billingAddress || shippingAddress),
    notes: notes || '',
    trackingNumber: '',
    createdAt: new Date().toISOString()
  });
  
  cartItems.forEach(item => {
    const product = db.products.find(p => p.id === item.productId);
    db.orderItems.push({
      id: 'item-' + uuidv4(),
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      price: product.price,
      total: product.price * item.quantity
    });
    product.stock -= item.quantity;
  });
  
  db.cart = db.cart.filter(c => c.userId !== req.user.userId);
  
  const user = db.users.find(u => u.id === req.user.userId);
  user.loyaltyPoints = (user.loyaltyPoints || 0) + Math.floor(total);
  
  res.status(201).json({ message: 'Order created successfully', order: { id: orderId, orderNumber, status: 'pending', total } });
});

// ========== ADDRESSES ==========
app.get('/api/addresses', auth, (req, res) => {
  const addresses = db.addresses.filter(a => a.userId === req.user.userId).sort((a, b) => b.isDefault - a.isDefault);
  res.json({ addresses });
});

app.post('/api/addresses', auth, (req, res) => {
  const { type, firstName, lastName, address1, address2, city, state, postalCode, country, isDefault } = req.body;
  if (!address1 || !city || !postalCode) {
    return res.status(400).json({ error: 'Address, city, and postal code are required' });
  }
  
  if (isDefault) {
    db.addresses.filter(a => a.userId === req.user.userId && a.type === (type || 'shipping')).forEach(a => a.isDefault = false);
  }
  
  const address = {
    id: 'addr-' + uuidv4(),
    userId: req.user.userId,
    type: type || 'shipping',
    firstName: firstName || '',
    lastName: lastName || '',
    address1,
    address2: address2 || '',
    city,
    state: state || '',
    postalCode,
    country: country || 'USA',
    isDefault: isDefault || false,
    createdAt: new Date().toISOString()
  };
  db.addresses.push(address);
  res.status(201).json({ message: 'Address created successfully', address });
});

// ========== 404 HANDLER ==========
app.use((req, res) => res.status(404).json({ error: 'Route not found', path: req.path }));

app.listen(PORT, () => console.log(`Hareeds Backend running on port ${PORT}`));
