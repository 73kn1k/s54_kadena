
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
  // get the secretKey . . .
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

function executeTransaction(ntw, chainId, signedTx, preflightOnly = false){
    return new Promise(async (resolve, reject) => {
        
        const apiURL = (ntw == "mainnet01") ? "api" : "api.testnet";

        const kdaclient = createClient( `https://${apiURL}.chainweb.com/chainweb/0.0/${ntw}/chain/${chainId}/pact` );

        const preflightResult = await kdaclient.preflight(signedTx); 

        if (preflightResult.result.status === "failure") {
            console.log("preflight failure", preflightResult);
            resolve(JSON.stringify({ status: 502, data: preflightResult }));
        } else {
            if(preflightOnly == true){
                console.log("preflight successful", preflightResult);
                resolve(JSON.stringify({ status: 200, data: preflightResult }));
            } else {
                try {
                    const result = await submitOne(signedTx);
                    console.log('Transaction submitted:', result);
                    resolve(JSON.stringify({ status: 200, data: result }));
                } catch (error) {
                    console.error('Error submitting transaction:', error);
                    resolve(JSON.stringify({ status: 502, data: error }));
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
        const tr = Pact.builder
        .execution(`
            (use marmalade-v2.ledger)
            (use marmalade-v2.util-v1)
            (create-token-id
                {
                    'precision: ${precision},
                    'policies: [
                        marmalade-v2.non-fungible-policy-v1,
                        marmalade-v2.guard-policy-v1,
                        marmalade-v2.collection-policy-v1
                    ],
                    'uri: "${uri}"
                }
                (at 'creator-guard (read-msg 'creator_spec))
            )`
        )
        .addKeyset('creator_keyset', 'keys-all', creator_pubK )
        .addData("collection_id", collectionId)
        .addData("creator_spec", {
            "creator": `k:${creator_pubK}`,
            "creator-guard": {
                "keys": [
                    `${creator_pubK}`
                ],
                "pred": "keys-all"
            },
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
            "royalty-rate": 0.01
        })
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
    .addSigner(creator_pubK, (withCapability) => [
        withCapability(
            'marmalade-v2.collection-policy-v1.COLLECTION', 
            collectionId, 
            req.params.collectionName,
            {"int": req.params.maxSize.toString()},
            { "keys": [creator_pubK], "pred": "keys-all" }
        )
    ])
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

server.get("/createToken", async function(req, res){

    console.log("createToken started");

    const ntw = req.query.ntw;
    const chainId = req.query.chainId;
    const collectionId = req.query.collection_id;
    
    const creator_pubK = req.query.creator_pubK;
    const uri = req.query.uri;

    //console.log("store pubK\t", creator_pubK);

    const precision = 0;

    const store_pK = await getPk(creator_pubK)
    const storeSign = createSignWithKeypair({ 
        "publicKey": creator_pubK, 
        "secretKey": store_pK
    });
    //console.log("store pK\t", store_pK);

    const resp = await getTokenId( ntw, chainId, creator_pubK, precision, uri );
    console.log("createToken getTokenId resp", resp);
    const tokenId = resp.result.data;

    const tr0 = Pact.builder
    .execution(`
        (use marmalade-v2.ledger)
        (use marmalade-v2.util-v1)
        (create-token
            "${tokenId}"
            ${precision}
            "${uri}"
            [
                marmalade-v2.non-fungible-policy-v1,
                marmalade-v2.guard-policy-v1,
                marmalade-v2.collection-policy-v1
            ]
            (at 'creator-guard (read-msg 'creator_spec))
        )`
    )
    .addKeyset('creator_keyset', 'keys-all', creator_pubK )
    .addData("collection_id", collectionId)
    .addData("creator_spec", {
        "creator": `k:${creator_pubK}`,
        "creator-guard": {
            "keys": [
                `${creator_pubK}`
            ],
            "pred": "keys-all"
        },
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
        "royalty-rate": 0.01
    })
    .addSigner(s54pubK, (withCapability) => [
        withCapability('coin.GAS')
    ])
    .addSigner(creator_pubK, (withCapability) => [
        withCapability(
            'marmalade-v2.ledger.CREATE-TOKEN', 
            tokenId, 
            { "keys": [`${creator_pubK}`], "pred": "keys-all" }
        ),
        withCapability(
            'marmalade-v2.ledger.MINT',
            tokenId,
            `k:${creator_pubK}`,
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
    const signedTx = await storeSign(signedTxby54);
   
    const result = await executeTransaction(ntw, chainId, signedTx, true)
    console.log("createToken executeTransaction result", result); 

    res.send(JSON.stringify({"status":200, "data": "dev"}))

})
