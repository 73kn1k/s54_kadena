
const { Pact, createClient, createSignWithKeypair } = require('@kadena/client');
const { dirtyRead, submitOne } = require('./util/client');

const myArgs = process.argv.slice(2);

const debug = myArgs.includes('debug');

console.log(" 7< kda api\n");
console.log(" SERVICE STARTING\n");

if(debug == true){
	console.log(' Debug is ON\n')
}

const bodyParser = require('body-parser');
const express = require('express');
const server  = express();

const http  = require('http').createServer(server);

server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());

function getPk(pubK){
    return new Promise((resolve, reject) => {
	// obtain kaiPairs from storage . . .
        resolve("abcdefghijklmnopqrstuvwxyz1234567890")
    })
}

let s54pubK, s54pk, s54sign;
(async () => {
    s54pubK = "470ea61ff9130e156f3c3f4789ab2c43fb334ea89cbeb75fe5161ed2fd2b7cd1";
    s54pk = await getPk(s54pubK);
    s54sign = createSignWithKeypair({
      publicKey: s54pubK,
      secretKey: s54pk
    });
})();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveKp(pubK, pk, refid = null){
    return new Promise((resolve) => {
	// store kayPair save
        resove(1)
    })
}

function generatKeyPair(refid = null){
    return new Promise(async (resolve) =>  {
        const { kadenaKeyPairsFromRandom } = await import('@kadena/hd-wallet');
        const keyPairs = await kadenaKeyPairsFromRandom(1);
        var kayPairData = keyPairs.map(keyPair => ({
            ...keyPair,
            legacy: false,
        }))
        saveKp(kayPairData[0].publicKey, kayPairData[0].secretKey, refid)
        resolve(kayPairData[0])
    })
}

async function waitForConfirmation(client, hash) {
    let result = await client.getTransactionStatus(hash);
    while (result.status !== 'success') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      result = await client.getTransactionStatus(hash);
    }
}

server.get('/', function(req, res){
    res.send("s54-kda-api<br>\nby 7<")  
});

server.get('/createKeyPair', async function(req,res){
    var keyPair = await generatKeyPair()
    res.send(JSON.stringify({"status":200, "data": keyPair}))
})

server.get('/createKeyPair/:refid', async function(req,res){
    if(req.params.refid == "null"){
        req.params.refid = null
    }
    var keyPair = await generatKeyPair(req.params.refid)
    res.send(JSON.stringify({"status":200, "data": keyPair}))
})

function executeTransaction(ntw, chainId, signedTx, preflightOnly = false){
    return new Promise(async (resolve, reject) => {
        
        const apiURL = (ntw == "mainnet01") ? "api" : "api.testnet";

        const kdaclient = createClient( `https://${apiURL}.chainweb.com/chainweb/0.0/${ntw}/chain/${chainId}/pact` );

        const preflightResult = await kdaclient.preflight(signedTx); 

        if (preflightResult.result.status === "failure") {
            console.log("preflight failure", preflightResult);
            resolve({ status: 502, data: preflightResult });
        } else {
            if(preflightOnly == true){
                console.log("preflight successful", preflightResult);
                resolve({ status: 200, data: preflightResult });
            } else {
                try {
                    const result = await submitOne(signedTx);
                    console.log('Transaction submitted:', result);
                    resolve({ status: 200, data: result });
                } catch (error) {
                    console.error('Error submitting transaction:', error);
                    resolve({ status: 502, data: error });
                }
            }
        }

    })
}

function getCollectionId(ntw, chainId, pubK ,collectionName) {
    return new Promise(async (resolve, reject) => {
        const tr = Pact.builder
        .execution(`
            (use marmalade-v2.collection-policy-v1)
            (create-collection-id
                "${collectionName}"
                (read-keyset 'creator_keyset)
            )`
        )
        .addKeyset('creator_keyset', 'keys-all', pubK)
        .setMeta({
            chainId: chainId
        })
        .setNetworkId(ntw)
        .createTransaction();
        const response = await dirtyRead(tr);
        console.log("colletionId:", response.result.data);
        resolve(response)
    })
}

