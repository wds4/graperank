// eslint-disable-next-line @typescript-eslint/no-require-imports
// const NDK = require('@nostr-dev-kit/ndk').NDK
import NDK from '@nostr-dev-kit/ndk'
import mysql from 'mysql2/promise'

console.log('Node.js test_script_nostr.mjs executed!');

const runSqlCommand = async (command) => {
  const connection = await mysql.createConnection({
    host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: 'pgft',
    password: 'vehZyt-cuspuj-8ruvma',
    database: 'grapevineNostrCacheDb',
  });

  const [results] = await connection.query(command);
  console.log(`command results: ${JSON.stringify(results, null, 4)}`);

  const close_result = await connection.end()

  console.log(`closing connection: ${JSON.stringify(close_result)}`)
}

const currentTimestamp = Math.floor(Date.now() / 1000)
const command1 = `UPDATE testTable SET whenupdated = ${currentTimestamp} WHERE name = 'fred'; `
await runSqlCommand(command1)

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const pubkey = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f'

const filter = { kinds: [3, 10000], authors: [pubkey], limit: 10 }

const ndk = new NDK({explicitRelayUrls})

console.log('Node.js test_script_nostr.mjs A!');

await ndk.connect()

console.log('Node.js test_script_nostr.mjs B!');

const sub1 = ndk.subscribe(filter)

console.log('Node.js test_script_nostr.mjs C!');

const receivedEvents = []

sub1.on('event', async (event) => {
  console.log(`event.id: ${event.id}`)
  const command1 = `INSERT INTO testTable (name) VALUES ('jack'); `
  await runSqlCommand(command1)
  receivedEvents.push(event.id)
})

console.log('Node.js test_script_nostr.mjs D!');

console.log(`Node.js test_script_nostr.mjs receivedEvents: ${JSON.stringify(receivedEvents)}`);
