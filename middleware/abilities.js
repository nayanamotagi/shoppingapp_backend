const { AbilityBuilder, Ability } = require('@casl/ability');

function defineAbilitiesFor(user) {
  const { can, cannot, build } = new AbilityBuilder(Ability);

  if (!user) {
    // Guest user - can only read products
    can('read', 'Product');
    return build();
  }

  if (user.role === 'admin') {
    // Admin can manage everything
    can('manage', 'all');
    // Explicitly define permissions for admin
    can('read', 'User');
    can('update', 'User');
    can('delete', 'User');
    can('create', 'Product');
    can('read', 'Product');
    can('update', 'Product');
    can('delete', 'Product');
  } else if (user.role === 'seller') {
    // Seller can create products
    can('create', 'Product');
    
    // Seller can read all products
    can('read', 'Product');
    
    // Seller can update/delete only their own products
    can('update', 'Product', { sellerId: user._id.toString() });
    can('delete', 'Product', { sellerId: user._id.toString() });
    
    // Seller can create categories
    can('create', 'Category');
    can('read', 'Category');
    
    // Seller can read orders related to their products
    can('read', 'Order', { 'items.sellerId': user._id.toString() });
    
    // Seller can update order status for their products
    can('update', 'Order', { 'items.sellerId': user._id.toString() });
  } else if (user.role === 'customer') {
    // Customer can read products
    can('read', 'Product');
    
    // Customer can read categories
    can('read', 'Category');
    
    // Customer can create orders
    can('create', 'Order');
    
    // Customer can read their own orders
    can('read', 'Order', { userId: user._id.toString() });
  }

  return build();
}

const authorize = (action, subject) => {
  return (req, res, next) => {
    const ability = defineAbilitiesFor(req.user);
    
    if (ability.can(action, subject)) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action' });
    }
  };
};

module.exports = { defineAbilitiesFor, authorize };
