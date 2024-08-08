<?php

  // Stripe documentation can be found at https://docs.stripe.com/api?lang=php
  require_once('include/vendor/stripe/init.php');

  // The $_POST['stripeToken'] is received from the Stripe component when a payment is issued. And here it is handled
  // All validation code can be found in the Stripe documentation and for ease of reading is omitted in this document.

  \Stripe\Stripe::setApiKey( "SecretKey" );
  if (isset($_GET['e']) && $_GET['e'] == 1 && isset($_POST['stripeToken']) && !empty($_POST['stripeToken'])) {
    
    // Stripe payment process
    $stripeToken  = $_POST['stripeToken'];
    $email        = $_POST['stripeEmail'];
    
    $in_transaction = true;

    try {
      
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

      $_url = "http://127.0.0.1:3000/createToken?ntw=$kdaNtw&chainId=$chainId&collection_id=".urlencode( stored_collection_id )."&customer_pubK=". userSessionKDAwallet ."&store_pubK=". olimpiaKDAwallet ."&uri=".urlencode($_SERVER['REQUEST_SCHEME'].'://'.$_SERVER['HTTP_HOST']. newJsonName);
      $ch = curl_init();
      curl_setopt($ch, CURLOPT_URL, $_url);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

      $response = curl_exec($ch);
      $response_data = json_decode($response, true);

      $tx = $response_data['data']['tokenId'];
      $transaction_tx = $response_data['data']['reqK'];

      . . .
        
         db data stuff

          EOF
