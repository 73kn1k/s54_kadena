; s54 deploy tests by 7<

; ; keysets cfg
;  "tk_teknik_keyset": {
;    "pred": "keys-all",
;    "keys": [
;        "b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"
;    ]
;  }

;  ; raw
;  {
;    "precision": {"int":0},
;    "max_size": {"int":5},
;    "collection_name": "tk-collection-test-00",
;    "collection_id": "collection:35p6y-UKxoDAT_tpMHG7hqVgZ2JbvHeF1xdiPJNcxd0",
;    "uri": "https://demo2.54.wtf/metadata?token=Token00/0", ; <-- second transaction
;    "uri": "https://demo2.54.wtf/metadata?token=Token00/1", ; <-- third transaction
;    "minttoac1": "k:b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e",
;    "minttoac2": "k:eabc6563b14c28dd0ef0576b1a5c279febbf09e21f6e7c8324e5c4b15c7609c4",
;    "royalty_spec": {
;        "fungible": {
;            "refName": {
;                "namespace": null,
;                "name": "coin"
;            },
;            "refSpec": [
;                {
;                    "namespace": null,
;                    "name": "fungible-v2"
;                }
;            ]
;        },
;        "creator": "k:b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e",
;        "creator-guard": {
;            "keys": [
;                "b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"
;            ],
;            "pred": "keys-all"
;        },
;        "royalty-rate": 0.01
;    },
;    "mint-guard": {
;        "keys": [
;            "b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"
;        ],
;        "pred": "keys-all"
;    },
;    "sale-guard": {
;        "keys": [
;            "k:b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"
;        ],
;        "pred": "keys-all"
;    },
;    "transfer-guard": {
;        "keys": [
;            "k:b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"
;        ],
;        "pred": "keys-all"
;    },
;    "uri-guard": {
;        "keys": [
;            "b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"
;        ],
;        "pred": "keys-all"
;    },
;    "mta": true
;  }


; ; TODO check transfer asset from one wallet to other
(use marmalade-v2.ledger)
(use marmalade-v2.util-v1)
(use marmalade-v2.collection-policy-v1)


;  ; first transasaction(depoly)
(create-collection 
    (create-collection-id 
        (read-msg 'collection_name) ; "tk-collection-test-00"
        (read-keyset 'tk_teknik_keyset)
    ) ; returns "collection:9DftCzRuoLygKfph0hkVwuShupH-nKikjrpr8rY8VJk" w "collection_name": "tk-collection-test-03"
      ; returns "collection:ChZOrgqvyP1bAGOhkgP5cEkitoBdH_D-h27Pqt1oW5Q" w "collection_name": "tk-collection-test-02"  
      ; returns "collection:rYUHipjzi4JtMHBdAouwPvXBJ2atEf7iOJkZMlX6dGM" w "collection_name": "tk-collection-test-01"
      ; returns "collection:35p6y-UKxoDAT_tpMHG7hqVgZ2JbvHeF1xdiPJNcxd0" w "collection_name": "tk-collection-test-00"
    (read-msg 'collection_name) ; "tk-collection-test-00"
    (read-msg 'max_size) ; collection size 0 for infinite? & integer for finite nr?
    (read-keyset 'tk_teknik_keyset)
)
;  ; capability
;  ; (marmalade-v2.collection-policy-v1.COLLECTION "collection:35p6y-UKxoDAT_tpMHG7hqVgZ2JbvHeF1xdiPJNcxd0" "tk-collection-test-00" {"int"5} {"keys": ["b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"], "pred": "keys-all"} )     



;  ; second transasaction(depoly)
(create-token
   (create-token-id
        {'precision: (read-msg 'precision),
            'policies: [
                marmalade-v2.non-fungible-policy-v1,
                marmalade-v2.guard-policy-v1,
                marmalade-v2.collection-policy-v1,
                marmalade-v2.royalty-policy-v1
            ],
            'uri: (read-msg 'uri)
        }
        (at 'creator-guard (read-msg 'royalty_spec))
    )   ; "https://demo2.54.wtf/metadata?token=Token00/1" returns "t:TAzOsJdSrVLABBmDPiu1b3UIYHdPuSblnzeIGGRvHeM"
        ; "https://demo2.54.wtf/metadata?token=Token00/0" returns "t:qYPZhdVxCqWlWuUSTXpWwAW2KtlsDMbSHsamdrTXiDY"
        ; used for token-id
    (read-msg 'precision) ; precision
    (read-msg 'uri)
    [
        marmalade-v2.non-fungible-policy-v1,
        marmalade-v2.guard-policy-v1,
        marmalade-v2.collection-policy-v1,
        marmalade-v2.royalty-policy-v1
    ] ; policies
    (at 'creator-guard (read-msg 'royalty_spec))
)
;  ; capabilities
;  ; (marmalade-v2.ledger.CREATE-TOKEN "t:TAzOsJdSrVLABBmDPiu1b3UIYHdPuSblnzeIGGRvHeM" {"keys": ["b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e"], "pred": "keys-all"})  
;  ; (marmalade-v2.ledger.MINT "t:TAzOsJdSrVLABBmDPiu1b3UIYHdPuSblnzeIGGRvHeM" "k:b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e" 1.0)


;  ; third transasaction(depoly)
(mint "t:TAzOsJdSrVLABBmDPiu1b3UIYHdPuSblnzeIGGRvHeM"
  (read-msg 'minttoac1)
  (read-keyset 'tk_teknik_keyset)
  1.0
)
;  ; capabilities
;  ; (coin.GAS) -->  select the gas payer
;  ; then add
;  ; (marmalade-v2.ledger.MINT "t:TAzOsJdSrVLABBmDPiu1b3UIYHdPuSblnzeIGGRvHeM" "k:b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e" 1.0)
;  ; select the wallet that has the right to mint w this capability



;  ; fourth transasaction(depoly)
(mint "t:TAzOsJdSrVLABBmDPiu1b3UIYHdPuSblnzeIGGRvHeM"
  (read-msg 'minttoac1)
  (read-keyset 'tk_teknik_keyset)
  1.0
)
;  ; capabilities
;  ; (coin.GAS) -->  select the gas payer
;  ; then add
;  ; (marmalade-v2.ledger.MINT "t:TAzOsJdSrVLABBmDPiu1b3UIYHdPuSblnzeIGGRvHeM" "k:b3b015a348f8b9664bb159d28d76b192d88e981e2a18bd7f83ad18035118b07e" 1.0)
;  ; select the wallet that has the right to mint w this capability
