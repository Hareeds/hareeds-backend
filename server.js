const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'hareeds-secret-key';

// Database
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ 
  users: [], 
  products: [], 
  cart: [], 
  orders: [], 
  orderItems: [],
  addresses: [],
  discounts: []
}).write();

// Create admin user if not exists
const adminExists = db.get('users').find({ email: 'admin@hareeds.com' }).value();
if (!adminExists) {
  db.get('users').push({
    id: 'admin-' + uuidv4(),
    email: 'admin@hareeds.com',
    password: bcrypt.hashSync('admin123', 10),
    firstName: 'Admin',
    lastName: 'User',
    phone: '',
    isAdmin: true,
    loyaltyPoints: 0,
    createdAt: new Date().toISOString()
  }).write();
  console.log('Admin created: admin@hareeds.com / admin123');
}

// Seed products
if (db.get('products').value().length === 0) {
  const products = [
    { id: 'prod-' + uuidv4(), title: 'The Clear Quran', author: 'Dr. Mustafa Khattab', description: 'Modern English translation', price: 19.99, originalPrice: 49.99, category: 'quran', stock: 100, isBestseller: true, discount: 60, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Riyad-us-Saliheen', author: 'Imam An-Nawawi', description: 'Hadith collection on ethics', price: 24.99, category: 'hadith', stock: 75, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Lost Islamic History', author: 'Firas Alkhateeb', description: 'Muslim civilization', price: 14.99, category: 'seerah', stock: 50, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'The Sealed Nectar', author: 'Safiur Rahman Mubarakpuri', description: 'Biography of Prophet Muhammad', price: 19.99, originalPrice: 54.99, category: 'seerah', stock: 60, isBestseller: true, discount: 64, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Purification of the Heart', author: 'Hamza Yusuf', description: 'Spiritual diseases and cures', price: 21.99, category: 'aqeedah', stock: 40, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Fortress of the Muslim', author: "Sa'id Al-Qahtani", description: 'Daily supplications', price: 7.99, category: 'quran', stock: 200, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Tafsir Ibn Kathir', author: 'Ibn Kathir', description: 'Quran commentary', price: 99.99, category: 'quran', stock: 25, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'My First Quran Storybook', author: 'Saniyasnain Khan', description: 'Stories for children', price: 14.99, originalPrice: 22.99, category: 'children', stock: 80, discount: 35, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Stories of the Prophets', author: 'Ibn Kathir', description: 'Prophet stories for kids', price: 18.99, category: 'children', stock: 55, isBestseller: true, isActive: true, createdAt: new Date().toISOString() },
    { id: 'prod-' + uuidv4(), title: 'Sahih al-Bukhari', author: 'Imam Muhammad al-Bukhari', description: 'Authentic hadith collection', price: 199.99, category: 'hadith', stock: 15, isBestseller: true, isActive: true, createdAt: new Date().toISOString() }
  ];
  products.forEach(p => db.get('products').push(p).write());
}

app.use(cors());
app.use(express.json());

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
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
};

// ========== HEALTH ==========
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// ========== AUTHENTICATION ==========
// Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  if (db.get('users').find({ email }).value()) {
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
  db.get('users').push(user).write();
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
  const user = db.get('users').find({ email }).value();
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
  const user = db.get('users').find({ email, isAdmin: true }).value();
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
  const user = db.get('users').find({ id: req.user.userId }).value();
  res.json({ 
    user: { 
      id: user.id, 
      email: user.email, 
      firstName: user.firstName, 
      lastName: user.lastName, 
      phone: user.phone,
      isAdmin: user.isAdmin,
      loyaltyPoints: user.loyaltyPoints 
    } 
  });
});

// Update profile
app.put('/api/auth/profile', auth, (req, res) => {
  const { firstName, lastName, phone } = req.body;
  db.get('users').find({ id: req.user.userId }).assign({ firstName, lastName, phone }).write();
  const user = db.get('users').find({ id: req.user.userId }).value();
  res.json({ 
    message: 'Profile updated successfully',
    user: { id: user.id, email: user.email, firstName, lastName, phone, isAdmin: user.isAdmin, loyaltyPoints: user.loyaltyPoints }
  });
});

