import { CONFIG, MAP_DATA } from './config.js';
import { state } from './state.js';

/**
 * Checks if a coordinate is blocked by walls, shop, or map boundaries.
 * Returns true if blocked.
 */
export function checkCollision(x, y) {
    const gx = Math.floor(x);
    const gy = Math.floor(y);

    // 1. Map Boundaries
    if (gy < 0 || gy >= CONFIG.GRID_H || gx < 0 || gx >= CONFIG.GRID_W) return true;

    // 2. Shop Collision (Visual pos: x=3, y=2, w=3, h=2)
    // Occupies grid x=[3,4,5]. We only block the "front" row (y=3) to allow walking behind the roof (y=2).
    if (gx >= 3 && gx <= 5 && gy === 3) return true;

    // 3. Gates (Allow passing through specific spots)
    const gateX = Math.floor(CONFIG.GRID_W / 2);
    const gateY = Math.floor(CONFIG.GRID_H / 2);

    // Check if gates are open
    const gatesOpen = state.gateOpenTime > 0;

    // Bottom Gate (South)
    if (gx === gateX && gy === CONFIG.GRID_H - 1) {
        if (gatesOpen) return false; // Passable if open
        
        // Closed: Allow entering the alcove but stop before exiting (barrier at 50% mark)
        if (y > gy + 0.5) return true;
        return false;
    }

    // Top Gate (North) - Usually a wall in MAP_DATA[0][x], override it here
    if (gx === gateX && gy === 0) {
        if (gatesOpen) {
            // Even if open, the wings usually swing South into the vestibule (y=1).
            // But we must also ensure the player doesn't clip the wall edges in the doorframe itself.
            if (x < gx + 0.2 || x > gx + 0.8) return true;
            return false;
        }
        return true; // Blocked if closed
    }

    // North Vestibule (y=1) - Check for open gate wings blocking the sides
    if (gatesOpen && gx === gateX && gy === 1) {
        // Wings swing south into this tile. Block the sides.
        if (x < gx + 0.25 || x > gx + 0.75) return true;
    }

    // Left/Right Gates (Always open in this logic, or handle similarly if needed)
    if (gy === gateY && (gx === 0 || gx === CONFIG.GRID_W - 1)) return false;

    // 4. Vestibule Pillars (Visual-only walls, allow passing)
    // North Vestibule
    if (gy === 1 && (gx === gateX - 1 || gx === gateX + 1)) return false;
    // South Vestibule
    if (gy === CONFIG.GRID_H - 2 && (gx === gateX - 1 || gx === gateX + 1)) return false;

    // 5. Grid Walls
    return MAP_DATA[gy][gx] === 1;
}

/**
 * Applies a bounce/squash animation to an entity.
 */
export function triggerHit(entity, dx, dy) {
    entity.hitAnim = {
        vx: dx * 0.5, // Direction of hit
        vy: dy * 0.5,
        startTime: Date.now(),
        duration: 500
    };
}

/**
 * Adds a new projectile to the state.
 */
export function spawnProjectile(state, x, y, dx, dy, ownerId) {
    state.projectiles.push({ 
        x, 
        y, 
        dx, 
        dy, 
        ownerId, 
        life: 0.5 // Life in seconds
    });
}

/**
 * Updates all projectiles: movement, wall collision, and entity collision.
 */
export function updateProjectiles(state, dt, localPlayer) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const p = state.projectiles[i];
        p.x += p.dx * CONFIG.PROJECTILE_SPEED * dt;
        p.y += p.dy * CONFIG.PROJECTILE_SPEED * dt;
        p.life -= dt;

        // Wall/Obstacle collision using the shared check logic
        // We check if the center of the bullet hits a wall
        if (checkCollision(p.x, p.y)) {
            p.life = 0;
        }

        // Entity Collision
        if (p.life > 0) {
            const hitRadius = 0.5; // Roughly the character size

            // 1. Check Local Player
            if (p.ownerId !== state.myId) {
                const dx = localPlayer.x - p.x;
                const dy = localPlayer.y - p.y;
                if (dx*dx + dy*dy < hitRadius*hitRadius) {
                    triggerHit(localPlayer, p.dx, p.dy);
                    p.life = 0;
                }
            }

            // 2. Check NPCs
            if (p.life > 0) {
                for (const npc of state.npcs) {
                    const dx = npc.x - p.x;
                    const dy = npc.y - p.y;
                    if (dx*dx + dy*dy < hitRadius*hitRadius) {
                        triggerHit(npc, p.dx, p.dy);
                        p.life = 0;
                        break;
                    }
                }
            }

            // 3. Check Other Players (Peers)
            if (p.life > 0) {
                for (const id in state.players) {
                    if (id === p.ownerId) continue; // Don't hit shooter
                    const target = state.players[id];
                    const dx = target.x - p.x;
                    const dy = target.y - p.y;
                    if (dx*dx + dy*dy < hitRadius*hitRadius) {
                        triggerHit(target, p.dx, p.dy);
                        p.life = 0;
                        break;
                    }
                }
            }
        }

        if (p.life <= 0) state.projectiles.splice(i, 1);
    }
}