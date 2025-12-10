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

    // Helper to check dynamic gate door collision
    const checkDoorCollision = (gx, gy, x, y) => {
        if (!gatesOpen) return true; // Closed = Wall

        // Calculate Openness
        const elapsed = Date.now() - state.gateOpenTime;
        let gateOpenness = Math.min(1, elapsed / 2500);
        gateOpenness = 1 - Math.pow(1 - gateOpenness, 3);
        
        const theta = gateOpenness * (105 * Math.PI / 180);
        
        // Door 1 (Left): Hinge at (gx, gy). Tip roughly at (gx + 0.5*cos(theta), gy + 0.5*sin(theta))
        // We approximate collision by checking if player is close to the "Bar" of the door
        // Since y increases (South) with sin(theta), the door enters the tile.
        
        // Simple Point-Line Distance check?
        // Let's just use a bounding box approach relative to the swing.
        
        const doorLen = 0.55; // Slightly longer than half to overlap
        
        // Left Door Segment
        const lHingeX = gx;
        const lHingeY = gy; // Top of tile relative logic
        const lTipX = lHingeX + doorLen * Math.cos(theta);
        const lTipY = lHingeY + doorLen * Math.sin(theta);
        
        // Right Door Segment
        const rHingeX = gx + 1;
        const rHingeY = gy;
        const rAngle = Math.PI - theta;
        const rTipX = rHingeX + doorLen * Math.cos(rAngle);
        const rTipY = rHingeY + doorLen * Math.sin(rAngle);

        // Distance from point (x,y) to segment (x1,y1)-(x2,y2)
        const distToSegment = (px, py, x1, y1, x2, y2) => {
            const A = px - x1;
            const B = py - y1;
            const C = x2 - x1;
            const D = y2 - y1;
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            if (lenSq !== 0) param = dot / lenSq;
            
            let xx, yy;
            if (param < 0) { xx = x1; yy = y1; }
            else if (param > 1) { xx = x2; yy = y2; }
            else { xx = x1 + param * C; yy = y1 + param * D; }
            
            const dx = px - xx;
            const dy = py - yy;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // If player is within 0.3 of either door, block
        // Note: North gate is at y=0. Door hinges at y=0 (visually top) but physically we collide at y=1 boundary?
        // Actually, logic maps player y to grid.
        // For North Gate (y=0), player is usually at y > 1.
        // But door swings INTO y > 0.
        // So we offset the segment Y by +1 to match the "Bottom of Wall" hinge point?
        // Visually we hinged at Top of Wall. But visual Wall covers Tile 0.
        // So the door physically exists on Tile 0.
        // But with "Open Down", it extends to Tile 1.
        // So we check against (gx, gy + 1) basis? 
        // No, let's use the local tile coords 0..1. 
        // If the player is at y=1.2 (Tile 1), and door swings to y=0.5 (Tile 0), no collision.
        // If door swings to y=1.5 (Tile 1), collision.
        // Our theta logic: sin(105) ~ 0.96. So Tip Y is +0.5 from Hinge.
        // If Hinge is at gy=0. It swings to gy=0.5. (Stays in Tile 0).
        // BUT visuals show it skewing. The transform includes a '1' scale on Y.
        // And 'shear' on X.
        // It does NOT stretch Y. So it stays in Tile 0 vertically?
        // If so, the corridor (Tile 1) is clear.
        // Collision inside Tile 0:
        // If player enters Tile 0 (y < 1), they hit the doors.
        
        // Hinge is at gy.
        // Wait, collision logic uses raw x,y.
        // If I am at x=11.5, y=0.5. I am inside Tile 0.
        // Door is there.
        // Hinge at (11, 0) and (12, 0).
        // Tip at (11 + dx, 0 + dy).
        // Max Y is 0.5.
        // So if I am at y=0.8, I might pass UNDER the door?
        // No, the door is a vertical gate. It blocks the whole height?
        // It's a top-down game. The door is an object on the floor.
        // So yes, simple distance check.
        
        if (distToSegment(x, y, lHingeX, lHingeY, lTipX, lTipY) < 0.3) return true;
        if (distToSegment(x, y, rHingeX, rHingeY, rTipX, rTipY) < 0.3) return true;

        return false;
    };

    // Bottom Gate (South)
    if (gx === gateX && gy === CONFIG.GRID_H - 1) {
        if (checkDoorCollision(gx, gy, x, y)) return true;
        
        // Closed/Open handled by collision check, but checkDoorCollision returns true if hit.
        // If open and clear, returns false.
        
        // Boundary check for void
        if (y > gy + 0.8) return true; // Block walking into void
        return false;
    }

    // Top Gate (North)
    if (gx === gateX && gy === 0) {
        if (checkDoorCollision(gx, gy, x, y)) return true;
        return false; 
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