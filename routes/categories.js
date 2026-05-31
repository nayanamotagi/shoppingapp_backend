const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/abilities');

const router = express.Router();

// Get all categories with product count
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().populate('createdBy', 'name email').sort({ name: 1 });
    
    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const productCount = await Product.countDocuments({ category: category.name });
        return {
          ...category.toObject(),
          productCount
        };
      })
    );
    
    res.json(categoriesWithCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get category by name
router.get('/:name', async (req, res) => {
  try {
    const categoryName = req.params.name.toLowerCase();
    const category = await Category.findOne({ name: categoryName }).populate('createdBy', 'name email');
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const productCount = await Product.countDocuments({ category: category.name });
    
    res.json({
      ...category.toObject(),
      productCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create category (Seller and Admin)
router.post('/', auth, authorize('create', 'Category'), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ name: name.toLowerCase().trim() });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    
    const category = new Category({
      name: name.toLowerCase().trim(),
      description: description || '',
      icon: icon || '📦',
      createdBy: req.user._id
    });
    
    await category.save();
    await category.populate('createdBy', 'name email');
    
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update category (Admin only, or seller who created it)
router.put('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check permissions: Admin can update any, seller can only update their own
    if (req.user.role !== 'admin' && category.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to update this category' });
    }
    
    const { name, description, icon } = req.body;
    
    if (name && name.toLowerCase().trim() !== category.name) {
      // Check if new name already exists
      const existingCategory = await Category.findOne({ name: name.toLowerCase().trim() });
      if (existingCategory) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
      category.name = name.toLowerCase().trim();
    }
    
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    
    await category.save();
    await category.populate('createdBy', 'name email');
    
    res.json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete category (Admin only, or seller who created it - only if no products use it)
router.delete('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check permissions: Admin can delete any, seller can only delete their own
    if (req.user.role !== 'admin' && category.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You do not have permission to delete this category' });
    }
    
    // Check if category is being used by any products
    const productCount = await Product.countDocuments({ category: category.name });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. It is being used by ${productCount} product(s).` 
      });
    }
    
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
