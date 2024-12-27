import type { NextApiRequest, NextApiResponse } from 'next'
import NDK, { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk' // NostrEvent
import { validateEvent } from 'nostr-tools'
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
// import { makeEventSerializable } from '@/helpers'

/*
const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})
*/

/*
This endpoint listens on nostr for NIP-51 events and:
- inserts events into S3

A separate script is necessary to transfer event data into the relevant sql tables

STANDARD LISTS
10000 mute list
10001 pinned notes
10003 bookmarks
10004 communities
10005 public chats
10006 blocked relays
10007 search relays
10009 simple groups
10015 interests
10030 emojis
10050 DM relays
10101 good wiki authors
10102 good wiki relays

kinds = [10000, 10001, 10003, 10004, 10005, 10006, 10007, 10009, 10015, 10030, 10050, 10101, 10102, 30000, 30002, 30003, 30004, 30005, 30007, 30015, 30030, 30063]

SETS
30000 follow sets
30002 relay sets
30003 bookmark sets
30004 curation sets: articles
30005 curation sets: videos
30007 kind mute sets
30015 interest sets
30030 emoji sets
30063 release artifact sets

usage:

https://graperank.tech/api/nostr/listeners/nip51Events?kind=10003&t=3600

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

/*
const serializeEvent = async (event:NostrEvent) => {
  const oOutput = makeEventSerializable(event)
  const sOutput = JSON.stringify(oOutput)
  return sOutput
}
*/
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  let numSeconds = 3600 // the default number of seconds
  // let kinds = [10003]
  let kinds = [10000, 10001, 10003, 10004, 10005, 10006, 10007, 10009, 10015, 10030, 10050, 10101, 10102, 30000, 30002, 30003, 30004, 30005, 30007, 30015, 30030, 30063]
  if (searchParams.t) {
    numSeconds = Number(searchParams.t)
  }
  if (searchParams.kind) {
    kinds = [Number(searchParams.kind)]
  }
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const sinceTimestamp = currentTimestamp - numSeconds
  const startTimestamp = Date.now()
  console.log(sinceTimestamp)
  console.log(startTimestamp)
  try {
    await ndk.connect()
    
    const filter:NDKFilter = { kinds }
    const sub1 = ndk.subscribe(filter)
    const receivedEvents:string[] = []        
    sub1.on('event', async (event:NDKEvent) => {
      if (validateEvent(event)) {
        console.log(`received event.kind: ${event.kind}; event.id: ${event.id}`)
        receivedEvents.push(event.id)
        const nowTimestamp = Math.floor(Date.now() / 1000)
        if (nowTimestamp - currentTimestamp > 50) {
          const response = {
            success: true,
            message: `api/tests/listeners/nip51Events eose!`,
            data: {
              kinds,
              nowTimestamp,
              interval: nowTimestamp - currentTimestamp,
              numEvents: receivedEvents.length,
              receivedEvents,
            }
          }
          res.status(200).json(response)
        }
        /* PutObjectCommand */
        /*
        const params = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: 'recentlyAddedEventsByEventId/' + event.id,
          Body: await serializeEvent(event),
        }
        const command_s3 = new PutObjectCommand(params);
        const data = await client.send(command_s3);
        console.log(`===== data: ${JSON.stringify(data)}`)
        */
      }
    })
    sub1.on('eose', async () => {
      // await timeout(5000)
      const response = {
        success: true,
        message: `api/tests/listeners/nip51Events eose!`,
        data: {
          kinds,
          numEvents: receivedEvents.length,
          receivedEvents,
        }
      }
      res.status(200).json(response)
    })
  } catch (e) {
    const response = {
      success: false,
      message: `api/tests/listeners/nip51Events error: ${e}`
    }
    res.status(500).json(response)
  }
}