function getTokenId(ntw, chainId, creator_pubK, precision, collectionId, uri) {
    return new Promise(async (resolve, reject) => {
        console.log("getTokenId function  params", 
                    "\nntw", ntw, "\nchainId", chainId , "\ncreator pubK", creator_pubK,
                    "\nprecision", precision, "\ncollectionId", collectionId, "\nuri", uri)
        const tr = Pact.builder
        .execution(`
            (use marmalade-v2.ledger)
            (create-token-id
                {
                    'precision: ${precision},
                    'policies: [
                        n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.nft-policy-v1,
                        marmalade-v2.guard-policy-v1,
                        marmalade-v2.collection-policy-v1
                    ],
                    'uri: "${uri}"
                }
                (read-keyset 'creator_keyset)
            )`
        )
        .addKeyset('creator_keyset', 'keys-all', creator_pubK )
        .addData("collection_id", collectionId)
        .setMeta({
            chainId: chainId
        })
        .setNetworkId(ntw)
        .createTransaction();
        const response = await dirtyRead(tr);
        console.log("tokenID :", response.result.data);
        resolve(response)
    })
}

server.get('/createCollection/:ntw/:chainId/:collectionName/:maxSize/:creator_pubK/:signature', async function(req, res){

    const ntw = req.params.ntw;
    const chainId = req.params.chainId;
    const creator_pubK = req.params.creator_pubK;

    console.log("createCollection Started")

    let pk
    if(req.params.signature == "local"){ 
        pk = await getPk(creator_pubK)
    } else {
        //   TODO   sign with external wallet like "Chainweaver"   
        // probablemente un manejo mas abajo para implementar en el sign
    }
    const signWithKeypair = createSignWithKeypair({ 
        "publicKey": creator_pubK, 
        "secretKey": pk
    });

    const resp = await getCollectionId(ntw, chainId, creator_pubK, req.params.collectionName) //.result.data
   
    const collectionId = resp.result.data

    const tr = Pact.builder
    .execution(`
        (use marmalade-v2.collection-policy-v1)
        (create-collection 
            "${collectionId}"
            "${req.params.collectionName}"
            ${req.params.maxSize}
            (read-keyset 'creator_keyset)
        )`
    )
    .addKeyset('creator_keyset', 'keys-all', creator_pubK)
    .addSigner(s54pubK, (withCapability) => [
        withCapability('coin.GAS')
    ])
    .addSigner(creator_pubK)
    .setMeta({
        chainId: chainId,
        sender: `k:${s54pubK}`, 
        gasLimit: 150000,
        gasPrice: 1.0e-6,
        ttl: 10 * 60, 
      })
    .setNetworkId(ntw)
    .createTransaction();
    
    const signedTxby54 = await s54sign(tr);
    const signedTx = await signWithKeypair(signedTxby54);
    const result = await executeTransaction(ntw, chainId, signedTx);

    resp.transaction = result;

    res.send(JSON.stringify({"status":200, "data": resp}))

})

