import { createClient } from '@libsql/client';

const url = import.meta.env.VITE_TURSO_DATABASE_URL;
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error('Turso credentials missing in .env');
}

export const db = createClient({
    url: url || '',
    authToken: authToken || '',
});

export interface UserProfile {
    wallet_address: string;
    username: string;
    level: number;
    total_mass: number;
    max_mass: number;
    kills: number;
    wins: number;
    losses: number;
    owned_skins: string[];
    bio?: string;
    twitter?: string;
    youtube?: string;
}

export async function initSchema() {
    try {
        await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        wallet_address TEXT PRIMARY KEY,
        username TEXT DEFAULT 'Guest',
        level INTEGER DEFAULT 1,
        total_mass INTEGER DEFAULT 0,
        max_mass INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Migration: Add columns if they don't exist
        try { await db.execute("ALTER TABLE users ADD COLUMN max_mass INTEGER DEFAULT 0"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN kills INTEGER DEFAULT 0"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN owned_skins TEXT DEFAULT '[\"default\", \"neon\", \"alien\", \"core\", \"ghost\", \"doge\", \"bunny\", \"alien_face\"]'"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN twitter TEXT DEFAULT ''"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN youtube TEXT DEFAULT ''"); } catch (e) { }

        console.log('Turso schema initialized');
    } catch (error) {
        console.error('Failed to initialize Turso schema:', error);
    }
}

export async function getTopMassPlayers(limit: number = 5): Promise<UserProfile[]> {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM users ORDER BY max_mass DESC LIMIT ?',
            args: [limit],
        });
        return result.rows as unknown as UserProfile[];
    } catch (error) {
        console.error('Error fetching top mass players:', error);
        return [];
    }
}

export async function getTopKillPlayers(limit: number = 5): Promise<UserProfile[]> {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM users ORDER BY kills DESC LIMIT ?',
            args: [limit],
        });
        return result.rows as unknown as UserProfile[];
    } catch (error) {
        console.error('Error fetching top kill players:', error);
        return [];
    }
}

export async function getUserProfile(walletAddress: string): Promise<UserProfile | null> {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM users WHERE wallet_address = ?',
            args: [walletAddress],
        });

        if (result.rows.length > 0) {
            const row = result.rows[0] as unknown as UserProfile & { owned_skins: string };
            return {
                ...row,
                owned_skins: typeof row.owned_skins === 'string' ? JSON.parse(row.owned_skins) : row.owned_skins
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return null;
    }
}

export async function createUserProfile(walletAddress: string, username: string = 'Guest'): Promise<UserProfile | null> {
    try {
        await db.execute({
            sql: 'INSERT INTO users (wallet_address, username) VALUES (?, ?) ON CONFLICT(wallet_address) DO NOTHING',
            args: [walletAddress, username],
        });
        return await getUserProfile(walletAddress);
    } catch (error) {
        console.error('Error creating user profile:', error);
        return null;
    }
}

export async function updateUserProfile(profile: Partial<UserProfile> & { wallet_address: string }) {
    try {
        const fields = Object.keys(profile).filter(k => k !== 'wallet_address');
        if (fields.length === 0) return;

        const setClause = fields.map(f => `${f} = ?`).join(', ');

        const args = fields.map(f => {
            const val = (profile as any)[f];
            return typeof val === 'object' ? JSON.stringify(val) : val;
        }).concat(profile.wallet_address);

        await db.execute({
            sql: `UPDATE users SET ${setClause} WHERE wallet_address = ?`,
            args,
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
    }
}

export async function addOwnedSkin(walletAddress: string, skinId: string) {
    const profile = await getUserProfile(walletAddress);
    if (profile && !profile.owned_skins.includes(skinId)) {
        profile.owned_skins.push(skinId);
        await updateUserProfile({
            wallet_address: walletAddress,
            owned_skins: profile.owned_skins
        });
    }
}
