class App {
    constructor() {
        this.vaultAddress = "0xdF486eDFD71d2d08657feAf584DC85f12fb6dF90";
        this.tokenAddress = "0x6801Ea3423f5B35eF2A1917a87a2Fa0edA53A5A3";

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
            this.setupListeners();

            await this.loadBalances();
            await this.loadMembership();

        } catch (err) {
            console.error("CONNECT ERROR:", err);
            alert(err?.message || "Connection failed");
        }
    }

    setupListeners() {
        if (!window.ethereum) return;

        window.ethereum.on("accountsChanged", async (accounts) => {
            if (accounts.length > 0) {
                this.userAddress = accounts[0];
                await this.loadBalances();
                await this.loadMembership();
            }
        });
    }
    
    // load balances
    async loadBalances() {
        try {
            if (!this.token || !this.vault) return;

            const tokenBal = await this.token.balanceOf(this.userAddress);
            const shares = await this.vault.balanceOf(this.userAddress);

            document.getElementById("tokenBalance").innerText =
                ethers.utils.formatUnits(tokenBal, this.decimals);

            document.getElementById("shareBalance").innerText =
                shares.toString();

        } catch (err) {
            console.error("BALANCE ERROR:", err);
        }
    }

    async loadMembership() {
        try {
            const membership = await this.vault._balanceOfmembershipToken(this.userAddress);

            document.getElementById("membershipStatus").innerText = membership > 0 ? "Member" : "Not a member";
        } catch (err) {
            console.error("MEMBERSHIP ERROR:", err);
        }
    }

    setLoading(state) {
        document.getElementById("depositBtn").disabled = state;
        document.getElementById("withdrawBtn").disabled = state;
    }
    
    // deposit
    async deposit() {
        try {
            if (!this.token || !this.vault) {
                alert("Click Connect first");
                return;
            }

            const input = document.getElementById("amount").value;

            if (!input || isNaN(input) || Number(input) <= 0) {
                alert("Enter valid amount");
                return;
            }

            const amount = ethers.utils.parseUnits(input, this.decimals);

            this.setLoading(true);

            //check allowance
            const allowance = await this.token.allowance(
                this.userAddress, this.vaultAddress
            );

            if (allowance.lt(amount)) {
                const MAX = ethers.MaxUint256;
                const approveTx = await this.token.approve(this.vaultAddress, MAX);
                await approveTx.wait();
            }

            const tx = await this.vault.deposit(amount);
            await tx.wait();

            alert("Deposit Successful!");
            
            await this.loadBalances();
            await this.loadMembership();

        } catch (err) {
            console.error("DEPOSIT ERROR:", err);
            alert(err?.reason || err?.message || "Deposit failed");
        } finally {
            this.setLoading(false);
        }
    }

    // withdraw
    async withdraw() {
        try {
            if (!this.vault) {
                alert("Click Connect first");
                return;
            }

            const input = document.getElementById("amount").value;

            if (!input || isNaN(input) || Number(input) <= 0) {
                alert("Enter valid amount");
                return;
            }

            const shares = ethers.utils.parseUnits(input, this.decimals);

            this.setLoading(true);

            const tx = await this.vault.withdraw(shares);
            await tx.wait();

            alert("Withdraw successful!");
            await this.loadBalances();
            await this.loadMembership();

        } catch (err) {
            console.error("WITHDRAW ERROR:", err);
            alert(err?.reason || err?.message || "Withdraw failed");
        } finally {
            this.setLoading(false);
        }
    }


    async previewWithdraw() {
        try {
            const input = document.getElementById("withdrawShares").value;

            if (!input || isNaN(input) || Number(input) <= 0) {
                document.getElementById("withdrawPreview").innerText = "0";
                return;
            }

            const shares = ethers.utils.parseUnits(input, this.decimals);

            const totalAssets = await this.token.balanceOf(this.vaultAddress);
            const totalSupply = await this.vault.totalSupply();

            const gross = shares.mul(totalAssets).div(totalSupply);

            const feePercent = await this.vault.feePercent();
            const fee = gross.mul(feePercent).div(10000);

            const net = gross.sub(fee);

            document.getElementById("withdrawPreview").innerText =
                ethers.utils.formatUnits(net, this.decimals);

        } catch (err) {
            console.error("PREVIEW ERROR:", err);
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
    document.getElementById("withdrawShares").oninput = () =>
        app.previewWithdraw();
};