// Change password
app.put('/api/auth/password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.get('users').find({ id: req.user.userId }).value();
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  db.get('users').find({ id: req.user.userId }).assign({ password: bcrypt.hashSync(newPassword, 10) }).write();
  res.json({ message: 'Password updated successfully' });
});

// Logout
app.post('/api/auth/logout', auth, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ========== PRODUCTS ==========
// Get all products
app.get('/api/products', (req, res) => {
  const { category, search, sort } = req.query;
  let products = db.get('products').filter({ isActive: true }).value();
  
  if (category) products = products.filter(p => p.category === category);
  if (search) {
    const s = search.toLowerCase();
    products = products.filter(p => p.title.toLowerCase().includes(s) || p.author.toLowerCase().includes(s));
  }
  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  
  res.json({ products, pagination: { total: products.length } });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const product = db.get('products').find({ id: req.params.id, isActive: true }).value();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

// Get bestsellers
app.get('/api/products/bestsellers/all', (req, res) => {
  const products = db.get('products').filter({ isBestseller: true, isActive: true }).value();
  res.json({ products });
});

// Get sale products
app.get('/api/products/sale/all', (req, res) => {
  const products = db.get('products').filter(p => p.discount > 0 && p.isActive).value();
  res.json({ products });
});

// Admin: Get all products
app.get('/api/products/admin/all', auth, adminOnly, (req, res) => {
  res.json({ products: db.get('products').value() });
});

// Admin: Create product
app.post('/api/products', auth, adminOnly, (req, res) => {
  const product = { 
    id: 'prod-' + uuidv4(), 
    ...req.body, 
    isActive: true, 
    rating: 0,
    reviewCount: 0,
    createdAt: new Date().toISOString() 
  };
  db.get('products').push(product).write();
  res.status(201).json({ message: 'Product created successfully', product });
});

// Admin: Update product
app.put('/api/products/:id', auth, adminOnly, (req, res) => {
  db.get('products').find({ id: req.params.id }).assign({ ...req.body, updatedAt: new Date().toISOString() }).write();
  res.json({ message: 'Product updated successfully', product: db.get('products').find({ id: req.params.id }).value() });
});

// Admin: Delete product
app.delete('/api/products/:id', auth, adminOnly, (req, res) => {
  db.get('products').find({ id: req.params.id }).assign({ isActive: false, updatedAt: new Date().toISOString() }).write();
  res.json({ message: 'Product deleted successfully' });
});

// ========== CART ==========
app.get('/api/cart', auth, (req, res) => {
  const items = db.get('cart').filter({ userId: req.user.userId }).value();
  const itemsWithProducts = items.map(item => {
    const product = db.get('products').find({ id: item.productId }).value();
    return { ...item, title: product?.title, price: product?.price, image: product?.image, stock: product?.stock };
  });
  const total = itemsWithProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.json({ items: itemsWithProducts, total, itemCount: items.reduce((s, i) => s + i.quantity, 0) });
});

app.post('/api/cart', auth, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = db.get('products').find({ id: productId, isActive: true }).value();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock < quantity) return res.status(400).json({ error: 'Not enough stock' });
  
  const existing = db.get('cart').find({ userId: req.user.userId, productId }).value();
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > product.stock) return res.status(400).json({ error: 'Not enough stock' });
    db.get('cart').find({ id: existing.id }).assign({ quantity: newQty }).write();
  } else {
    db.get('cart').push({ id: 'cart-' + uuidv4(), userId: req.user.userId, productId, quantity }).write();
  }
  res.json({ message: 'Item added to cart successfully' });
});

