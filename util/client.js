const { createClient } = require('@kadena/client');

// you can edit this function if you want to use different network like dev-net or a private net
const apiHostGenerator = ({ networkId, chainId }) => {
  switch (networkId) {
    case 'mainnet01':
      return `https://api.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId || '1'}/pact`;
    case 'development':
      return `http://localhost:8080/chainweb/0.0/${networkId}/chain/${chainId || '1'}/pact`;
    case 'testnet04':
    default:
      return `https://api.testnet.chainweb.com/chainweb/0.0/${networkId}/chain/${chainId || '1'}/pact`;
  }
};
  
// configure the client and export the functions
const client = createClient(apiHostGenerator);

const submitOne = async (transaction) => {
  return client.submit(transaction);
};

module.exports = {
  ...client,
  submitOne,
};
