import { useState, useEffect } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { generateImageWithPollinations, uploadToIPFS, uploadMetadata } from './services/openrouter';
import './App.css';

const REACT_APP_CONTRACT_ADDRESS = "0x2a789dd2c7b84bd55dbde9b635b16ce493dafeb2";

const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "string", "name": "tokenURI_", "type": "string" }
    ],
    "name": "safeMint",
    "outputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

function App() {
  const [prompt, setPrompt] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [tokenURI, setTokenURI] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // FIXED: Enhanced notification system
  const addNotification = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    const notification = { 
      id, 
      message, 
      type, 
      timestamp: Date.now(),
      removing: false 
    };
    
    setNotifications(prev => {
      // Remove any existing notification with the same message to prevent duplicates
      const filtered = prev.filter(n => n.message !== message);
      // Add new notification to the end (will appear at top)
      return [...filtered, notification];
    });
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id) => {
    // First mark as removing for exit animation
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, removing: true } : n)
    );
    
    // Then actually remove after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  };

  const clearAllNotifications = () => {
    // Mark all as removing first
    setNotifications(prev => prev.map(n => ({ ...n, removing: true })));
    // Then clear all after animation
    setTimeout(() => {
      setNotifications([]);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function connectWallet() {
    if (!window.ethereum) {
      addNotification("Please install MetaMask!", 'error');
      return;
    }
    
    try {
      addNotification("Connecting to wallet...", 'info');
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        addNotification("Switching to Sepolia network...", 'info');
        try {
          await provider.send("wallet_switchEthereumChain", [{ chainId: "0xaa36a7" }]);
        } catch (switchError) {
          if (switchError.code === 4902) {
            await provider.send("wallet_addEthereumChain", [{
              chainId: "0xaa36a7",
              chainName: "Sepolia Test Network",
              nativeCurrency: { name: "SepoliaETH", symbol: "SEP", decimals: 18 },
              rpcUrls: ["https://sepolia.infura.io/v3/"],
              blockExplorerUrls: ["https://sepolia.etherscan.io/"]
            }]);
          }
        }
      }
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      addNotification(`Wallet connected: ${address.slice(0,6)}...${address.slice(-4)}`, 'success');
    } catch (error) {
      addNotification(`Connection failed: ${error.message}`, 'error');
    }
  }

  async function getContract() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(REACT_APP_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      addNotification('Please enter a prompt!', 'error');
      return;
    }

    setLoading(true);
    addNotification('Generating image with Pollinations AI...', 'info');
    
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    
    setImagePreview(null);
    setTokenURI(null);
    setTxHash(null);

    try {
      const result = await generateImageWithPollinations(prompt);
      const { display_url, blob } = result;
      
      if (display_url) {
        setImagePreview(display_url);
        addNotification('Image generated successfully!', 'success');
      }

      addNotification('Uploading to IPFS...', 'info');
      const imageCID = await uploadToIPFS(blob, 'generated-ai-art.png');
      
      const metadata = {
        name: "AI Generated NFT",
        description: `Generated with Pollinations AI: "${prompt}"`,
        image: `ipfs://${imageCID}`,
        attributes: [
          { trait_type: "Model", value: "Pollinations AI" },
          { trait_type: "Created", value: new Date().toISOString() },
          { trait_type: "Prompt", value: prompt }
        ]
      };

      const metadataCID = await uploadMetadata(metadata);
      setTokenURI(`ipfs://${metadataCID}`);
      addNotification('Ready to mint NFT!', 'success');

    } catch (error) {
      console.error('Generation error:', error);
      addNotification(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleMint() {
    if (!tokenURI) return;
    if (!walletAddress) {
      addNotification('Connect wallet first!', 'error');
      return;
    }

    setLoading(true);
    addNotification('Minting NFT...', 'info');

    try {
      const contract = await getContract();
      const tx = await contract.safeMint(walletAddress, tokenURI);
      setTxHash(tx.hash);
      addNotification('Transaction sent! Waiting for confirmation...', 'info');

      await tx.wait();
      addNotification('🎉 NFT Minted Successfully!', 'success');

    } catch (error) {
      console.error('Minting error:', error);
      addNotification(`Minting failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="App">
      {/* FIXED: Notification Container with proper stacking */}
      <div className="notification-container">
        {notifications.map((notification, index) => (
          <div 
            key={notification.id}
            className={`notification notification-${notification.type} ${
              notification.removing ? 'notification-removing' : 'notification-entering'
            }`}
            style={{ 
              '--delay': `${index * 0.1}s`,
              '--index': index
            }}
          >
            <div className="notification-content">
              <div className="notification-icon">
                {notification.type === 'success' && '✅'}
                {notification.type === 'error' && '❌'}
                {notification.type === 'info' && 'ℹ️'}
              </div>
              <span className="notification-message">{notification.message}</span>
            </div>
            <button 
              className="notification-close"
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
              type="button"
            >
              ×
            </button>
            <div className="notification-progress"></div>
          </div>
        ))}
        
        {/* Clear all button when multiple notifications */}
        {notifications.length > 3 && (
          <button 
            className="clear-all-btn"
            onClick={clearAllNotifications}
            type="button"
          >
            Clear All ({notifications.length})
          </button>
        )}
      </div>

      <header className="App-header">
        <h1>🤖 AI NFT Minter</h1>
        <p>Generate images with Pollinations AI and mint as NFTs</p>
      </header>

      <div className="container">
        {/* Wallet Connection */}
        <div className="wallet-section">
          {!walletAddress ? (
            <button onClick={connectWallet} className="connect-btn">
              Connect Wallet
            </button>
          ) : (
            <div className="wallet-info">
              ✅ Connected: {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>

        {/* Main Content - Side by Side */}
        <div className="main-content">
          {/* Left Panel - Input & Controls */}
          <div className="left-panel">
            <div className="input-section">
              <label htmlFor="prompt">Enter your prompt:</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate... (e.g., 'A futuristic cityscape with neon lights')"
                rows={6}
                disabled={loading}
              />
            </div>

            <div className="button-section">
              <button 
                onClick={handleGenerate} 
                disabled={loading || !prompt.trim()}
                className="generate-btn"
              >
                {loading ? 'Generating...' : 'Generate Image'}
              </button>

              <button 
                onClick={handleMint} 
                disabled={loading || !tokenURI || !walletAddress}
                className="mint-btn"
              >
                {loading ? 'Minting...' : 'Mint NFT'}
              </button>
            </div>

            {/* Transaction Hash */}
            {txHash && (
              <div className="transaction">
                <strong>Transaction Hash:</strong>
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txHash}
                </a>
              </div>
            )}
          </div>

          {/* Right Panel - Image Preview */}
          <div className="right-panel">
            {imagePreview ? (
              <div className="image-preview">
                <h3>Generated Image</h3>
                <img 
                  src={imagePreview} 
                  alt="Generated artwork"
                  onError={(e) => {
                    console.error('Image failed to load:', e);
                    addNotification('Image failed to load, but NFT data is ready', 'error');
                  }}
                />
              </div>
            ) : (
              <div className="image-placeholder">
                <div className="placeholder-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3>Image Preview</h3>
                <p>Your generated image will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="info">
          <h4>How it works:</h4>
          <ol>
            <li>Connect your wallet to Sepolia testnet</li>
            <li>Enter a creative prompt describing your desired image</li>
            <li>Click "Generate Image" to create AI artwork with Pollinations AI</li>
            <li>Review the generated image in the preview panel</li>
            <li>Click "Mint NFT" to create your NFT on the blockchain</li>
          </ol>
          <p><strong>Contract Address:</strong> {REACT_APP_CONTRACT_ADDRESS}</p>
        </div>
      </div>
    </div>
  );
}

export default App;
