import type { NextApiRequest, NextApiResponse } from 'next'
import NDK, { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk'
import { verifyPubkeyValidity } from '@/helpers/nip19'
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
Given a pubkey, this endpoint listens on nostr for kinds 3 and 10000 events and:
- inserts events into S3
- inserts events into sql table: events

A separate script is necessary to transfer event data into the relevant sql tables

usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
http://localhost:3000/api/nostr/listeners/singleUser?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

https://graperank.tech/api/nostr/listeners/singleUser?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

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
  if (searchParams.npub) {
    // TODO: support npub
  }
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: true,
      message: `api/nostr/listeners/singleUser: no pubkey was provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey0 = searchParams.pubkey
    if (typeof pubkey0 == 'string' && verifyPubkeyValidity(pubkey0)) {
      const pubkey1 = pubkey0.toLowerCase()
      const currentTimestamp = Math.floor(Date.now() / 1000)
      try {
        const connection = await mysql.createConnection({
          host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
          port: 3306,
          user: process.env.AWS_MYSQL_USER,
          password: process.env.AWS_MYSQL_PWD,
          database: process.env.AWS_MYSQL_DB,
        });
        const command_sql_insert = ` INSERT IGNORE INTO users (pubkey, whenlastlistened) VALUES ( '${pubkey1}', ${currentTimestamp} ); `
        const results_insert = await connection.query(command_sql_insert);
        console.log(`results_insert: ${results_insert}`)

        await ndk.connect()
        const filter:NDKFilter = { kinds: [3, 10000], authors: [pubkey1], limit: 10 }
        const sub1 = ndk.subscribe(filter)
        const receivedEvents:string[] = []        
        sub1.on('event', async (event:NDKEvent) => {
          if (validateEvent(event)) {
            console.log(`event.id: ${event.id}`)
            receivedEvents.push(event.id)
            /* PutObjectCommand */
            const params = {
              Bucket: 'grapevine-nostr-cache-bucket',
              Key: 'recentlyAddedEventsByEventId/' + event.id,
              Body: await serializeEvent(event),
            }
            const command_s3 = new PutObjectCommand(params);
            const data = await client.send(command_s3);
            console.log(`===== data: ${JSON.stringify(data)}`)

            /*
            // include needToProcess key for later processing
            const returnMetadata = async () => {
              const oMetadata = {
                transferred: 'false'
              }
              return JSON.stringify(oMetadata)
            }
            const params_metadata = {
              Bucket: 'grapevine-nostr-cache-bucket',
              Key: 'recentlyAddedEventsByEventId/' + event.id + '/customMetadata',
              Body: await returnMetadata(),
            }
            const command_s3_metadata = new PutObjectCommand(params_metadata);
            const data_metadata = await client.send(command_s3_metadata);
            console.log(`===== data_metadata: ${JSON.stringify(data_metadata)}`)
            */

            /*
            // MYSQL -- MOVING THIS TO SEPARATE SCRIPT
            let command_sql = ''
            let command2_sql = ''
            let command3_sql = ''
            let command4_sql = ''
            //  INSERT into events
            command_sql = ` INSERT IGNORE INTO events (pubkey, eventid, created_at, kind) VALUES ( '${event.pubkey}', '${event.id}', ${event.created_at}, ${event.kind} ); `
            const results1 = await connection.query(command_sql);
            console.log(results1);
            aMysqlResults.push(results1)
            // UPDATE users 
            command2_sql = ` INSERT IGNORE INTO users (pubkey, whenlastlistened) VALUES ( '${event.pubkey}', ${currentTimestamp} ); `
            const results2 = await connection.query(command2_sql);
            aMysqlResults.push(results2)
            
            console.log(results2);
            if (event.kind == 3) {
              command3_sql = ` UPDATE users SET kind3eventid='${event.id}', whenlastlistened=${currentTimestamp} WHERE pubkey='${event.pubkey}' ; `
              const results3 = await connection.query(command3_sql);
              console.log(results3);
              aMysqlResults.push(results3)
            }
            if (event.kind == 10000) {
              command4_sql = ` UPDATE users SET kind10000eventid='${event.id}', whenlastlistened=${currentTimestamp} WHERE pubkey='${event.pubkey}' ; `
              const results4 = await connection.query(command4_sql);
              console.log(results4);
              aMysqlResults.push(results4)
            }
            */
          }
        })
        sub1.on('eose', async () => {
          // await timeout(5000)
          const close_result = await connection.end()
          console.log(`closing connection: ${close_result}`)
          
          const response = {
            success: true,
            message: `api/tests/listeners/singleUser eose!`,
            data: {
              receivedEvents,
            }
          }
          res.status(200).json(response)
        })
      } catch (e) {
        const response = {
          success: false,
          message: `api/tests/listeners/singleUser error: ${e}`
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: true,
        message: `api/nostr/listeners/singleUser: the provided pubkey is invalid`
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: true,
      message: `api/nostr/listeners/singleUser: no pubkey was provided`
    }
    res.status(500).json(response)
  }
}
