const validateWallet = (req, res, next) => {
  const wallet = req.params.wallet || req.body.wallet;
  
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  // Basic wallet validation - should be a base58 string of appropriate length
  if (typeof wallet !== 'string' || wallet.length < 32 || wallet.length > 44) {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }
  
  next();
};

const validateActionData = (req, res, next) => {
  const { txSignature, actionType, playerAddress, blockTime } = req.body;
  
  if (!txSignature || !actionType || !playerAddress || !blockTime) {
    return res.status(400).json({ 
      error: 'Missing required fields: txSignature, actionType, playerAddress, blockTime' 
    });
  }
  
  const validActionTypes = [
    'buy', 'sell', 'steal_success', 'steal_failed', 'claim', 'shield'
  ];
  
  if (!validActionTypes.includes(actionType)) {
    return res.status(400).json({ 
      error: `Invalid action type. Must be one of: ${validActionTypes.join(', ')}` 
    });
  }
  
  next();
};

const validateSetId = (req, res, next) => {
  const setId = parseInt(req.params.setId);
  
  if (isNaN(setId) || setId < 0 || setId > 7) {
    return res.status(400).json({ error: 'Invalid setId. Must be between 0 and 7' });
  }
  
  next();
};

const validatePropertyId = (req, res, next) => {
  const propertyId = parseInt(req.params.propertyId);
  
  if (isNaN(propertyId) || propertyId < 0 || propertyId > 21) {
    return res.status(400).json({ error: 'Invalid propertyId. Must be between 0 and 21' });
  }
  
  next();
};

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit);
  const offset = parseInt(req.query.offset);
  
  if (limit && (isNaN(limit) || limit < 1 || limit > 200)) {
    return res.status(400).json({ error: 'Invalid limit. Must be between 1 and 200' });
  }
  
  if (offset && (isNaN(offset) || offset < 0)) {
    return res.status(400).json({ error: 'Invalid offset. Must be 0 or greater' });
  }
  
  next();
};

module.exports = {
  validateWallet,
  validateActionData,
  validateSetId,
  validatePropertyId,
  validatePagination
};