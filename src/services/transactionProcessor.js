const { BorshCoder, EventParser } = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

const idl = require('../idl/defipoly_program.json');
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || idl.address);
const coder = new BorshCoder(idl);
const eventParser = new EventParser(PROGRAM_ID, coder);

async function parseTransaction(tx) {
  try {
    const signature = tx.transaction.signatures[0];
    const blockTime = tx.blockTime;
    const logs = tx.meta?.logMessages || [];
    
    const events = eventParser.parseLogs(logs);
    
    if (events.length > 0) {
      for (const event of events) {
        const actionData = mapEventToAction(event, signature, blockTime);
        if (actionData) return actionData;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

function mapEventToAction(event, signature, blockTime) {
  const base = { signature, blockTime };
  
  switch (event.name) {
    case 'PropertyBoughtEvent':
      return { ...base, actionType: 'buy', playerAddress: event.data.player.toString(), 
               propertyId: event.data.propertyId, amount: event.data.totalCost?.toNumber(), 
               slots: event.data.slots, success: true };
    
    case 'StealSuccessEvent':
      return { ...base, actionType: 'steal_success', playerAddress: event.data.attacker.toString(),
               propertyId: event.data.propertyId, targetAddress: event.data.target.toString(),
               slots: event.data.slotsStolen, amount: event.data.stealCost?.toNumber(), success: true };
    
    case 'StealFailureEvent':
      return { ...base, actionType: 'steal_failed', playerAddress: event.data.attacker.toString(),
               propertyId: event.data.propertyId, targetAddress: event.data.target.toString(),
               amount: event.data.stealCost?.toNumber(), success: false };
    
    case 'ShieldActivatedEvent':
      return { ...base, actionType: 'shield', playerAddress: event.data.player.toString(),
               propertyId: event.data.propertyId, slots: event.data.slotsShielded,
               amount: event.data.shieldCost?.toNumber(), success: true };
    
    case 'RewardsClaimedEvent':
      return { ...base, actionType: 'claim', playerAddress: event.data.player.toString(),
               amount: event.data.amount?.toNumber(), success: true };
    
    default: return null;
  }
}

module.exports = { parseTransaction };