app.put('/api/cart/:id', auth, (req, res) => {
  const { quantity } = req.body;
  const cartItem = db.get('cart').find({ id: req.params.id, userId: req.user.userId }).value();
  if (!cartItem) return res.status(404).json({ error: 'Cart item not found' });
  
  if (quantity === 0) {
    db.get('cart').remove({ id: req.params.id }).write();
    return res.json({ message: 'Item removed from cart' });
  }
  
  const product = db.get('products').find({ id: cartItem.productId }).value();
  if (quantity > product.stock) return res.status(400).json({ error: 'Not enough stock' });
  
  db.get('cart').find({ id: req.params.id }).assign({ quantity }).write();
  res.json({ message: 'Quantity updated successfully' });
});

app.delete('/api/cart/:id', auth, (req, res) => {
  db.get('cart').remove({ id: req.params.id, userId: req.user.userId }).write();
  res.json({ message: 'Item removed from cart' });
});

app.delete('/api/cart', auth, (req, res) => {
  db.get('cart').remove({ userId: req.user.userId }).write();
  res.json({ message: 'Cart cleared successfully' });
});

// ========== ORDERS ==========
app.get('/api/orders', auth, (req, res) => {
  const orders = db.get('orders').filter({ userId: req.user.userId }).sortBy('createdAt').reverse().value();
  const ordersWithCount = orders.map(order => {
    const items = db.get('orderItems').filter({ orderId: order.id }).value();
    return { ...order, itemCount: items.reduce((s, i) => s + i.quantity, 0) };
  });
  res.json({ orders: ordersWithCount });
});

app.get('/api/orders/:id', auth, (req, res) => {
  const order = db.get('orders').find({ id: req.params.id, userId: req.user.userId }).value();
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.get('orderItems').filter({ orderId: req.params.id }).value();
  const itemsWithProducts = items.map(item => {
    const product = db.get('products').find({ id: item.productId }).value();
    return { ...item, title: product?.title, author: product?.author, image: product?.image };
  });
  res.json({ order: { ...order, items: itemsWithProducts } });
});

app.post('/api/orders', auth, (req, res) => {
  const { total, subtotal, tax, shipping, discount, shippingAddress, billingAddress, notes } = req.body;
  const cartItems = db.get('cart').filter({ userId: req.user.userId }).value();
  if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  
  for (const item of cartItems) {
    const product = db.get('products').find({ id: item.productId }).value();
    if (!product || item.quantity > product.stock) {
      return res.status(400).json({ error: `Not enough stock for ${product?.title || 'product'}` });
    }
  }
  
  const orderId = 'order-' + uuidv4();
  const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
  
  db.get('orders').push({
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
  }).write();
  
  cartItems.forEach(item => {
    const product = db.get('products').find({ id: item.productId }).value();
    db.get('orderItems').push({
      id: 'item-' + uuidv4(),
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      price: product.price,
      total: product.price * item.quantity
    }).write();
    db.get('products').find({ id: item.productId }).assign({ stock: product.stock - item.quantity }).write();
  });
  
  db.get('cart').remove({ userId: req.user.userId }).write();
  
  const points = Math.floor(total);
  const user = db.get('users').find({ id: req.user.userId }).value();
  db.get('users').find({ id: req.user.userId }).assign({ loyaltyPoints: (user.loyaltyPoints || 0) + points }).write();
  
  res.status(201).json({ message: 'Order created successfully', order: { id: orderId, orderNumber, status: 'pending', total } });
});

app.get('/api/orders/admin/all', auth, adminOnly, (req, res) => {
  const orders = db.get('orders').sortBy('createdAt').reverse().value();
  const ordersWithDetails = orders.map(order => {
    const user = db.get('users').find({ id: order.userId }).value();
    const items = db.get('orderItems').filter({ orderId: order.id }).value();
    return { ...order, email: user?.email, firstName: user?.firstName, lastName: user?.lastName, itemCount: items.reduce((s, i) => s + i.quantity, 0) };
  });
  res.json({ orders: ordersWithDetails });
});

app.put('/api/orders/admin/:id/status', auth, adminOnly, (req, res) => {
  const { status, paymentStatus, shippingStatus, trackingNumber } = req.body;
  const updates = {};
  if (status) updates.status = status;
  if (paymentStatus) updates.paymentStatus = paymentStatus;
  if (shippingStatus) updates.shippingStatus = shippingStatus;
  if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
  updates.updatedAt = new Date().toISOString();
  db.get('orders').find({ id: req.params.id }).assign(updates).write();
  res.json({ message: 'Order status updated successfully' });
});