server.get('/sellTokenWchainweaver', async function(req, res){

    console.log("sellToken with Chainweaver started");

    const ntw = req.query.ntw;
    const chainId = req.query.chainId;

    const price = Number(parseFloat(req.query.price).toFixed(8));

    const royaltyRate = parseFloat(req.query.royaltyRate) ?? 0.01;

    const s54royaltyRate = parseFloat(req.query.s54royaltyRate) ?? 0.01;
    
    const s54Payout =  (price == 0) ? 0 : parseFloat((price * s54royaltyRate).toFixed(8));
    const creatorPayout = (price == 0) ? 0 : parseFloat((price * royaltyRate).toFixed(8));
    const sellerPayout = (price == 0) ? 0 : (price - (s54Payout + creatorPayout).toFixed(8))

    const payer_pubK = req.query.payer_pubK;
    const customer_pubK = req.query.customer_pubK;

    const seller_pubK = req.query.seller_pubK;
    const seller_pK = await getPk(seller_pubK)
    const sellerSign = createSignWithKeypair({ 
        "publicKey": seller_pubK,
        "secretKey": seller_pK
    });

    const creator_pubK = req.query.store_pubK;
    
    const tokenid = req.query.tokenid;

    console.log("sellToken params", ntw, chainId, price, tokenid)

    const tr0 = Pact.builder
    .execution(`
        (coin.transfer-create
            "k:${payer_pubK}"
            "k:${seller_pubK}"
            (read-keyset 'seller_keyset)
            ${sellerPayout}
        )
        (coin.transfer-create
            "k:${payer_pubK}"
            "k:${creator_pubK}"
            (read-keyset 'creator_keyset)
            ${creatorPayout}
        )
        (coin.transfer 
            "k:${payer_pubK}"
            "k:${s54pubK}" 
            ${s54Payout}
        )
        (use marmalade-v2.ledger)
        (transfer-create
            "${tokenid}"
            "k:${seller_pubK}"
            "k:${customer_pubK}"
            (read-keyset 'customer_keyset)
            1.0
        )`
    )
    .addKeyset('seller_keyset', 'keys-all', seller_pubK )
    .addKeyset('creator_keyset', 'keys-all', creator_pubK )
    .addKeyset('customer_keyset', 'keys-all', customer_pubK )
    .addSigner(payer_pubK, (withCapability) => [
        withCapability(
            'coin.TRANSFER',
            `k:${payer_pubK}`,
            `k:${seller_pubK}`,
            sellerPayout
        ),
        withCapability(
            'coin.TRANSFER',
            `k:${payer_pubK}`,
            `k:${creator_pubK}`,
            creatorPayout
        ),
        withCapability(
            'coin.TRANSFER',
            `k:${payer_pubK}`,
            `k:${s54pubK}`,
            s54Payout
        ),
        withCapability('coin.GAS')
    ])
    .addSigner(seller_pubK, (withCapability) => [
        withCapability(
            'marmalade-v2.ledger.TRANSFER',
            tokenid,
            `k:${seller_pubK}`,
            `k:${customer_pubK}`,
            1.0
        )
    ])
    .setMeta({
        chainId: chainId,
        sender: 'k:'+payer_pubK,
        gasLimit: 7000,
        gasPrice: 1.0e-6,
        ttl: 10 * 60, 
      })
    .setNetworkId(ntw)
    .createTransaction();

    const signedTx = await sellerSign(tr0)

    console.log("sellTokenWchainweaver signedtx", signedTx)

    res.send(JSON.stringify({ "status":200, "data": { "transaction": signedTx , "tokenid": tokenid, "price": price}}))
   
})

