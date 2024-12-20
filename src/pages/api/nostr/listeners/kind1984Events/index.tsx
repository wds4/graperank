import type { NextApiRequest, NextApiResponse } from 'next'
import NDK, { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk'
import { validateEvent } from 'nostr-tools'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { makeEventSerializable } from '@/helpers'

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

/*
This endpoint listens on nostr for kinds 3 and 10000 events and:
- inserts events into S3
- inserts events into sql table: events

A separate script is necessary to transfer event data into the relevant sql tables

usage:

http://localhost:3000/api/nostr/listeners/kind1984Events?t=3600

https://graperank.tech/api/nostr/listeners/kind1984Events?t=3600

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
  let numSeconds = 3600 // the default number of seconds
  if (searchParams.t) {
    numSeconds = Number(searchParams.t)
  }
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const sinceTimestamp = currentTimestamp - numSeconds
  // const startTimestamp = Date.now()
  try {
    await ndk.connect()
    const filter:NDKFilter = { kinds: [1984] }
    const sub1 = ndk.subscribe(filter)
    const receivedEvents:string[] = []        
    sub1.on('event', async (event:NDKEvent) => {
      if (validateEvent(event)) {
        console.log(`received event.kind: ${event.kind}; event.id: ${event.id}`)
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
      }
    })
    sub1.on('eose', async () => {
      // await timeout(5000)
      const response = {
        success: true,
        message: `api/tests/listeners/kind1984Events eose!`,
        data: {
          receivedEvents,
        }
      }
      res.status(200).json(response)
    })
  } catch (e) {
    const response = {
      success: false,
      message: `api/tests/listeners/kind1984Events error: ${e}`
    }
    res.status(500).json(response)
  }
}
