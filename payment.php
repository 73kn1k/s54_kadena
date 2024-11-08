<?php

  function getKdaPrice(){
      // @ service.js #824
      $result = httpRequest("http://127.0.0.1:3000/currentKDAprice");
      $result = json_decode($result);
      return $result->data;
  }

  // Stripe documentation can be found at https://docs.stripe.com/api?lang=php
  require_once('include/vendor/stripe/init.php');

  // The $_POST['stripeToken'] is received from the Stripe component when a payment is issued. And here it is handled
  // All validation code can be found in the Stripe documentation and for ease of reading is omitted in this document.

  \Stripe\Stripe::setApiKey( "SecretKey" );
  if (isset($_GET['e']) && $_GET['e'] == 1 && ( (isset($_POST['stripeToken']) && !empty($_POST['stripeToken'])) || ( isset($_POST['st']) && !empty($_POST['st']) ) )) {
    
    // Stripe payment process
    $stripeToken  = $_POST['stripeToken'];
    $email        = $_POST['stripeEmail'];
    
    $in_transaction = true;
 
    $daStripeP = number_format(( item_price * $_POST['stripeQuantity']), 2, "", "");
    
    $customer = \Stripe\Customer::create([
      'email' => $email,
      'source'  => $stripeToken,
    ]);

    $charge = \Stripe\Charge::create([
      'customer' => $customer->id,
      'amount'   => $daStripeP,
      'currency' => 'USD',
      'description' => "itemNameDemo" ,
    ]);

    $kdaNtw = ($isTestnet == true) ? "testnet04" : "mainnet01";
    $chainId = ($isTestnet == true) ? "1" : "8";

    if($itemNetworkData[0 + $isTestnet] == "KDA"){

      if( MINT == true ) {
        
          $itemPrice = (item_data->currency == "KDA") ? item_data->price : (item_data->price / getKdaPrice());
          $itemPrice = number_format($itemPrice, 8, '.', ''); // forces max 8 decimal

          // @ service.js #512
          $url = "http://127.0.0.1:3000/createToken";
    
          $params = [
            'ntw' => ($isTestnet == 1) ? 'testnet04' : 'mainnet01',
            'chainId' => ($isTestnet == 1) ? 1 : 8,
            'collection_id' => explode("_", item_data->network, 3 + $isTestnet)[2 + $isTestnet],
            'payableMint' => (item_data->currency == "KDA") ? ((item_data->price == 0) ? 'false' : 'true') : 'false',
            'mintPrice' => $itemPrice,
            'minAmount' => "1.0",
            'maxAmount' => "1.0",
            'maxSupply' => "1.0",
            'royaltyRate' => 0.01,
            's54royaltyRate' => 0.01,
            'customer_pubK' => user_session->kdaPubK,
            'store_pubK' => creator_data->kdaPubK,
            'uri' => $_SERVER['REQUEST_SCHEME'].'://'.$_SERVER['HTTP_HOST'].substr($newFileNameJSON,1)
          ];
          
          $response = httpRequest($url, $params);
    
          $response_data = json_decode($response, true);
    
          $tx = $response_data['data']['tokenId'];
          $transaction_tx = $response_data['data']['reqK'];
    
          $extraMSG = '
            RequestKey:<br>
            <a href="https://explorer.chainweb.com/' . ( ($itemNetworkData[0] == "TESTNET") ? "testnet" : "mainnet" ) . '/txdetail/' . $transaction_tx . '" target="_blank">
                <span>' . $transaction_tx . '</span>
            </a>
          ';

      } else {
        
        // SELL ( SECONDARY MARKET )

        $customer_pubK = str_replace("k:", "", user_session->kdaPubK);
        $owner_pubK = str_replace("k:", "", $item->ownerPubK);

        // @ service.js #747
        $url = 'http://127.0.0.1:3000/transferToken';

        $params = [
          'ntw' => ($isTestnet == 1) ? 'testnet04' : 'mainnet01',
          'chainId' => ($isTestnet == 1) ? 1 : 8,
          'owner_pubK' => $owner_pubK,
          'tokenId' => item_data->tokenID,
          'customer_pubK' => $customer_pubK,
          'collectionId' => explode("_", item_data->network, 3 + $isTestnet)[2 + $isTestnet],
          'preflightOnly' => false
        ];

        $kdaResult = httpRequest($url, $params);
        $kdaResultObj = json_decode($kdaResult, true);

        $transaction_tx = $kdaResultObj["data"]["reqK"];

        $extraMSG = '
          RequestKey:<br>
          <a href="https://explorer.chainweb.com/' . ( (item_dataNetworkData[0] == "TESTNET") ? "testnet" : "mainnet" ) . '/txdetail/' . $transaction_tx . '" target="_blank">
              <span>' . $transaction_tx . '</span>
          </a>
        ';
            
      }
        
    }

    . . .
      
       db data stuff

    . . .

    exit();
    
  }

  if(isset($_GET["signKDAtransaction"])){
    if ($itemNetworkData[0 + $isTestnet] == "KDA"){
      
      $params = [
        'ntw' => ($isTestnet == 1) ? 'testnet04' : 'mainnet01',
        'chainId' => ($isTestnet == 1) ? 1 : 8,
        'wallet' => $_GET["customer_pubK"]
      ];

      // @ service.js #674
      $payerBalanceResp = httpRequest("http://127.0.0.1:3000/walletBalance", $params);
      $payerBalanceJson = json_decode($payerBalanceResp);

      if($payerBalanceJson->status == 200){
        if($payerBalanceJson->data->status == "success"){

          $itemPrice = (item_data->currency == "KDA") ? item_data->price : (item_data->price / getKdaPrice());
          
          // to avoid presicion problems [it needs to be formatred at the service if integer send and not decimal]
          $itemPrice = number_format($itemPrice, 8, '.', ''); // forces max 8 decimal

          if($payerBalanceJson->data->data >= $itemPrice){ 
          
            if( MINT == true){

              $customer_pubK = "user_session_obj"->kdaPubK;

              // @ service.js #349
              $url = "http://127.0.0.1:3000/createTokenWchainweaver";

              $params = [
                  'ntw' => ($isTestnet == 1) ? 'testnet04' : 'mainnet01',
                  'chainId' => ($isTestnet == 1) ? 1 : 8,
                  'collection_id' => explode("_", item_data->network, 3 + $isTestnet)[2 + $isTestnet],
                  'uri' => $_SERVER['REQUEST_SCHEME'].'://'.$_SERVER['HTTP_HOST']. str_replace('./', '/', preg_replace('/\.[^.]+$/', '.json', item_data->file_path)) . "?id=".(item_data->purchased + 1),
                  'payableMint' => (item_data->currency == "KDA") ? ((item_data->price == 0) ? 'false' : 'true') : 'false',
                  'mintPrice' => $itemPrice,
                  'minAmount' => "1.0",
                  'maxAmount' => "1.0",
                  'maxSupply' => "1.0",
                  'royaltyRate' => 0.01,
                  's54royaltyRate' => 0.01,
                  'store_pubK' => creator_data->KdaPubK,
                  'customer_pubK' => $customer_pubK,
                  'payer_pubK' => $_GET["customer_pubK"]
              ];
              
              $response = httpRequest($url,$params);

              error_log("\n\n pay signKDAtransaction Mint response\n".$response);
              
              echo $response;

            } else {
              
              // SELL

              // @ service.js #237
              $url = "http://127.0.0.1:3000/sellTokenWchainweaver";

              $params = [
                'ntw' => ($isTestnet == 1) ? 'testnet04' : 'mainnet01',
                'chainId' => ($isTestnet == 1) ? 1 : 8,
                'collection_id' => explode("_", item_data->network, 3 + $isTestnet)[2 + $isTestnet],
                'itemid' => item_data->id,          
                'tokenid' => item_data->tokenID,
                'price' => $itemPrice,
                'royaltyRate' => 0.01,
                's54royaltyRate' => 0.01,
                'store_pubK' => creator->pubK,
                'seller_pubK' => item_data->ownerPubK,
                'payer_pubK' => $_GET["customer_pubK"],
                'customer_pubK' => user_session->kdaPubK
              ];

              $response = httpRequest($url, $params);

              error_log("\n\n pay signKDAtransaction Sell response\n".$response);
              
              echo $response;

            }

          } else {
            echo "insufficient balance";
          }

        } else {
          echo "pay walletBalance error payerBalance status != success";
        }
      } else {
        echo "pay walletBalance error payerBalance status != 200";
      }

      exit();

    }
  }

  if (isset($_GET["transferTo"])) {
    if($itemNetworkData[0 + $inx] == "KDA"){
      if(item_data->tokenID != ""){

        $customer_pubK = str_replace("k:", "", $_GET["transferTo"]);
        $owner_pubK = str_replace("k:", "", $q->wk);

        // @ service.js #747
        $url = 'http://127.0.0.1:3000/transferToken?ntw='.(($inx == 0) ? "mainnet01&chainId=8" : "testnet04&chainId=1") . 
        "&owner_pubK=$owner_pubK"."&tokenId=".(item_data->tokenID)."&customer_pubK=$customer_pubK"."&collectionId=".$itemNetworkData[2 + $inx];

        $kdaResult = httpRequest($url);

        $kdaResultObj = json_decode( $kdaResult );

      } 
    }
  }

  if(isset($_GET["withdrawKDA"])){
      
    header('Content-Type: application/json');

    // @ service.js #693
    $url = "http://127.0.0.1:57303/withdrawKda";

    $params = [
      'ntw' => ($_GET["isTestnet"] == 1) ? 'testnet04' : 'mainnet01',
      'chainId' => ($_GET["isTestnet"] == 1) ? 1 : 8,
      'fromPubK' => user_data->kdaPubK,
      'toPubK' => $_GET["withdrawKDA"],
      'amountKda' => $_GET["amountKda"]
    ];
    
    $response = httpRequest($url, $params);

    error_log("\n\n user_profile withdrawKDA response\n".$response);
    
    echo $response;

    exit();

  }

  . . .

      EOF
