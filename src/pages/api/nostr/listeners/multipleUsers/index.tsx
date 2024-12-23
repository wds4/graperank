import type { NextApiRequest, NextApiResponse } from 'next'
import NDK, { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk'
import { validateEvent } from 'nostr-tools'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { makeEventSerializable, timeout } from '@/helpers'
import mysql from 'mysql2/promise'

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

/*
Given n pubkeys, this endpoint listens on nostr for kinds 3 and 10000 events and:
- inserts events into S3
- inserts events into sql table: events

(A separate script is necessary to transfer event data into the relevant sql tables)

mode 0: cycle through ALL users
focus modes:
- if kind0EventId=true, cycle only through users where !kind0EventId
- if kind3EventId=true, cycle only through users where !kind3EventId
- if kind10000EventId=true, cycle only through users where !kind10000EventId

sql1: SELECT pubkey FROM users [WHERE kind[x]EventId IS NOT NULL] ORDER BY whenLastListened ASC LIMIT ${maxNumPubkeysForFilter}
extract const aPubkeys from sql1_results
nostr filter = { kinds: [3, 10000], authors: aPubkeys }
for each received event: add event to s3 under recentlyAddedEventsByEventId
sql2: UPDATE users SET whenLastListened=currentTimestamp WHERE pubkey in aPubkeys

usage:

http://localhost:3000/api/nostr/listeners/multipleUsers?n=5

https://graperank.tech/api/nostr/listeners/multipleUsers?n=5
https://graperank.tech/api/nostr/listeners/multipleUsers?n=5&kind0EventId=true&kind3EventId&kind10000EventId=true
*/

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const ndk = new NDK({explicitRelayUrls})

type ResponseData = {
  success: boolean
  message: string
  data?: object
}

const serializeEvent = async (event:NostrEvent) => {
  const oOutput = makeEventSerializable(event)
  const sOutput = JSON.stringify(oOutput)
  return sOutput
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  let maxNumPubkeysForFilter = 1;
  if (searchParams.n && typeof searchParams.n == 'string') {
    maxNumPubkeysForFilter = Number(searchParams.n)
  }
  console.log(`maxNumPubkeysForFilter: ${maxNumPubkeysForFilter}`)

  let numFocusModes = 0
  let sql1 = `SELECT pubkey FROM users `

  if (searchParams.kind0EventId) { numFocusModes++ }
  if (searchParams.kind3EventId) { numFocusModes++ }
  if (searchParams.kind10000EventId) { numFocusModes++ }

  if (numFocusModes == 0) {
    // no WHERE clause
    sql1 = `SELECT pubkey FROM users WHERE whenLastListened IS NULL `
  }
  if (numFocusModes == 1) {
    // WHERE clause, no need for parantheses
    sql1 = `SELECT pubkey FROM users WHERE whenLastListened IS NULL OR `
    if (searchParams.kind0EventId) { sql1 += ` kind0EventId IS NULL ` }
    if (searchParams.kind3EventId) { sql1 += ` kind3EventId IS NULL ` }
    if (searchParams.kind10000EventId) { sql1 += ` kind10000EventId IS NULL ` }
  }
  if (numFocusModes > 1) {
    // WHERE clause, grouped by OR, in parentheses 
    sql1 = `SELECT pubkey FROM users WHERE whenLastListened IS NULL OR ( `
    let needOrYet = false
    if (searchParams.kind0EventId) {
      if (needOrYet) { sql1 += `OR` }
      sql1 += ` (kind0EventId IS NULL) `
      needOrYet = true
    }
    if (searchParams.kind3EventId) {
      if (needOrYet) { sql1 += `OR` }
      sql1 += ` (kind3EventId IS NULL) `
      needOrYet = true
    }
    if (searchParams.kind10000EventId) {
      if (needOrYet) { sql1 += `OR` }
      sql1 += ` (kind10000EventId IS NULL) `
      needOrYet = true
    }
    sql1 += ` ) ` 
  }
  sql1 += `ORDER BY whenLastListened ASC LIMIT ${maxNumPubkeysForFilter}`

  const aPubkeys:string[] = []
  const currentTimestamp = Math.floor(Date.now() / 1000)
  try {
    const connection = await mysql.createConnection({
      host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: process.env.AWS_MYSQL_USER,
      password: process.env.AWS_MYSQL_PWD,
      database: process.env.AWS_MYSQL_DB,
    });
    const sql1_results = await connection.query(sql1);
    console.log(`sql1_results: ${sql1_results}`)

    const aUsers = JSON.parse(JSON.stringify(sql1_results[0]))
    for (let x=0; x < aUsers.length; x++) {
      const oNextUser = aUsers[x]
      const pk = oNextUser.pubkey
      aPubkeys.push(pk)
    }

    await ndk.connect()
    const filter:NDKFilter = { kinds: [3, 1984, 10000], authors: aPubkeys }
    const sub1 = ndk.subscribe(filter)
    const aReceivedEvents:object[] = []        
    sub1.on('event', async (event:NDKEvent) => {
      if (validateEvent(event)) {
        console.log(`event.id: ${event.id}`)
        aReceivedEvents.push({ eventId: event.id, pubkey: event.pubkey })

        // TODO: check first to see if eventId is already stored in s3, in which case no need to store it again (although this might be too slow of a process??)
        /* PutObjectCommand */
        const params = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: 'recentlyAddedEventsByEventId/' + event.id,
          Body: await serializeEvent(event),
        }
        console.log(typeof params)
        
        const command_s3 = new PutObjectCommand(params);
        const data = await client.send(command_s3);
        console.log(`===== data: ${JSON.stringify(data)}`)
        
      }
    })
    sub1.on('eose', async () => {
      // TODO: not sure whether timeout is needed
      await timeout(5000)
      const sPubkeys = JSON.stringify(aPubkeys).replace('[','(').replace(']',')')
      const sql2 = ` UPDATE users SET whenLastListened=${currentTimestamp} WHERE pubkey IN ${sPubkeys} `
      const sql2_results = await connection.query(sql2);
      console.log(`sql2_results: ${sql2_results}`)

      const close_result = await connection.end()
      console.log(`closing connection: ${close_result}`)
      
      const response = {
        success: true,
        message: `api/tests/listeners/multipleUsers eose!`,
        data: {
          sql1, sql2, aPubkeys, aReceivedEvents, sql2_results
        }
      }
      res.status(200).json(response)
    })
  } catch (e) {
    const response = {
      success: false,
      message: `api/tests/listeners/multipleUsers error: ${e}`
    }
    res.status(500).json(response)
  }
}
