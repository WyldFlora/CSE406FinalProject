class App {
    constructor() {
        this.vaultAddress = "0xCFeE6FF691e583D28Ae525219f77Ff0C68F634b2";
        this.tokenAddress = "0x21147AE330eA5000918036b5117636fB5e926970";

        this.vaultAbiLocation = "./Vault.json";
        this.tokenAbiLocation = "./Token.json";

        this.vaultABI = null;
        this.tokenABI = null;

        this.signer = null;
        this.vault = null;
        this.token = null;

        this.userAddress = null;
        this.decimals = 18;
    }

    // load abi
    async loadABI() {
        const vaultRes = await fetch(this.vaultAbiLocation);
        const vaultData = await vaultRes.json();

        const tokenRes = await fetch(this.tokenAbiLocation);
        const tokenData = await tokenRes.json();

        this.vaultABI = Array.isArray(vaultData) ? vaultData : vaultData.abi;
        this.tokenABI = Array.isArray(tokenData) ? tokenData : tokenData.abi;

        if (!Array.isArray(this.vaultABI)) {
            throw new Error("Vault ABI invalid");
        }

        if (!Array.isArray(this.tokenABI)) {
            throw new Error("Token ABI invalid");
        }

        console.log("ABIs loaded");
    }

    // connect wallet & contracts
    async connectMetaMaskAndContract() {
        try {
            if (!window.ethereum) {
                alert("Install MetaMask");
                return;
            }

            await this.loadABI();

            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);

            this.signer = provider.getSigner();
            this.userAddress = await this.signer.getAddress();

            // create contracts
            this.vault = new ethers.Contract(
                this.vaultAddress,
                this.vaultABI,
                this.signer
            );

            this.token = new ethers.Contract(
                this.tokenAddress,
                this.tokenABI,
                this.signer
            );

            // HARD CHECK (prevents null crashes)
            if (!this.vault || !this.token) {
                throw new Error("Contract initialization failed");
            }

            try {
                this.decimals = await this.token.decimals();
            } catch {
                this.decimals = 18;
            }

            console.log("Connected:", this.userAddress);

            document.getElementById("overlay").style.display = "none";

            await this.loadBalances();

        } catch (err) {
            console.error("CONNECT ERROR:", err);
            alert(err?.message || "Connection failed");
        }
    }

    // load balances
    async loadBalances() {
        try {
            if (!this.token || !this.vault) return;

            const tokenBal = await this.token.balanceOf(this.userAddress);
            const shares = await this.vault.shares(this.userAddress);

            document.getElementById("tokenBalance").innerText =
                ethers.utils.formatUnits(tokenBal, this.decimals);

            document.getElementById("shareBalance").innerText =
                shares.toString();

        } catch (err) {
            console.error("BALANCE ERROR:", err);
        }
    }

    
    // deposit
    async deposit() {
        try {
            if (!this.token || !this.vault) {
                alert("Click Connect first");
                return;
            }

            const amount = document.getElementById("amount").value;

            if (!amount || isNaN(amount) || Number(amount) <= 0) {
                alert("Enter valid amount");
                return;
            }

            const parsed = ethers.utils.parseUnits(amount, this.decimals);

            console.log("Depositing:", amount);

            
            await (await this.token.approve(this.vaultAddress, 0)).wait();
            await (await this.token.approve(this.vaultAddress, parsed)).wait();

            const tx = await this.vault.deposit(parsed);
            await tx.wait();

            alert("Deposit successful!");
            await this.loadBalances();

        } catch (err) {
            console.error("DEPOSIT ERROR:", err);
            alert(err?.reason || err?.message || "Deposit failed");
        }
    }

    // withdraw
    async withdraw() {
        try {
            if (!this.vault) {
                alert("Click Connect first");
                return;
            }

            const amount = document.getElementById("amount").value;

            if (!amount || isNaN(amount) || Number(amount) <= 0) {
                alert("Enter valid amount");
                return;
            }

            const parsed = ethers.utils.parseUnits(amount, this.decimals);

            const tx = await this.vault.withdraw(parsed);
            await tx.wait();

            alert("Withdraw successful!");
            await this.loadBalances();

        } catch (err) {
            console.error("WITHDRAW ERROR:", err);
            alert(err?.reason || err?.message || "Withdraw failed");
        }
    }
}

// init
const app = new App();

window.onload = () => {
    document.getElementById("connectBtn").onclick = () =>
        app.connectMetaMaskAndContract();

    document.getElementById("depositBtn").onclick = () =>
        app.deposit();

    document.getElementById("withdrawBtn").onclick = () =>
        app.withdraw();
};