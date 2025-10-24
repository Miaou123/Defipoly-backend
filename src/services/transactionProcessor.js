// ============================================
// FILE: src/services/transactionProcessor.js
// COMPLETE VERSION with all event types and proper data extraction
// ============================================

const { BorshCoder, EventParser } = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

const idl = require('../idl/defipoly_program.json');

// Log IDL loading
console.log('📚 [TRANSACTION PROCESSOR] IDL loaded successfully');
console.log(`   - Program ID: ${idl.address}`);
console.log(`   - Events defined: ${idl.events?.length || 0}`);
if (idl.events && idl.events.length > 0) {
  console.log('   - Event names:', idl.events.map(e => e.name).join(', '));
}

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || idl.address);
const coder = new BorshCoder(idl);
const eventParser = new EventParser(PROGRAM_ID, coder);

console.log('✅ [TRANSACTION PROCESSOR] EventParser initialized');

/**
 * Parse transaction from Helius webhook payload
 * Returns action data if successful, null otherwise
 */
async function parseTransaction(tx) {
  try {
    console.log('\n🔍 [PARSE TX] Starting transaction parse...');
    
    // Extract signature
    const signature = tx.transaction?.signatures?.[0];
    if (!signature) {
      console.error('❌ [PARSE TX] No signature found in transaction');
      return null;
    }
    console.log(`📝 [PARSE TX] Signature: ${signature.substring(0, 20)}...`);
    
    // Extract block time
    const blockTime = tx.blockTime;
    console.log(`⏰ [PARSE TX] Block time: ${blockTime}`);
    
    // Extract logs
    const logs = tx.meta?.logMessages || [];
    console.log(`📋 [PARSE TX] Found ${logs.length} log messages`);
    
    if (logs.length === 0) {
      console.error('❌ [PARSE TX] No logs found in transaction');
      return null;
    }

    // Log first few logs for debugging
    console.log('📄 [PARSE TX] First 5 logs:');
    logs.slice(0, 5).forEach((log, i) => {
      console.log(`   ${i + 1}. ${log}`);
    });
    
    // Parse events from logs
    console.log('🔄 [PARSE TX] Parsing events...');
    const eventsGenerator = eventParser.parseLogs(logs);
    const eventsArray = Array.from(eventsGenerator);
    console.log(`🎯 [PARSE TX] Found ${eventsArray.length} events`);
    
    if (eventsArray.length === 0) {
      console.warn('⚠️  [PARSE TX] No events parsed from logs');
      console.log('📋 [PARSE TX] Full logs for debugging:');
      logs.forEach((log, i) => {
        console.log(`   ${i + 1}. ${log}`);
      });
      return null;
    }

    // Log all events found
    eventsArray.forEach((event, i) => {
      console.log(`   Event ${i + 1}: ${event.name}`);
    });
    
    // Map the first valid event to action
    for (const event of eventsArray) {
      console.log(`🔄 [PARSE TX] Mapping event: ${event.name}`);
      console.log(`📦 [PARSE TX] Event data:`, JSON.stringify(event.data, null, 2));
      
      const actionData = mapEventToAction(event, signature, blockTime);
      
      if (actionData) {
        console.log('✅ [PARSE TX] Successfully mapped to action:', actionData.actionType);
        console.log('📦 [PARSE TX] Full action data:', JSON.stringify(actionData, null, 2));
        return actionData;
      } else {
        console.warn(`⚠️  [PARSE TX] mapEventToAction returned null for event: ${event.name}`);
      }
    }
    
    console.warn('⚠️  [PARSE TX] No events could be mapped to actions');
    return null;
    
  } catch (error) {
    console.error('❌ [PARSE TX] Error parsing transaction:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

/**
 * Map Anchor event to game action format
 * Handles both camelCase and snake_case field names
 */
function mapEventToAction(event, signature, blockTime) {
  console.log(`🗺️  [MAP EVENT] Mapping event: ${event.name}`);
  
  const base = { signature, blockTime };
  
  try {
    switch (event.name) {
      // ========== BUY PROPERTY ==========
      case 'PropertyBoughtEvent':
      case 'propertyBoughtEvent':
        console.log('   → Mapping to: buy');
        return { 
          ...base, 
          actionType: 'buy', 
          playerAddress: event.data.player?.toString(), 
          propertyId: event.data.propertyId ?? event.data.property_id,
          amount: event.data.totalCost?.toNumber?.() ?? event.data.total_cost?.toNumber?.(), 
          slots: event.data.slots ?? event.data.slots_bought, 
          success: true,
          metadata: {
            slotsOwned: event.data.slotsOwned ?? event.data.slots_owned,
            totalSlotsOwned: event.data.totalSlotsOwned ?? event.data.total_slots_owned,
            price: event.data.price?.toString()
          }
        };
      
      // ========== SELL PROPERTY ==========
      case 'PropertySoldEvent':
      case 'propertySoldEvent':
        console.log('   → Mapping to: sell');
        return { 
          ...base, 
          actionType: 'sell', 
          playerAddress: event.data.player?.toString(), 
          propertyId: event.data.propertyId ?? event.data.property_id,
          amount: event.data.received?.toNumber?.(), 
          slots: event.data.slots ?? event.data.slots_sold, 
          success: true,
          metadata: {
            sellValuePercent: event.data.sellValuePercent ?? event.data.sell_value_percent,
            daysHeld: event.data.daysHeld ?? event.data.days_held,
            received: event.data.received?.toString()
          }
        };
      
      // ========== STEAL SUCCESS ==========
      case 'StealSuccessEvent':
      case 'stealSuccessEvent':
        console.log('   → Mapping to: steal_success');
        return { 
          ...base, 
          actionType: 'steal_success', 
          playerAddress: event.data.attacker?.toString(),
          propertyId: event.data.propertyId ?? event.data.property_id,
          targetAddress: event.data.target?.toString(),
          slots: event.data.slotsStolen ?? event.data.slots_stolen ?? 1, // Default to 1 if not present
          amount: event.data.stealCost?.toNumber?.() ?? event.data.steal_cost?.toNumber?.(), 
          success: true,
          metadata: {
            targeted: event.data.targeted,
            vrfResult: event.data.vrfResult ?? event.data.vrf_result
          }
        };
      
      // ========== STEAL FAILURE ==========
      case 'StealFailureEvent':
      case 'StealFailedEvent':
      case 'stealFailureEvent':
      case 'stealFailedEvent':
        console.log('   → Mapping to: steal_failed');
        return { 
          ...base, 
          actionType: 'steal_failed', 
          playerAddress: event.data.attacker?.toString(),
          propertyId: event.data.propertyId ?? event.data.property_id,
          targetAddress: event.data.target?.toString(),
          slots: 0, // Failed steals get 0 slots
          amount: event.data.stealCost?.toNumber?.() ?? event.data.steal_cost?.toNumber?.(), 
          success: false,
          metadata: {
            targeted: event.data.targeted,
            vrfResult: event.data.vrfResult ?? event.data.vrf_result
          }
        };
      
      // ========== SHIELD ACTIVATED ==========
      case 'ShieldActivatedEvent':
      case 'shieldActivatedEvent':
        console.log('   → Mapping to: shield');
        return { 
          ...base, 
          actionType: 'shield', 
          playerAddress: event.data.player?.toString(),
          propertyId: event.data.propertyId ?? event.data.property_id,
          slots: event.data.slotsShielded ?? event.data.slots_shielded,
          amount: event.data.cost?.toNumber?.() ?? event.data.shield_cost?.toNumber?.(), 
          success: true,
          metadata: {
            expiry: event.data.expiry?.toString()
          }
        };
      
      // ========== REWARDS CLAIMED ==========
      case 'RewardsClaimedEvent':
      case 'rewardsClaimedEvent':
        console.log('   → Mapping to: claim');
        return { 
          ...base, 
          actionType: 'claim', 
          playerAddress: event.data.player?.toString(),
          amount: event.data.amount?.toNumber?.(), 
          success: true,
          metadata: {
            hoursElapsed: event.data.hoursElapsed ?? event.data.hours_elapsed
          }
        };
      
      default:
        console.warn(`   ⚠️  Unknown event type: ${event.name}`);
        return null;
    }
  } catch (error) {
    console.error(`   ❌ Error mapping event ${event.name}:`, error);
    console.error('   Event data:', JSON.stringify(event.data, null, 2));
    return null;
  }
}

module.exports = { parseTransaction };