// eslint-disable-next-line @typescript-eslint/no-require-imports
// const NDK = require('@nostr-dev-kit/ndk').NDK
import NDK from '@nostr-dev-kit/ndk'
import mysql from 'mysql2/promise'

console.log('Node.js test_script_nostr.mjs executed!');

const connection = await mysql.createConnection({
  host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
  port: 3306,
  user: 'pgft',
  password: 'vehZyt-cuspuj-8ruvma',
  database: 'grapevineNostrCacheDb',
});

const runSqlCommand = async () => {
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const command1 = `UPDATE testTable SET whenupdated = ${currentTimestamp} WHERE name = 'fred'; `
  const [results] = await connection.query(command1);
  console.log(`command1 results: ${JSON.stringify(results, null, 4)}`);
}

await runSqlCommand()

const close_result = await connection.end()
console.log(`closing connection: ${JSON.stringify(close_result)}`)

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const ndk = new NDK({explicitRelayUrls})

const pubkey = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'

try {
    console.log('Node.js test_script_nostr.mjs A!');
    await ndk.connect()
    console.log('Node.js test_script_nostr.mjs B!');
    const filter = { kinds: [3, 10000], authors: [pubkey], limit: 10 }
    const sub1 = ndk.subscribe(filter)
    const receivedEvents = []
    sub1.on('event', async (event) => {
      console.log(`event.id: ${event.id}`)
      receivedEvents.push(event.id)
    })
    sub1.on('eose', async () => {
      const response = {
        success: true,
        message: `test_script_nostr eose!`,
        data: receivedEvents
      }
      res.status(200).json(response)
    })
  } catch (e) {
    const response = {
      success: false,
      message: `test_script_nostr error: ${e}`
    }
    res.status(500).json(response)
  }