// ========== ADDRESSES ==========
app.get('/api/addresses', auth, (req, res) => {
  const addresses = db.get('addresses').filter({ userId: req.user.userId }).sortBy(a => -a.isDefault).value();
  res.json({ addresses });
});

app.post('/api/addresses', auth, (req, res) => {
  const { type, firstName, lastName, address1, address2, city, state, postalCode, country, isDefault } = req.body;
  if (!address1 || !city || !postalCode) {
    return res.status(400).json({ error: 'Address, city, and postal code are required' });
  }
  
  if (isDefault) {
    db.get('addresses').filter({ userId: req.user.userId, type: type || 'shipping' }).forEach(a => {
      db.get('addresses').find({ id: a.id }).assign({ isDefault: false }).write();
    });
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
  db.get('addresses').push(address).write();
  res.status(201).json({ message: 'Address created successfully', address });
});

app.put('/api/addresses/:id', auth, (req, res) => {
  const address = db.get('addresses').find({ id: req.params.id, userId: req.user.userId });
  if (!address.value()) return res.status(404).json({ error: 'Address not found' });
  
  if (req.body.isDefault) {
    const type = req.body.type || address.value().type;
    db.get('addresses').filter({ userId: req.user.userId, type }).forEach(a => {
      db.get('addresses').find({ id: a.id }).assign({ isDefault: false }).write();
    });
  }
  
  address.assign(req.body).write();
  res.json({ message: 'Address updated successfully', address: address.value() });
});

app.delete('/api/addresses/:id', auth, (req, res) => {
  db.get('addresses').remove({ id: req.params.id, userId: req.user.userId }).write();
  res.json({ message: 'Address deleted successfully' });
});

// ========== DISCOUNTS ==========
app.get('/api/discounts', auth, adminOnly, (req, res) => {
  res.json({ discounts: db.get('discounts').value() });
});

app.post('/api/discounts/validate', (req, res) => {
  const { code, orderAmount } = req.body;
  const discount = db.get('discounts').find({ code: code?.toUpperCase(), isActive: true }).value();
  
  if (!discount) return res.status(400).json({ error: 'Invalid discount code' });
  
  const now = new Date();
  if (discount.startDate && new Date(discount.startDate) > now) {
    return res.status(400).json({ error: 'Discount not yet active' });
  }
  if (discount.endDate && new Date(discount.endDate) < now) {
    return res.status(400).json({ error: 'Discount expired' });
  }
  if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
    return res.status(400).json({ error: 'Discount usage limit reached' });
  }
  if (orderAmount && orderAmount < discount.minOrderAmount) {
    return res.status(400).json({ error: `Minimum order amount $${discount.minOrderAmount} required` });
  }
  
  res.json({ 
    valid: true, 
    discount: { code: discount.code, type: discount.type, value: discount.value, maxDiscountAmount: discount.maxDiscountAmount }
  });
});

app.post('/api/discounts', auth, adminOnly, (req, res) => {
  const { code, type, value, minOrderAmount, maxDiscountAmount, usageLimit, startDate, endDate } = req.body;
  if (db.get('discounts').find({ code: code?.toUpperCase() }).value()) {
    return res.status(409).json({ error: 'Discount code already exists' });
  }
  const discount = {
    id: 'disc-' + uuidv4(),
    code: code.toUpperCase(),
    type: type || 'percentage',
    value,
    minOrderAmount: minOrderAmount || 0,
    maxDiscountAmount: maxDiscountAmount || null,
    usageLimit: usageLimit || null,
    usageCount: 0,
    startDate: startDate || null,
    endDate: endDate || null,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  db.get('discounts').push(discount).write();
  res.status(201).json({ message: 'Discount created successfully', discount });
});

app.listen(PORT, () => console.log(`Hareeds Backend running on port ${PORT}`));