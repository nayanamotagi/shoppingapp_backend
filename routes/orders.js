const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/abilities');

const router = express.Router();

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Orders router is working!' });
});

// Get all orders (with CASL filtering)
router.get('/', auth, async (req, res) => {
  try {
    let orders;
    
    if (req.user.role === 'admin') {
      orders = await Order.find().populate('userId', 'name email').populate('items.productId');
    } else if (req.user.role === 'seller') {
      // Seller can only see orders containing their products
      orders = await Order.find({ 'items.sellerId': req.user._id })
        .populate('userId', 'name email')
        .populate('items.productId');
    } else {
      // Customer can only see their own orders
      orders = await Order.find({ userId: req.user._id })
        .populate('userId', 'name email')
        .populate('items.productId');
    }
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Process payment (for online payments) - Must be before /:id route
router.post('/:id/payment', auth, async (req, res) => {
  try {
    console.log('💳 Payment route accessed - Order ID:', req.params.id);
    console.log('💳 User ID:', req.user._id);
    
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns this order
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if payment method is online
    if (order.paymentMethod !== 'online') {
      return res.status(400).json({ message: 'This order is not for online payment' });
    }

    // Check if already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    // Simulate payment processing
    // In a real scenario, this would integrate with payment gateway
    // For student project, we just simulate success
    order.paymentStatus = 'paid';
    order.status = 'processing';
    await order.save();

    console.log('✅ Payment processed successfully');
    res.json({
      success: true,
      message: 'Payment successful',
      order
    });
  } catch (error) {
    console.error('❌ Payment error:', error);
    res.status(500).json({ message: error.message || 'Payment processing failed' });
  }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('items.productId');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions
    if (req.user.role === 'customer' && order.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'seller') {
      const hasProduct = order.items.some(item => item.sellerId.toString() === req.user._id.toString());
      if (!hasProduct) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create order (Customer only)
router.post('/', auth, authorize('create', 'Order'), async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (!paymentMethod || !['online', 'cod'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Payment method is required (online or cod)' });
    }

    // Validate products and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      orderItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        sellerId: product.sellerId
      });

      totalAmount += product.price * item.quantity;

      // Update stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Set payment status based on payment method
    const paymentStatus = paymentMethod === 'cod' ? 'pending' : 'pending';
    const orderStatus = paymentMethod === 'cod' ? 'pending' : 'pending';

    const order = new Order({
      userId: req.user._id,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentStatus,
      status: orderStatus
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status (Admin and Seller)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions based on role
    if (req.user.role === 'customer') {
      return res.status(403).json({ message: 'Customers cannot update order status' });
    }

    // For sellers, check if order contains their products
    if (req.user.role === 'seller') {
      const hasProduct = order.items.some(item => {
        const sellerId = item.sellerId?.toString() || item.sellerId;
        return sellerId === req.user._id.toString();
      });
      
      if (!hasProduct) {
        return res.status(403).json({ message: 'You can only update orders containing your products' });
      }
    }

    // Validate status value
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    order.status = status;
    await order.save();
    
    console.log(`✅ Order ${order._id} status updated to ${status} by ${req.user.role} (${req.user._id})`);
    res.json(order);
  } catch (error) {
    console.error('❌ Error updating order status:', error);
    res.status(500).json({ message: error.message || 'Error updating order status' });
  }
});

module.exports = router;
