const { fetchAddress, setServers } = require('hip2-dane')

const sName = 'Hip2'
const methods = {
  fetchAddress,
  setServers
}

export async function start (server) {
  server.withService(sName, methods)
}
