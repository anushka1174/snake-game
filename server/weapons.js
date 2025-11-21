/**
 * Weapon definitions for the snake game
 * Each weapon has different effects and abilities
 */

const WEAPONS = {
  // Speed boost weapon
  speed_boost: {
    name: 'Speed Boost',
    type: 'speed_boost',
    description: 'Temporarily increases snake movement speed',
    duration: 5000, // 5 seconds
    effect: {
      speedMultiplier: 1.5
    },
    color: '#FFD700', // Gold
    icon: '⚡',
    rarity: 'common'
  },
  
  // Shield weapon
  shield: {
    name: 'Shield',
    type: 'shield',
    description: 'Provides temporary invincibility against collisions',
    duration: 3000, // 3 seconds
    effect: {
      invincible: true
    },
    color: '#87CEEB', // Sky blue
    icon: '🛡️',
    rarity: 'rare'
  },
  
  // Laser weapon
  laser: {
    name: 'Laser',
    type: 'laser',
    description: 'Shoots a laser beam that destroys obstacles in a line',
    duration: 0, // Instant use
    effect: {
      range: 10,
      damage: 1
    },
    color: '#FF0000', // Red
    icon: '🔴',
    rarity: 'uncommon'
  },
  
  // Shrink ray
  shrink: {
    name: 'Shrink Ray',
    type: 'shrink',
    description: 'Temporarily reduces the size of other players',
    duration: 4000, // 4 seconds
    effect: {
      targetReduction: 0.5,
      range: 5
    },
    color: '#9932CC', // Dark orchid
    icon: '🔹',
    rarity: 'rare'
  },
  
  // Ghost mode
  ghost: {
    name: 'Ghost Mode',
    type: 'ghost',
    description: 'Allows passing through other snakes without collision',
    duration: 2000, // 2 seconds
    effect: {
      phaseThrough: true
    },
    color: '#DDA0DD', // Plum
    icon: '👻',
    rarity: 'legendary'
  },
  
  // Magnet
  magnet: {
    name: 'Magnet',
    type: 'magnet',
    description: 'Attracts nearby food items automatically',
    duration: 6000, // 6 seconds
    effect: {
      attractionRadius: 3,
      attractionForce: 1
    },
    color: '#DC143C', // Crimson
    icon: '🧲',
    rarity: 'uncommon'
  },
  
  // Time freeze
  freeze: {
    name: 'Time Freeze',
    type: 'freeze',
    description: 'Temporarily freezes all other players',
    duration: 2000, // 2 seconds
    effect: {
      freezeOthers: true
    },
    color: '#00FFFF', // Cyan
    icon: '❄️',
    rarity: 'legendary'
  },
  
  // Food bomb
  food_bomb: {
    name: 'Food Bomb',
    type: 'food_bomb',
    description: 'Creates multiple food items around your position',
    duration: 0, // Instant use
    effect: {
      foodCount: 5,
      spawnRadius: 2
    },
    color: '#32CD32', // Lime green
    icon: '💣',
    rarity: 'uncommon'
  },
  
  // Teleport
  teleport: {
    name: 'Teleport',
    type: 'teleport',
    description: 'Instantly teleport to a random safe location',
    duration: 0, // Instant use
    effect: {
      safeZoneOnly: true
    },
    color: '#8A2BE2', // Blue violet
    icon: '🌀',
    rarity: 'rare'
  },
  
  // Double score
  double_score: {
    name: 'Double Score',
    type: 'double_score',
    description: 'All points earned are doubled for a short time',
    duration: 10000, // 10 seconds
    effect: {
      scoreMultiplier: 2
    },
    color: '#FFD700', // Gold
    icon: '💰',
    rarity: 'rare'
  }
};

/**
 * Weapon rarity definitions
 */
const RARITY_WEIGHTS = {
  common: 50,     // 50% chance
  uncommon: 30,   // 30% chance
  rare: 15,       // 15% chance
  legendary: 5    // 5% chance
};

/**
 * Get a random weapon based on rarity weights
 */
function getRandomWeapon() {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  // Filter weapons by rarity and pick one
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      const weaponsOfRarity = Object.entries(WEAPONS).filter(([, weapon]) => weapon.rarity === rarity);
      if (weaponsOfRarity.length > 0) {
        const randomIndex = Math.floor(Math.random() * weaponsOfRarity.length);
        return weaponsOfRarity[randomIndex][0]; // Return weapon key
      }
    }
  }
  
  // Fallback to speed boost if something goes wrong
  return 'speed_boost';
}

/**
 * Get weapon by type
 */
function getWeapon(type) {
  return WEAPONS[type] || null;
}

/**
 * Get all weapons of a specific rarity
 */
function getWeaponsByRarity(rarity) {
  return Object.entries(WEAPONS)
    .filter(([, weapon]) => weapon.rarity === rarity)
    .reduce((result, [key, weapon]) => {
      result[key] = weapon;
      return result;
    }, {});
}

/**
 * Apply weapon effect to player
 */
function applyWeaponEffect(player, weaponType, gameState) {
  const weapon = WEAPONS[weaponType];
  if (!weapon) return false;
  
  switch (weapon.type) {
    case 'speed_boost':
      // Increase player's movement speed
      player.speedMultiplier = weapon.effect.speedMultiplier;
      setTimeout(() => {
        player.speedMultiplier = 1;
      }, weapon.duration);
      break;
      
    case 'shield':
      // Make player invincible
      player.isInvincible = true;
      setTimeout(() => {
        player.isInvincible = false;
      }, weapon.duration);
      break;
      
    case 'ghost':
      // Allow phasing through other snakes
      player.canPhaseThrough = true;
      setTimeout(() => {
        player.canPhaseThrough = false;
      }, weapon.duration);
      break;
      
    case 'double_score':
      // Double score earning
      player.scoreMultiplier = weapon.effect.scoreMultiplier;
      setTimeout(() => {
        player.scoreMultiplier = 1;
      }, weapon.duration);
      break;
      
    case 'food_bomb':
      // Create food items around player
      if (gameState && gameState.generateFoodAt) {
        const head = player.snake[0];
        for (let i = 0; i < weapon.effect.foodCount; i++) {
          const angle = (2 * Math.PI * i) / weapon.effect.foodCount;
          const x = Math.round(head.x + Math.cos(angle) * weapon.effect.spawnRadius);
          const y = Math.round(head.y + Math.sin(angle) * weapon.effect.spawnRadius);
          gameState.generateFoodAt(x, y);
        }
      }
      break;
      
    case 'teleport':
      // Teleport to random safe location
      if (gameState && gameState.findSafePosition) {
        const safePos = gameState.findSafePosition();
        if (safePos) {
          player.snake[0] = safePos;
        }
      }
      break;
      
    default:
      console.warn(`Unhandled weapon type: ${weapon.type}`);
      return false;
  }
  
  return true;
}

module.exports = {
  WEAPONS,
  RARITY_WEIGHTS,
  getRandomWeapon,
  getWeapon,
  getWeaponsByRarity,
  applyWeaponEffect
};