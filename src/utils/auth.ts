import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';

export class AuthManager {
    private provider: any;
    public walletAddress: string | null = null;

    constructor() {
        this.updateProvider();
    }

    private updateProvider() {
        this.provider = (window as any).solana || (window as any).phantom?.solana || (window as any).solflare;
    }

    public isPWA(): boolean {
        return window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
    }

    async connect(): Promise<string | null> {
        this.updateProvider();
        if (!this.provider) {
            return null;
        }

        try {
            const resp = await this.provider.connect();
            this.walletAddress = resp.publicKey.toString();
            console.log('Connected to Solana:', this.walletAddress);
            return this.walletAddress;
        } catch (err) {
            console.error('Connection failed:', err);
            return null;
        }
    }

    disconnect() {
        if (this.provider) {
            this.provider.disconnect();
            this.walletAddress = null;
        }
    }

    isConnected(): boolean {
        return !!this.walletAddress;
    }

    async purchaseSkin(priceSol: number, destWallet: string): Promise<boolean> {
        if (!this.provider || !this.walletAddress) {
            console.error('Wallet not connected');
            return false;
        }

        try {
            // Using mainnet-beta. Adjust to 'devnet' if needed for testing.
            const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
            const fromPubkey = new PublicKey(this.walletAddress);
            const toPubkey = new PublicKey(destWallet);

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey,
                    toPubkey,
                    lamports: priceSol * LAMPORTS_PER_SOL,
                })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = fromPubkey;

            const { signature } = await this.provider.signAndSendTransaction(transaction);
            await connection.confirmTransaction(signature);

            console.log('Transaction successful, signature:', signature);
            return true;
        } catch (err) {
            console.error('Transaction failed:', err);
            return false;
        }
    }
}

export const auth = new AuthManager();
