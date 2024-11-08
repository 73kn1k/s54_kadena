;           ,----.  ,---. 
;    ,---. |  .--' /    | 
;   (  .-' '--. `\/  '  | 
;   .-'  `).--'  /'--|  |  54.wtf nft-policy-v1
;   `----' `----'    `--'  by 7<
;  (define-namespace
;    "n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2"
;    (read-keyset "moderator_keyset") 
;    (read-keyset "moderator_keyset")
;  ) 

(namespace "n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2")

;  (define-keyset "n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.admin" (read-keyset "moderator_keyset"))

(module nft-policy-v1 GOVERNANCE

  @doc "Policy for minting with fixeable issuance, minting price and royaltie for creator and store"

  (defconst ADMIN-KS:string "n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.admin")
  (defconst POLICY:string (format "{}" [nft-policy-v1]))

  (defcap GOVERNANCE () (enforce-guard ADMIN-KS))

  (use marmalade-v2.policy-manager)
  (use marmalade-v2.policy-manager [QUOTE-MSG-KEY quote-spec quote-schema])
  (use kip.token-policy-v2 [token-info])

  (implements kip.token-policy-v2)
  (implements kip.updatable-uri-policy-v1)

  (defconst MINTING-DATA-SPEC:string "minting_data_spec")

  (defschema NO-PAYMENT-schema
    noPayment:bool
  )
  (deftable NO-PAYMENT:{NO-PAYMENT-schema})

  (defun get-total-supply:decimal (token-id:string)
      (marmalade-v2.ledger.total-supply token-id)
  )

  (defschema minted-schema
    key:string
    amount:decimal
  )
  (deftable minted:{minted-schema})

  (defun get-minted:decimal (address:string token-id:string)
    (let ((key (hash (format "{}_{}" [address token-id]))))
      (at 'amount
          (try
          ; if fail
          {
              "key": key,
              "amount": 0.0 
          }
          ; else
          (with-read minted key {'amount:=amount}
              {
              "key": key,
              "amount": amount
              }
          )
          )
      )
    )
  )

  (defschema token-minting-data-schema
    payable-mint:bool
    mint-price:decimal
    max-supply:decimal
    max-amount:decimal
    min-amount:decimal
    precision:integer
  )
  (deftable token-minting-data:{token-minting-data-schema})

  (defun get-token-minting-data:object{token-minting-data-schema} (token-id:string)
    (read token-minting-data token-id)
  )

  (defschema royalty-schema
    fungible:module{fungible-v2}
    creator:string
    creator-guard:guard
    royalty-rate:decimal
    s54:string
    s54-guard:guard
    s54-royalty-rate:decimal
  )
  (deftable royalties:{royalty-schema})

  (defconst ROYALTY-SPEC "royalty_spec")

  (defcap ROYALTY:bool (token-id:string royalty_spec:object{royalty-schema})
    @doc "Emits event with royalty information for discovery"
    @event
    true
  )

  (defcap ROYALTY-PAYOUT:bool
    ( 
      token-id:string
      royalty-payout:decimal
      account:string
    )
    @doc "Emits event with royalty payout information at transaction completion"
    @event
    true
  )

  (defcap ROTATE-PAYABLE-MINT (token-id:string enforce-payable:bool creator-guard:guard)
    @doc "Enforce payable-mint for token"
    @event
    (with-read token-minting-data token-id {'creator-guard:=cg}
        (enforce-guard cg)
    )
  )

  (defcap MINT (token-id:string account:string amount:decimal)
    @doc "Custom mint event"
    @event
    true
  )

  (defcap ROTATE-MINT-PRICE (token-id:string newPrice:decimal creator-guard:guard)
    @doc "Update mint price information for token"
    @event
    (with-read token-minting-data token-id {'creator-guard:=cg}
        (enforce-guard cg)
    )
  )

  (defcap ROTATE-CREATOR-ROYALTY (token-id:string creator:string creator-guard:guard)
    @doc "Update CREATOR royalty information for token"
    @event
    (with-read royalties token-id {'creator-guard:=cg}
      (enforce-guard cg)
    )
  )

  (defcap ROTATE-s54-ROYALTY (token-id:string s54:string s54-guard:guard)
    @doc "Update s54 royalty information for token"
    @event
    (with-read royalties token-id {'s54-guard:=cg}
      (enforce-guard cg)
    )
  )

  (defun get-royalty:object{royalty-schema} (token-id:string)
    (read royalties token-id)
  )

  (defun rotate-creator:string (token-id:string creator:string creator-guard:guard)
    @doc "Rotates the royalty creator account and guard for the token"
    (with-capability (ROTATE-CREATOR-ROYALTY token-id creator creator-guard)
      (update royalties token-id {'creator:creator,
                                  'creator-guard:creator-guard})
    )
    "Rotated creator and guard"
  )

  (defun rotate-s54:string (token-id:string s54:string s54-guard:guard)
    @doc "Rotates the royalty s54 account and guard for the token"
    (with-capability (ROTATE-s54-ROYALTY token-id s54 s54-guard)
      (update royalties token-id {'s54:s54,
                                  's54-guard:s54-guard})
    )
    "Rotated s54 account and guard"
  )

  (defun get-royalty-creator:string (token-id:string)
    (at 'creator (read royalties token-id))
  )

  (defun get-royalty-s54:string (token-id:string)
    (at 's54 (read royalties token-id))
  )

  (defun enforce-init:bool

    ( token:object{token-info} )

    @doc "The function is run at `create-token` step of marmalade-v2.ledger.    \
    \ Required msg-data keys:                                                   \
    \ * minting_data_spec:object{token-minting-data-schema} - registers payable mint, \
    \ mint price, minimum mint amount, max mint amount, max-supply and          \
    \ precision information                                                     \
    \ * royalty_spec:object{royalty-schema} - registers royalty information of  \
    \ of the created token."

    (require-capability (INIT-CALL (at "id" token) (at "precision" token) (at "uri" token) POLICY))
    (let* 
      (
        (minting-data-spec:object{token-minting-data-schema} (read-msg MINTING-DATA-SPEC))
        (payable-mint:bool (at 'payable-mint minting-data-spec))
        (mint-price:decimal (at 'mint-price minting-data-spec))
        (min-amount:decimal (at 'min-amount minting-data-spec))
        (max-amount:decimal (at 'max-amount minting-data-spec))
        (max-supply:decimal (at 'max-supply minting-data-spec))
        (precision:integer (at 'precision minting-data-spec))

        (royalty-spec:object{royalty-schema} (read-msg ROYALTY-SPEC))
        (fungible:module{fungible-v2} (at 'fungible royalty-spec))

        (creator:string (at 'creator royalty-spec))
        (creator-guard:guard (at 'creator-guard royalty-spec))
        (royalty-rate:decimal (at 'royalty-rate royalty-spec))
        (creator-details:object (fungible::details creator ))

        (s54:string (at 's54 royalty-spec))
        (s54-guard:guard (at 's54-guard royalty-spec))
        (s54-royalty-rate:decimal (at 's54-royalty-rate royalty-spec))
        (s54-details:object (fungible::details s54 ))
      )

      ; Fixed-issuance
      (enforce (= (at 'precision token) precision) "Invalid Precision")
      (enforce (>= mint-price 0.0) "Invalid mint-price")
      (enforce (and (= (floor min-amount precision) min-amount) (> min-amount 0.0)) "Invalid min-amount")
      (enforce (and (= (floor max-amount precision) max-amount) (>= max-amount 0.0)) "Invalid max-amount")
      (enforce (and (= (floor max-supply precision) max-supply) (>= max-supply 0.0)) "Invalid max-supply")

      (insert token-minting-data (at 'id token) {
        "payable-mint": payable-mint,
        "mint-price": mint-price,
        "min-amount": min-amount,
        "max-amount": max-amount,
        "max-supply": max-supply,
        "precision": precision
      })

      ; Royalty
      (enforce (= (format "{}" [fungible]) (format "{}" [coin])) "Royalty support is restricted to coin")
      (enforce (= (at 'guard creator-details) creator-guard) "creator guard does not match")
      (enforce (and (>= royalty-rate 0.0) (<= royalty-rate 1.0)) "Invalid creator royalty rate")
      (enforce (and (>= s54-royalty-rate 0.0) (<= s54-royalty-rate 1.0)) "Invalid s54 royalty rate")
      (enforce (<= (+ royalty-rate s54-royalty-rate) 1.0) "Invalid royalty rate")
      (insert royalties (at 'id token)
        { 
          'fungible: fungible,
          'creator: creator,
          'creator-guard: creator-guard,
          'royalty-rate: royalty-rate,
          's54: s54,
          's54-guard: s54-guard,
          's54-royalty-rate: s54-royalty-rate
        })
      (emit-event (ROYALTY (at 'id token) royalty-spec))

      ; init NO-PAYMENT
      (write NO-PAYMENT "noPayment-entry" { 'noPayment: false })

    )
    true
  )

  (defun enforce-payment:bool (payable-mint:bool)
    (if payable-mint
      ; then
      (with-read NO-PAYMENT "noPayment-entry" { 'noPayment := noPayment:bool }
        (if noPayment
          ; then
          false
          ; else
          true
        )
      )
      ; else
      false
    )
  )

  (defun enforce-mint:bool
    ( token:object{token-info}
      account:string
      guard:guard
      amount:decimal
    )
    (require-capability (MINT-CALL (at "id" token) account amount POLICY))

    (bind (get-token-minting-data (at "id" token))
      {
        'payable-mint := payable-mint:bool,
        'mint-price := mint-price:decimal,
        'min-amount := min-amount:decimal,
        'max-amount := max-amount:decimal,
        'max-supply := max-supply:decimal
      }

      (let*
        (
          (token-id (at "id" token))
          (supply (get-total-supply token-id))
          (account-minted (get-minted account token-id))
          (execute-payment (enforce-payment payable-mint))
        )

        (enforce (>= amount min-amount) "amount < min-amount")
        (enforce (or (= max-amount 0.0) (<= (+ account-minted amount) max-amount)) "account mint limit")
        (enforce (or (= max-supply 0.0) (<= (+ amount supply) max-supply)) "exceeds max supply")
        
        (if (= execute-payment true)
          ; then
          (bind (get-royalty token-id)
            {
              'fungible := fungible:module{fungible-v2}, 
              'creator := creator:string, 
              's54 := s54:string, 
              's54-royalty-rate := s54-royalty-rate:decimal
            }

            (let* 
              (
                (total-cost:decimal (* mint-price amount))
                (balance:decimal (fungible::get-balance account))
                (s54-payout:decimal (floor (* total-cost s54-royalty-rate) (fungible::precision)))
                (remaining:decimal (- total-cost s54-payout))
              )
  
              (enforce (>= balance total-cost) "Insufficient funds for minting")
              
              (if (> s54-payout 0.0)
                ; then
                (let ((_ ""))
                  (install-capability (fungible::TRANSFER account s54 s54-payout))
                  (emit-event (ROYALTY-PAYOUT token-id s54-payout s54))
                  (fungible::transfer account s54 s54-payout)
                )
                ; else
                "no s54 royalty"
              )
      
              (install-capability (fungible::TRANSFER account creator remaining))
              (fungible::transfer account creator remaining)
                
            )

          )
          ; else
          "no payment"
        )

        (let 
          (
            (key (hash (format "{}_{}" [account token-id])))
            (account-minted (get-minted account token-id))
          )
  
          (if (> account-minted 0.0)
            ; then
            (update minted key
              { 
                'amount: (+ account-minted amount)
              }
            )
            ; else
            (insert minted key
              {
                "key": key,
                "amount": amount
                ; ,"lastmint": (time "seconds")
              }
            )
          )
        )
        
        (emit-event (MINT token-id account amount))

        true
        
      )

    )

  )

  (defun moderated-mint:bool
    ( token-id:string
      account:string
      guard:guard
      amount:decimal
    )
    
    (enforce-keyset "n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.admin")

    (write NO-PAYMENT "noPayment-entry" { 'noPayment: true })
    (install-capability (marmalade-v2.ledger.MINT token-id account amount))
    (marmalade-v2.ledger.mint token-id account guard amount)
    (write NO-PAYMENT "noPayment-entry" { 'noPayment: false })

    (emit-event (MINT token-id account amount))

    true

  )

  (defun enforce-burn:bool
    ( token:object{token-info}
      account:string
      amount:decimal
    )
    true
  )

  (defun enforce-offer:bool
    ( token:object{token-info}
      seller:string
      amount:decimal
      timeout:integer
      sale-id:string
    )
    @doc "Capture quote spec for SALE of TOKEN from message"
    (require-capability (OFFER-CALL (at "id" token) seller amount sale-id timeout POLICY))
    (enforce (exists-msg-quote QUOTE-MSG-KEY) "Offer is restricted to quoted sale")
    (bind (get-royalty (at 'id token))
      { 'fungible := fungible:module{fungible-v2} }
      (let* 
        ((quote-spec:object{quote-spec} (read-msg QUOTE-MSG-KEY)))
        (enforce (= fungible (at 'fungible quote-spec)) (format "Offer is restricted to sale using fungible: {}" [fungible]))
      )
    )
  )

  (defun enforce-buy:bool
    ( token:object{token-info}
      seller:string
      buyer:string
      buyer-guard:guard
      amount:decimal
      sale-id:string
    )

    (require-capability (BUY-CALL (at "id" token) seller buyer amount sale-id POLICY))

    (enforce-sale-pact sale-id)

    (bind (get-royalty (at 'id token))
      { 
        'fungible := fungible:module{fungible-v2}, 
        'creator:= creator:string, 
        'creator-royalty-rate:= creator-royalty-rate:decimal, 
        's54:= s54:string, 
        's54-royalty-rate:= s54-royalty-rate:decimal
      }
      (let*
        ( 
          (quote-spec:object{quote-schema} (get-quote-info sale-id))
          (sale-price:decimal (at 'sale-price quote-spec))
          (escrow-account:string (at 'account (get-escrow-account sale-id)))
          (creator-payout:decimal (floor (* sale-price creator-royalty-rate) (fungible::precision)))
          (s54-payout:decimal (floor (* sale-price s54-royalty-rate) (fungible::precision)))
        )
        (if (> (+ creator-payout s54-payout) 0.0)
          ; then
          (let ((_ ""))
            (if (> creator-payout 0.0)
                ; then
                (let ((_ ""))
                  (install-capability (fungible::TRANSFER escrow-account creator creator-payout))
                  (emit-event (ROYALTY-PAYOUT sale-id (at 'id token) creator-payout creator))
                  (fungible::transfer escrow-account creator creator-payout)
                )
                ; else
                "no creator royalty"
            )
            (if (> s54-payout 0.0)
                ; then
                (let ((_ ""))
                  (install-capability (fungible::TRANSFER escrow-account s54 s54-payout))
                  (emit-event (ROYALTY-PAYOUT sale-id (at 'id token) s54-payout s54))
                  (fungible::transfer escrow-account s54 s54-payout)
                )
                ; else
                "no s54 royalty"
            )
          )
          ; else
          "no royalty"
        )
      )
    )
    true
  )

  (defun enforce-withdraw:bool
    ( token:object{token-info}
      seller:string
      amount:decimal
      timeout:integer
      sale-id:string )
    true
  )

  (defun enforce-transfer:bool
    ( token:object{token-info}
      sender:string
      guard:guard
      receiver:string
      amount:decimal )
    true
  )

  (defun enforce-update-uri:bool
    ( token:object{token-info}
      new-uri:string )
      (enforce-keyset "n_bc7a2c08104706e8d02a01db35bfda1e5cb297f2.admin")
  )
  
)

;  (create-table minted)
;  (create-table token-minting-data)
;  (create-table royalties)
;  (create-table NO-PAYMENT)
;  (enforce-guard ADMIN-KS)
