const express = require('express');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/abilities');
const { accessibleBy } = require('@casl/mongoose');

const router = express.Router();

// Get all products (with CASL filtering)
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().populate('sellerId', 'name email');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    // Validate MongoDB ObjectId format
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    const product = await Product.findById(req.params.id).populate('sellerId', 'name email');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    res.status(500).json({ message: error.message || 'Error fetching product' });
  }
});

// Create product (Seller and Admin)
router.post('/', auth, authorize('create', 'Product'), async (req, res) => {
  try {
    // Allow admin to specify sellerId, or use current user as seller
    const sellerId = req.body.sellerId && req.user.role === 'admin' 
      ? req.body.sellerId 
      : req.user._id;
    
    const sellerName = req.body.sellerName && req.user.role === 'admin'
      ? req.body.sellerName
      : req.user.name;

    const product = new Product({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      image: req.body.image,
      category: req.body.category,
      stock: req.body.stock,
      sellerId: sellerId,
      sellerName: sellerName
    });
    
    await product.save();
    
    // Populate seller info for response
    await product.populate('sellerId', 'name email');
    
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update product (Seller - own products only, Admin - all products)
router.put('/:id', auth, authorize('update', 'Product'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if seller can update (for sellers, this is already checked by CASL)
    if (req.user.role === 'seller' && product.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only update your own products' });
    }

    Object.assign(product, req.body);
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete product (Seller - own products only, Admin - all products)
router.delete('/:id', auth, authorize('delete', 'Product'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if seller can delete (for sellers, this is already checked by CASL)
    if (req.user.role === 'seller' && product.sellerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own products' });
    }

    await product.deleteOne();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
