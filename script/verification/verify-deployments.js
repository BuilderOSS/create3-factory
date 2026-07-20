const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Input validation helpers
function isValidRpcUrl(url) {
    try {
        const parsed = new URL(url);
        // Only allow http/https protocols
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function isValidEthereumAddress(address) {
    // Ethereum address: 0x followed by 40 hexadecimal characters
    return /^0x[0-9a-fA-F]{40}$/.test(address);
}

// Helper to make JSON-RPC request without shell commands
async function getBytecode(rpc, address) {
    // Validate inputs to prevent injection
    if (!isValidRpcUrl(rpc)) {
        throw new Error(`Invalid RPC URL: ${rpc}`);
    }

    if (!isValidEthereumAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
    }

    const rpcUrl = new URL(rpc);
    const protocol = rpcUrl.protocol === 'https:' ? https : http;

    const postData = JSON.stringify({
        method: 'eth_getCode',
        params: [address, 'latest'],
        id: 1,
        jsonrpc: '2.0'
    });

    const options = {
        hostname: rpcUrl.hostname,
        port: rpcUrl.port || (rpcUrl.protocol === 'https:' ? 443 : 80),
        path: rpcUrl.pathname + rpcUrl.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = protocol.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.error) {
                        reject(new Error(`RPC error: ${JSON.stringify(response.error)}`));
                    } else {
                        resolve(response.result || '0x');
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse JSON response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`HTTP request failed: ${error.message}`));
        });

        req.write(postData);
        req.end();
    });
}

// Helper to get bytecode from compiled contract JSON
function getCompiledBytecode() {
    try {
        const contractPath = path.join(__dirname, '../../out/CREATE3Factory.sol/CREATE3Factory.json');
        const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        return contractJson.deployedBytecode.object;
    } catch (error) {
        console.error('Error reading compiled contract bytecode:', error);
        return null;
    }
}


// Get RPC URL for a specific chain
function getRpcUrl(chainId) {
    const chainMapping = {
        1: process.env.MAINNET_RPC_URL,
        5: process.env.GOERLI_RPC_URL,
        42161: process.env.ARBITRUM_RPC_URL,
        421613: process.env.ARBITRUM_GOERLI_RPC_URL,
        10: process.env.OPTIMISM_RPC_URL,
        137: process.env.POLYGON_RPC_URL,
        43114: process.env.AVALANCHE_RPC_URL,
        250: process.env.FANTOM_RPC_URL,
        56: process.env.BINANCE_RPC_URL,
        100: process.env.GNOSIS_RPC_URL,
        11155111: process.env.SEPOLIA_RPC_URL,
        8453: process.env.BASE_RPC_URL,
        84532: process.env.BASE_SEPOLIA_RPC_URL,
        81457: process.env.BLAST_RPC_URL,
        17000: process.env.HOLESKY_RPC_URL,
        80094: process.env.BERA_RPC_URL,
        252: process.env.FRAXTAL_RPC_URL,
        2522: process.env.FRAXTAL_TESTNET_RPC_URL,
        43111: process.env.HEMI_RPC_URL,
        167000: process.env.TAIKO_RPC_URL,
        57073: process.env.INK_RPC_URL,
        5000: process.env.MANTLE_RPC_URL,
        534352: process.env.SCROLL_RPC_URL,
        // Add other chains as needed
    };
    
    return chainMapping[chainId];
}

// Main function to verify all deployments
async function main() {
    const deploymentsDir = path.join(__dirname, '../../deployments');
    const deploymentFiles = fs.readdirSync(deploymentsDir)
        .filter(file => file.endsWith('.json'));
    
    console.log(`Found ${deploymentFiles.length} deployment files to verify.`);
    
    for (const file of deploymentFiles) {
        try {
            const filePath = path.join(deploymentsDir, file);
            const deployment = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            const { chainid, CREATE3Factory } = deployment;
            const rpcUrl = getRpcUrl(chainid);
            
            if (!rpcUrl) {
                console.warn(`No RPC URL found for chain ID ${chainid} in file ${file}. Skipping verification.`);
                continue;
            }
            
            console.log(`Verifying CREATE3Factory at ${CREATE3Factory} on chain ${chainid}...`);
            const bytecode = await getBytecode(rpcUrl, CREATE3Factory);
            const compiledBytecode = await getCompiledBytecode();
            
            if (bytecode === '0x' || bytecode === '') {
                console.error(`❌ Contract not found at ${CREATE3Factory} on chain ${chainid}`);
            } else if (bytecode !== compiledBytecode) {
                console.error(`❌ Bytecode mismatch for ${CREATE3Factory} on chain ${chainid}`);
                console.log(`Compiled bytecode: ${compiledBytecode.toString()}...`);
                console.log(`Deployed bytecode: ${bytecode.substring(0, 100)}...`);
            } else {
                console.log(`✅ Contract verified at ${CREATE3Factory} on chain ${chainid}`);
            }
        } catch (error) {
            console.error(`Error verifying deployment in ${file}:`, error);
        }
    }
    
    console.log('Verification complete.');
}

// Execute main function if script is run directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error in main function:', error);
        process.exit(1);
    });
}

module.exports = { getBytecode, main };
