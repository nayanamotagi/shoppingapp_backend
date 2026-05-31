const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const User = require('./models/User');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/categories', require('./routes/categories'));

// Log registered routes
console.log('📋 Registered API routes:');
console.log('   POST /api/upload/product-image');
console.log('   POST /api/orders/:id/payment');
console.log('   GET  /api/orders');
console.log('   POST /api/orders');

// Connect to MongoDB and Initialize Database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nayanamotagi24_db_user:M8IZrPAcRUR92UWj@cluster0.rlrtdph.mongodb.net/ecommerce?appName=Cluster0';

const initializeDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🔗 Host: ${mongoose.connection.host}`);
    
    // Verify database connection
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    console.log(`📡 Connection State: ${states[dbState]}`);
    
    // Create default admin user if it doesn't exist
    const adminExists = await User.findOne({ role: 'admin', email: 'admin@ecommerce.com' });
    if (!adminExists) {
      const defaultAdmin = new User({
        name: 'Admin User',
        email: 'admin@ecommerce.com',
        password: 'admin123', // Change this password after first login
        role: 'admin'
      });
      await defaultAdmin.save();
      console.log('👑 Default admin user created:');
      console.log('   Email: admin@ecommerce.com');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change the password after first login!');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📚 Collections in database: ${collections.length}`);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize database
initializeDatabase();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}/api`);
});
