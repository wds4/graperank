import type { NextApiRequest, NextApiResponse } from 'next'
import NDK, { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk'
import { validateEvent } from 'nostr-tools'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { makeEventSerializable } from '@/helpers'
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
sql1: SELECT * FROM users [WHERE kind[x]EventId IS NOT NULL] ORDER BY whenLastListened ASC LIMIT ${maxNumPubkeysForFilter}

usage:

http://localhost:3000/api/nostr/listeners/multipleUsers?n=5

https://graperank.tech/api/nostr/listeners/multipleUsers?n=5
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
  let sql1 = `SELECT * FROM users `

  if (searchParams.kind0EventId) { numFocusModes++ }
  if (searchParams.kind3EventId) { numFocusModes++ }
  if (searchParams.kind10000EventId) { numFocusModes++ }

  if (numFocusModes == 0) {
    // no WHERE clause
    sql1 = `SELECT * FROM users `
  }
  if (numFocusModes == 1) {
    // WHERE clause, no need for parantheses
    sql1 = `SELECT * FROM users WHERE `
    if (searchParams.kind0EventId) { sql1 += ` kind0EventId IS NOT NULL ` }
    if (searchParams.kind3EventId) { sql1 += ` kind3EventId IS NOT NULL ` }
    if (searchParams.kind10000EventId) { sql1 += ` kind10000EventId IS NOT NULL ` }
  }
  if (numFocusModes > 1) {
    // WHERE clause, grouped by OR, in parentheses 
    sql1 = `SELECT * FROM users WHERE ( `
    let needOrYet = false
    if (searchParams.kind0EventId) {
      if (needOrYet) { sql1 += `OR` }
      sql1 += ` kind0EventId IS NOT NULL `
      needOrYet = true
    }
    if (searchParams.kind3EventId) {
      if (needOrYet) { sql1 += `OR` }
      sql1 += ` kind3EventId IS NOT NULL `
      needOrYet = true
    }
    if (searchParams.kind10000EventId) {
      if (needOrYet) { sql1 += `OR` }
      sql1 += ` kind10000EventId IS NOT NULL `
      needOrYet = true
    }
    sql1 += ` ) ` 
  }
  sql1 += `ORDER BY whenLastListened ASC LIMIT ${maxNumPubkeysForFilter}`

  const response = {
    success: true,
    message: `api/tests/listeners/multipleUsers temporary stopping point. data:`,
    data: {
      sql1,
    }
  }
  res.status(200).json(response)

  const aPubkeys:string[] = []
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

    await ndk.connect()
    const filter:NDKFilter = { kinds: [3, 10000], authors: aPubkeys }
    const sub1 = ndk.subscribe(filter)
    const receivedEvents:string[] = []        
    sub1.on('event', async (event:NDKEvent) => {
      if (validateEvent(event)) {
        console.log(`event.id: ${event.id}`)
        receivedEvents.push(event.id)
        // TODO: check first to see if eventId is already stored in s3, in which case no need to store it again (although this might be too slow of a process??)
        /* PutObjectCommand */
        const params = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: 'recentlyAddedEventsByEventId/' + event.id,
          Body: await serializeEvent(event),
        }
        const command_s3 = new PutObjectCommand(params);
        const data = await client.send(command_s3);
        console.log(`===== data: ${JSON.stringify(data)}`)
      }
    })
    sub1.on('eose', async () => {
      // await timeout(5000)
      const response = {
        success: true,
        message: `api/tests/listeners/multipleUsers eose!`,
        data: {
          sql1,
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