server.get('/createTokenWchainweaver', async function(req, res){

    console.log("\ncreateToken with Chainweaver started");

    const ntw = req.query.ntw;
    const chainId = req.query.chainId;
    const collectionId = decodeURIComponent(req.query.collection_id);
    const uri = decodeURIComponent(req.query.uri);

    const precision = 0;

    const payableMint =  (req.query.payableMint) ? true : false;
    let mintPrice = parseFloat(req.query.mintPrice) ?? 0.0;
    if (Number.isInteger(mintPrice)) {
        mintPrice = mintPrice + 0.0;
    }
    const minAmount = parseFloat(req.query.minAmount) ?? 1.0;
    const maxAmount = parseFloat(req.query.maxAmount) ?? 1.0;
    const maxSupply = parseFloat(req.query.maxSupply) ?? 1.0;

    const royaltyRate = parseFloat(req.query.royaltyRate) ?? 0;

    const s54royaltyRate = parseFloat(req.query.s54royaltyRate) ?? 0;
    
    const s54Payout =  (mintPrice == 0) ? 0 : (mintPrice * s54royaltyRate);
    const creatorPayout = (mintPrice == 0) ? 0 : (mintPrice - s54Payout);

    const creator_pubK = req.query.store_pubK;
    const creator_pK = await getPk(creator_pubK)
    const creatorSign = createSignWithKeypair({ 
        "publicKey": creator_pubK, 
        "secretKey": creator_pK
    });

    const customer_pubK = req.query.customer_pubK;
    const customer_pK = await getPk(customer_pubK)
    const customerSign = createSignWithKeypair({ 
        "publicKey": customer_pubK, 
        "secretKey": customer_pK
    });

    const payer_pubK = req.query.payer_pubK;

    const resp = await getTokenId( ntw, chainId, creator_pubK, precision, collectionId, uri );
    
    const tokenId = resp.result.data;

    const tr0 = Pact.builder
    .execution(`
        (coin.transfer-create
            "k:${payer_pubK}"
            "k:${customer_pubK}"
            (read-keyset 'customer_keyset)
            ${(Number.isInteger(mintPrice)) ? mintPrice + ".0" : mintPrice }
        )
        (use marmalade-v2.ledger)
        (create-token
            "${tokenId}"
            ${precision}
            "${uri}"
            [
                n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.nft-policy-v1,
                marmalade-v2.guard-policy-v1,
                marmalade-v2.collection-policy-v1
            ]
            (read-keyset 'creator_keyset)
        )
        (mint
            "${tokenId}"
            "k:${customer_pubK}"
            (read-keyset 'customer_keyset)
            1.0
        )`
    )
    .addKeyset('moderator_keyset', 'keys-all', s54pubK )
    .addKeyset('creator_keyset', 'keys-all', creator_pubK )
    .addKeyset('customer_keyset', 'keys-all', customer_pubK )
    .addData("collection_id", collectionId)
    .addData("minting_data_spec", {
            "payable-mint": payableMint,
            "mint-price": mintPrice,
            "min-amount": minAmount,
            "max-amount": maxAmount,
            "max-supply": maxSupply,
            "precision": {"int": precision}
        }
    )
    .addData("royalty_spec", {
            "fungible": {
                "refName": {
                    "namespace": null,
                    "name": "coin"
                },
                "refSpec": [
                    {
                        "namespace": null,
                        "name": "fungible-v2"
                    }
                ]
            },
            "creator": "k:"+creator_pubK,
            "creator-guard": {
                "keys": [ creator_pubK ],
                "pred": "keys-all"
            },
            "royalty-rate": royaltyRate,
            "s54": "k:"+s54pubK,
            "s54-guard": {
                "keys": [ s54pubK ],
                "pred": "keys-all"
            },
            "s54-royalty-rate": s54royaltyRate
        }
    )
    .addSigner(payer_pubK, (withCapability) => [
        withCapability(
            'coin.TRANSFER',
            `k:${payer_pubK}`,
            `k:${customer_pubK}`,
            mintPrice
        ),
        withCapability('coin.GAS')
    ])
    .addSigner(customer_pubK, (withCapability) => [
        withCapability(
            'marmalade-v2.ledger.MINT',
            tokenId,
            `k:${customer_pubK}`,
            1.0
        ),
        withCapability(
            'coin.TRANSFER',
            `k:${customer_pubK}`,
            `k:${creator_pubK}`,
            creatorPayout
        ),
        withCapability(
            'coin.TRANSFER',
            `k:${customer_pubK}`,
            `k:${s54pubK}`,
            s54Payout
        )
    ])
    .addSigner(creator_pubK)
    .addSigner(s54pubK)
    .setMeta({
        chainId: chainId,
        sender: 'k:'+payer_pubK,
        gasLimit: 150000,
        gasPrice: 1.0e-6,
        ttl: 10 * 60, 
      })
    .setNetworkId(ntw)
    .createTransaction();

    const signedTxby54 = await s54sign(tr0);
    const signedTxbyCreator = await creatorSign(signedTxby54);
    const signedTxbyCustomer = await customerSign(signedTxbyCreator);

    res.send(JSON.stringify({ "status":200, "data": { "transaction": signedTxbyCustomer, "tokenid" : tokenId, "price": mintPrice}}))
   
})

