import type { NextApiRequest, NextApiResponse } from 'next'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import NDK, { NDKEvent, NDKFilter, NostrEvent } from '@nostr-dev-kit/ndk'
import { validateEvent } from 'nostr-tools'
import { makeEventSerializable } from '@/helpers'

/*
usage:
https://www.graperank.tech/api/cronJobBackgroundListener
*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

const serializeEvent = async (event:NostrEvent) => {
  const oOutput = makeEventSerializable(event)
  const sOutput = JSON.stringify(oOutput)
  return sOutput
}

const explicitRelayUrls = [
  'wss://purplepag.es',
  'wss://profiles.nostr1.com',
  'wss://relay.damus.io'
]
const ndk = new NDK({explicitRelayUrls})

type ResponseData = {
  success: boolean,
  message: string,
  data?: object
}
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const sinceTimestamp = currentTimestamp - 1800 // 60 * 30 = 1800, for past 30 minutes
    await ndk.connect()
    const filter:NDKFilter = { kinds: [3, 1984, 10000], since: sinceTimestamp, limit: 10 }
    const sub1 = ndk.subscribe(filter)
    sub1.on('event', async (event:NDKEvent) => {
      if (validateEvent(event)) {
        console.log(`received event.kind: ${event.kind}; event.id: ${event.id}`)
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

    const response:ResponseData = {
      success: true,
      message: `api/cronJobBackgroundListener data:`,
      data: {

      }
    }
    res.status(200).json(response)
  } catch (error) {
    console.log(`error: ${JSON.stringify(error)}`)
    const response:ResponseData = {
      success: false,
      message: `api/cronJobBackgroundListener error: ${error}!`,
    }
    res.status(500).json(response)
  }
}