server.get("/createToken", async function(req, res){

    console.log("createToken started");

    const ntw = req.query.ntw;
    const chainId = req.query.chainId;
    const collectionId = decodeURIComponent(req.query.collection_id);
    const uri = decodeURIComponent(req.query.uri);

    const precision = 0;

    const payableMint =  (req.query.payableMint) ? true : false;
    const mintPrice = parseFloat(req.query.mintPrice) ?? 0;
    const minAmount = parseFloat(req.query.minAmount) ?? 1.0;
    const maxAmount = parseFloat(req.query.maxAmount) ?? 1.0;
    const maxSupply = parseFloat(req.query.maxSupply) ?? 1.0;

    const royaltyRate = parseFloat(req.query.royaltyRate) ?? 0.01;

    const s54royaltyRate = parseFloat(req.query.s54royaltyRate) ?? 0.01;
    
    const creator_pubK = req.query.store_pubK;
    const creator_pK = await getPk(creator_pubK)
    const creatorSign = createSignWithKeypair({ 
        "publicKey": creator_pubK, 
        "secretKey": creator_pK
    });

    const customer_pubK = req.query.customer_pubK;
    const customer_pK = await getPk(customer_pubK)
    const customerSign = createSignWithKeypair({ 
        "publicKey": customer_pubK, 
        "secretKey": customer_pK
    });

    const resp = await getTokenId( ntw, chainId, creator_pubK, precision, collectionId, uri );
    
    const tokenId = resp.result.data;

    const tr0 = Pact.builder
    .execution(`
        (use marmalade-v2.ledger)
        (use n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.nft-policy-v1)
        (create-token
            "${tokenId}"
            ${precision}
            "${uri}"
            [
                n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.nft-policy-v1,
                marmalade-v2.guard-policy-v1,
                marmalade-v2.collection-policy-v1
            ]
            (read-keyset 'creator_keyset)
        )
        (moderated-mint
            "${tokenId}"
            "k:${customer_pubK}"
            (read-keyset 'customer_keyset)
            1.0
        )`
    )
    .addKeyset('creator_keyset', 'keys-all', creator_pubK )
    .addKeyset('customer_keyset', 'keys-all', customer_pubK )
    .addData("collection_id", collectionId)
    .addData("minting_data_spec", {
            "payable-mint": payableMint,
            "mint-price": mintPrice,
            "min-amount": minAmount,
            "max-amount": maxAmount,
            "max-supply": maxSupply,
            "precision": {"int": precision}
        }
    )
    .addData("royalty_spec", {
            "fungible": {
                "refName": {
                    "namespace": null,
                    "name": "coin"
                },
                "refSpec": [
                    {
                        "namespace": null,
                        "name": "fungible-v2"
                    }
                ]
            },
            "creator": "k:"+creator_pubK,
            "creator-guard": {
                "keys": [ creator_pubK ],
                "pred": "keys-all"
            },
            "royalty-rate": royaltyRate,
            "s54": "k:"+s54pubK,
            "s54-guard": {
                "keys": [ s54pubK ],
                "pred": "keys-all"
            },
            "s54-royalty-rate": s54royaltyRate
        }
    )
    .addSigner(customer_pubK, (withCapability) => [
        withCapability(
            'marmalade-v2.ledger.MINT',
            tokenId,
            `k:${customer_pubK}`,
            1.0
        )
    ])
    .addSigner(creator_pubK)
    .addSigner(s54pubK)
    .setMeta({
        chainId: chainId,
        sender: 'k:'+s54pubK,
        gasLimit: 150000,
        gasPrice: 1.0e-6,
        ttl: 10 * 60, 
      })
    .setNetworkId(ntw)
    .createTransaction();

    const signedTxby54 = await s54sign(tr0);
    const signedTxbyCustomer = await customerSign(signedTxby54);
    const signedTx = await creatorSign(signedTxbyCustomer);
   
    const result = await executeTransaction(ntw, chainId, signedTx)
    console.log("createToken executeTransaction result", result);

    res.send(JSON.stringify({ "status":200, "data": { "tokenId": tokenId, "reqK": result.data.requestKey }}))

})

server.get("/balanceOf", async function(req, res){
	
    const ntw = req.query.ntw;
    const chainId = req.query.chainId;
    const tokenId = req.query.tokenId;
    const wallet = req.query.wallet;
    
    const tr = Pact.builder
    .execution(`
        (use marmalade-v2.ledger)
        (get-balance
            {
                'id: ${tokenId},
                'account: "k:${wallet}"
            }
        )`
    )
    .setMeta({
        chainId: chainId
    })
    .setNetworkId(ntw)
    .createTransaction();
	
    const response = await dirtyRead(tr);
	
    console.log("balanceOf :", wallet, tokenId, "=", response.result.data);
	
    res.send(JSON.stringify({"status":200, "data": response.result}))
	
})

server.get("/walletBalance", async function(req, res){
	
    const ntw = req.query.ntw;
    const chainId = req.query.chainId;
    const wallet = req.query.wallet;
	
    const tr = Pact.builder
    .execution(`(coin.get-balance "k:${wallet}")`)
    .setMeta({chainId: chainId})
    .setNetworkId(ntw)
    .createTransaction();
    const response = await dirtyRead(tr);
	
    console.log("waletBalance :", wallet, response);
	
    res.send(JSON.stringify({"status":200, "data": response.result}))
	
})

server.get("/withdrawKda", async function(req, res){
    
    const ntw = req.query.ntw;
    const chainId = req.query.chainId;
    const fromPubK = req.query.fromPubK;
    const toPubK = req.query.toPubK;
    const amountKda = parseFloat(req.query.amountKda);

    console.log("withdrawKda started\nfrom:", fromPubK,"\nto:", toPubK,"\namount:", amountKda, "\n", ntw, chainId)

    const from_pK = await getPk(fromPubK);
    const ownerSign = createSignWithKeypair({ 
        "publicKey": fromPubK, 
        "secretKey": from_pK
    });

    const tr = Pact.builder
    .execution(`
        (coin.transfer-create
            "k:${fromPubK}"
            "k:${toPubK}"
            (read-keyset 'receiver_keyset)
            ${amountKda}
        )`)
    .addKeyset('receiver_keyset', 'keys-all', toPubK )
    .addSigner(fromPubK, (withCapability) => [
        withCapability('coin.GAS'),
        withCapability(
            'coin.TRANSFER',
            `k:${fromPubK}`,
            `k:${toPubK}`,
            amountKda
        )
    ])
    .setMeta({
        chainId: chainId,
        sender: 'k:'+fromPubK,
        gasLimit: 3000,
        gasPrice: 1.0e-8,
        ttl: 10 * 60, 
      })
    .setNetworkId(ntw)
    .createTransaction();

    const signedTx = await ownerSign(tr);

    const result = await executeTransaction(ntw, chainId, signedTx)

    console.log("withdrawKda result", result);

    res.send(JSON.stringify({"status":200, "data": result}))

})

server.get("/transferToken", async function(req, res){

    const ntw = req.query.ntw;
    const chainId = req.query.chainId;
    const tokenId = req.query.tokenId;
    const collectionId = req.query.collectionId;

    var preflightOnly = req.query.preflightOnly;

    if (preflightOnly === undefined) {
        preflightOnly = false;
    }  else {
        if(preflightOnly == "true" || preflightOnly == true){
            preflightOnly = true
        } else {
            preflightOnly = false
        }
    }

    const owner_pubK = req.query.owner_pubK;
    const owner_pK = await getPk(owner_pubK);
    const ownerSign = createSignWithKeypair({ 
        "publicKey": owner_pubK, 
        "secretKey": owner_pK
    });

    const receiver_pubK = req.query.customer_pubK;
   
    console.log("\ntransferToken Started\n\nntw\t\t", ntw, "preflightOnly", preflightOnly,
                "\nchainId\t\t", chainId, "\ntokenId\t\t", tokenId, 
                "\nowner_pubK\t", owner_pubK, "\nreceiver_pubK\t", receiver_pubK,"\n");

    const tr0 = Pact.builder
    .execution(`
        (use marmalade-v2.ledger)
        (transfer-create
            "${tokenId}"
            "k:${owner_pubK}"
            "k:${receiver_pubK}"
            (read-keyset 'receiver_keyset)
            1.0
        )`
    )
    .addData("collection_id", collectionId)
    .addKeyset('receiver_keyset', 'keys-all', receiver_pubK )
    .addSigner(s54pubK, (withCapability) => [
        withCapability('coin.GAS')
    ])
    .addSigner(owner_pubK, (withCapability) => [
        withCapability(
            'marmalade-v2.ledger.TRANSFER',
            tokenId,
            `k:${owner_pubK}`,
            `k:${receiver_pubK}`,
            1.0
        )
    ])
    .setMeta({
        chainId: chainId,
        sender: 'k:'+s54pubK,
        gasLimit: 150000,
        gasPrice: 1.0e-6,
        ttl: 10 * 60, 
      })
    .setNetworkId(ntw)
    .createTransaction();

    const signedTxby54 = await s54sign(tr0);
    const signedTx = await ownerSign(signedTxby54);
   
    const result = await executeTransaction(ntw, chainId, signedTx, preflightOnly)
    console.log("transferToken executeTransaction result\n", result); 

    res.send(JSON.stringify({ "status":200, "data": { "tokenId": tokenId, "reqK": result.data.requestKey }}))

})

server.get("/currentKDAprice", async function(req, res) {
    var currentKDAprice = await getKDAprice();
    res.send(JSON.stringify({status:200, data: currentKDAprice}))
})

server.get("/restart", function(req, res){
    res.send(JSON.stringify({"status":200, "data": "restarting"}))
    console.log('\nRestarting...');
    process.exit(0);
})

http.listen(3000,'127.0.0.1',async function(){ 
    console.log('http listening on 127.0.0.1:3000');
})
